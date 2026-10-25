import * as THREE from "three";

import { fireEnemy } from "./combat";
import { Control } from "./input";
import type { GameRuntime } from "./runtime";
import { EnemyKind } from "./types";
import { groundHeightAt } from "./world";

function animateSoldier(runtime: GameRuntime, moving: boolean, now: number): void {
  const swing = moving ? Math.sin(now * 11) * 0.72 : Math.sin(now * 2) * 0.04;
  const model = runtime.player.model;
  model.leftLeg.rotation.z = swing;
  model.rightLeg.rotation.z = -swing;
  model.root.position.y +=
    moving && runtime.player.grounded ? Math.abs(Math.sin(now * 11)) * 0.003 : 0;
}

export function updatePlayer(runtime: GameRuntime, delta: number, now: number): void {
  const player = runtime.player;
  const position = player.model.root.position;
  const x =
    Number(runtime.input.isHeld(Control.right)) - Number(runtime.input.isHeld(Control.left));
  const z =
    Number(runtime.input.isHeld(Control.backward)) - Number(runtime.input.isHeld(Control.forward));
  const direction = new THREE.Vector2(x, z);
  if (direction.lengthSq() > 1) direction.normalize();
  const ground = groundHeightAt(position.x, position.z);
  const speed = ground < 0 ? 4.2 : 7.2;
  position.x = THREE.MathUtils.clamp(position.x + direction.x * speed * delta, -2, 143.2);
  position.z = THREE.MathUtils.clamp(position.z + direction.y * speed * delta, -5.2, 5.2);
  if (runtime.input.consume(Control.jump) && player.grounded) {
    player.velocityY = 7.4;
    player.grounded = false;
    runtime.audio.jump();
  }
  player.velocityY -= 18 * delta;
  position.y += player.velocityY * delta;
  const currentGround = groundHeightAt(position.x, position.z);
  if (position.y <= currentGround) {
    position.y = currentGround;
    player.velocityY = 0;
    player.grounded = true;
  }
  const visible = now >= player.invulnerableUntil || Math.floor(now * 12) % 2 === 0;
  player.model.root.visible = visible;
  animateSoldier(runtime, direction.lengthSq() > 0.01, now);
}

function moveEnemy(
  runtime: GameRuntime,
  enemy: GameRuntime["enemies"][number],
  delta: number,
): void {
  if (
    enemy.kind === EnemyKind.turret ||
    enemy.kind === EnemyKind.sniper ||
    enemy.kind === EnemyKind.core
  )
    return;
  const target = runtime.player.model.root.position;
  const direction = target.clone().sub(enemy.mesh.position);
  direction.y = 0;
  const desiredDistance = enemy.kind === EnemyKind.gunner ? 9 : 2.5;
  if (direction.length() <= desiredDistance) return;
  direction.normalize();
  const speed = enemy.kind === EnemyKind.runner ? 3.7 : 2.1;
  enemy.mesh.position.addScaledVector(direction, speed * delta);
  enemy.mesh.position.y = groundHeightAt(enemy.mesh.position.x, enemy.mesh.position.z);
}

export function updateEnemies(runtime: GameRuntime, delta: number, now: number): void {
  const playerPosition = runtime.player.model.root.position;
  for (const enemy of runtime.enemies) {
    if (!enemy.alive) continue;
    const distanceX = Math.abs(enemy.mesh.position.x - playerPosition.x);
    enemy.active = distanceX < 29 || enemy.mesh.position.x > 140;
    if (!enemy.active) continue;
    moveEnemy(runtime, enemy, delta);
    const targetLeft = playerPosition.x < enemy.mesh.position.x;
    enemy.mesh.rotation.y = targetLeft ? Math.PI : 0;
    if (distanceX < 19 && enemy.kind !== EnemyKind.core) fireEnemy(runtime, enemy, now);
    if (enemy.model !== null) {
      const swing = enemy.kind === EnemyKind.runner ? Math.sin(now * 9 + enemy.id) * 0.62 : 0;
      enemy.model.leftLeg.rotation.z = swing;
      enemy.model.rightLeg.rotation.z = -swing;
    }
    if (enemy.kind === EnemyKind.runner && enemy.mesh.position.distanceTo(playerPosition) < 1.15) {
      fireEnemy(runtime, enemy, now - 10);
    }
  }
}

export function collectPickups(runtime: GameRuntime): void {
  for (const pickup of runtime.pickups) {
    if (
      pickup.collected ||
      pickup.mesh.position.distanceTo(runtime.player.model.root.position) > 1.45
    )
      continue;
    pickup.collected = true;
    runtime.scene.remove(pickup.mesh);
    runtime.player.weapon = pickup.weapon;
    runtime.player.score += 250;
    runtime.audio.pickup();
    runtime.ui.toast(`武器升级：${pickup.weapon.toUpperCase()}`);
  }
}
