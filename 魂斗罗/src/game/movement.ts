import * as THREE from "three";
import { damagePlayer, fireEnemy } from "./combat";
import { Control } from "./input";
import type { GameRuntime } from "./runtime";
import { ENEMY_SPAWNS, GRAVITY, JUMP_SPEED, RUN_SPEED, VIEW_WIDTH } from "./stage";
import { floorAt, landingSurface, surfacesAt } from "./terrain";
import { EnemyKind, Weapon } from "./types";

export function updatePlayer(runtime: GameRuntime, delta: number, now: number): void {
  const player = runtime.player;
  const position = player.model.root.position;
  position.z = 0;
  if (player.pose === "dead") return;
  const x =
    Number(runtime.input.isHeld(Control.right)) - Number(runtime.input.isHeld(Control.left));
  const y = Number(runtime.input.isHeld(Control.up)) - Number(runtime.input.isHeld(Control.down));
  const jump = runtime.input.consume(Control.jump);
  const previousY = position.y;
  const support = surfacesAt(runtime, position.x).find(
    (s) => s.id === player.groundId && Math.abs(s.y - position.y) < 0.01,
  );
  if (!support) player.grounded = false;
  const inWater = player.grounded && support?.kind === "water";
  if (x) player.facing = x;
  player.pose = !player.grounded
    ? "jumping"
    : inWater
      ? y < 0
        ? "diving"
        : "swimming"
      : y < 0 && x === 0
        ? "prone"
        : "standing";
  if (player.grounded) {
    player.velocityX =
      player.pose === "prone" || player.pose === "diving" ? 0 : x * (inWater ? 2.6 : RUN_SPEED);
  } else if (x) player.velocityX = x * RUN_SPEED;
  if (jump && player.grounded && !inWater) {
    if (y < 0 && support?.kind === "platform") {
      player.dropThroughUntil = now + 0.28;
      player.velocityY = -1;
    } else {
      player.velocityY = JUMP_SPEED;
      runtime.audio.jump();
      player.velocityX = x * RUN_SPEED;
    }
    player.grounded = false;
    player.groundId = null;
    player.pose = "jumping";
  }
  const nextX = THREE.MathUtils.clamp(
    position.x + player.velocityX * delta,
    runtime.cameraX - VIEW_WIDTH / 2 + 0.45,
    145.4,
  );
  const nextFloor = floorAt(runtime, nextX);
  if (inWater && nextFloor?.kind === "ground" && nextFloor.y > position.y) {
    position.y = nextFloor.y;
    player.groundId = nextFloor.id;
    player.pose = "standing";
  }
  position.x = nextX;
  player.velocityY -= GRAVITY * delta;
  const nextY = position.y + player.velocityY * delta;
  const landing =
    player.velocityY <= 0
      ? landingSurface(runtime, nextX, position.y, nextY, now < player.dropThroughUntil)
      : undefined;
  if (landing) {
    position.y = landing.y;
    player.velocityY = 0;
    player.grounded = true;
    player.groundId = landing.id;
    player.pose =
      landing.kind === "water"
        ? y < 0
          ? "diving"
          : "swimming"
        : y < 0 && !x
          ? "prone"
          : "standing";
  } else {
    position.y = nextY;
    player.grounded = false;
    player.groundId = null;
  }
  // Grounded down+direction is diagonal fire; down alone is a horizontal prone shot.
  player.aimX = x || (y === 0 || player.pose === "prone" ? player.facing : 0);
  player.aimY = player.pose === "prone" ? 0 : y;
  if ((player.pose === "swimming" || player.pose === "diving") && player.aimY < 0) player.aimY = 0;
  if (!player.aimX && !player.aimY) player.aimX = player.facing;
  if (position.y < -7) damagePlayer(runtime, now, "坠入断崖", true);
  animatePlayer(runtime, now, position.y - previousY);
}

export function animatePlayer(runtime: GameRuntime, now: number, _rise = 0): void {
  const p = runtime.player;
  const model = p.model;
  model.root.visible =
    p.pose === "dead" || now >= p.invulnerableUntil || Math.floor(now * 16) % 2 === 0;
  model.root.scale.x = p.facing;
  model.setPose(p.pose, now, Math.abs(p.velocityX) > 0, Math.atan2(p.aimY, Math.abs(p.aimX) || 0));
}

export function updateEnemies(runtime: GameRuntime, delta: number, now: number): void {
  const target = runtime.player.model.root.position;
  for (const enemy of runtime.enemies) {
    if (!enemy.alive) continue;
    const pos = enemy.mesh.position;
    const wasActive = enemy.active;
    enemy.active =
      pos.x > runtime.cameraX - VIEW_WIDTH / 2 - 2 && pos.x < runtime.cameraX + VIEW_WIDTH / 2 + 1;
    enemy.mesh.visible = enemy.active;
    if (!enemy.active) {
      if (
        enemy.kind === EnemyKind.runner &&
        enemy.id >= ENEMY_SPAWNS.length &&
        pos.x > runtime.cameraX + VIEW_WIDTH / 2
      )
        pos.x += enemy.facing * 3.1 * delta;
      continue;
    }
    if (!wasActive) enemy.nextShotAt = now + 0.8;
    if (enemy.kind === EnemyKind.runner) {
      const beforeY = pos.y;
      pos.x += enemy.facing * 3.1 * delta;
      enemy.velocityY -= GRAVITY * delta;
      const landing = landingSurface(
        runtime,
        pos.x,
        beforeY,
        beforeY + enemy.velocityY * delta,
        false,
      );
      if (landing && landing.kind !== "water") {
        pos.y = landing.y;
        enemy.velocityY = 0;
      } else pos.y += enemy.velocityY * delta;
      if (pos.y < -4 || pos.x < runtime.cameraX - VIEW_WIDTH / 2 - 1) {
        enemy.alive = false;
        enemy.mesh.visible = false;
      }
    } else if (enemy.kind !== EnemyKind.core && runtime.player.pose !== "dead") {
      enemy.facing = target.x < pos.x ? -1 : 1;
    }
    if (enemy.model) {
      enemy.mesh.scale.x = enemy.facing;
      if (enemy.kind === EnemyKind.runner)
        enemy.model.setPose(enemy.velocityY < -0.5 ? "jumping" : "standing", now, true, 0);
    }
    if (enemy.kind !== EnemyKind.runner && enemy.kind !== EnemyKind.core) {
      const aim =
        enemy.kind === EnemyKind.mortar
          ? Math.atan2(5.8, 4.2)
          : Math.round(Math.atan2(target.y - pos.y, Math.abs(target.x - pos.x)) / (Math.PI / 8)) *
            (Math.PI / 8);
      if (enemy.model) enemy.model.setPose("standing", now, false, aim);
      else {
        enemy.mesh.scale.x = -enemy.facing;
        const barrel = enemy.mesh.getObjectByName("barrel");
        if (barrel) barrel.rotation.z = -aim;
        const warning = enemy.mesh.getObjectByName("warning");
        if (warning) warning.visible = enemy.nextShotAt - now <= 0.3;
      }
      if (runtime.player.pose !== "dead" && Math.abs(pos.x - target.x) < VIEW_WIDTH - 3)
        fireEnemy(runtime, enemy, now);
    }
    enemy.mesh.scale.y = now < enemy.hitUntil ? 0.85 : 1;
    if (
      runtime.player.pose !== "diving" &&
      Math.abs(pos.x - target.x) < 0.65 &&
      Math.abs(pos.y - target.y) < 1.3
    )
      damagePlayer(runtime, now, enemy.kind === EnemyKind.runner ? "与跑兵接触" : "与敌军接触");
  }
}

export function collectPickups(runtime: GameRuntime): void {
  const player = runtime.player;
  if (player.pose === "dead") return;
  for (const pickup of runtime.pickups) {
    if (pickup.collected || !pickup.released) continue;
    const dx = Math.abs(pickup.mesh.position.x - player.model.root.position.x);
    const dy = pickup.mesh.position.y - player.model.root.position.y;
    if (dx > 0.9 || dy < -0.2 || dy > (player.pose === "prone" ? 0.8 : 1.9)) continue;
    pickup.collected = true;
    pickup.mesh.visible = false;
    if (pickup.weapon === "rapid") {
      if (player.weapon !== Weapon.laser) player.rapid = true;
    } else if (pickup.weapon === "barrier") player.invulnerableUntil = runtime.simulationTime + 15;
    else if (pickup.weapon === "bomb") {
      for (const enemy of runtime.enemies)
        if (enemy.active && enemy.kind !== EnemyKind.core) {
          enemy.alive = false;
          enemy.mesh.visible = false;
        }
    } else {
      player.weapon = pickup.weapon;
      if (pickup.weapon === Weapon.laser) player.rapid = false;
    }
    player.score += 500;
    runtime.audio.pickup();
    runtime.ui.toast(
      pickup.weapon === "rapid"
        ? player.weapon === Weapon.laser
          ? "R 与 L 不兼容"
          : "R：弹速强化"
        : pickup.weapon === "barrier"
          ? "B：15 秒防护"
          : `取得 ${pickup.weapon.toUpperCase()}`,
    );
  }
}
