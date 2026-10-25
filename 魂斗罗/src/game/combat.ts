import * as THREE from "three";

import { spawnExplosion } from "./effects";
import { Control } from "./input";
import { createProjectile } from "./models";
import { checkpointFor, isHit, takeDamage } from "./rules";
import type { GameRuntime } from "./runtime";
import { CORE_HEALTH } from "./stage";
import { type EnemyActor, EnemyKind, Phase, type Shot, Weapon } from "./types";
import { groundHeightAt } from "./world";

type ShotUpdate = {
  readonly shots: Shot[];
  readonly delta: number;
  readonly now: number;
};

function enemyForObject(runtime: GameRuntime, object: THREE.Object3D): EnemyActor | undefined {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    const enemy = runtime.enemies.find((candidate) => candidate.mesh === current);
    if (enemy !== undefined) return enemy;
    current = current.parent;
  }
  return undefined;
}

function enemyTarget(enemy: EnemyActor): THREE.Vector3 {
  return enemy.mesh.position
    .clone()
    .add(new THREE.Vector3(0, enemy.kind === EnemyKind.core ? 0 : 0.9, 0));
}

function aimDirection(runtime: GameRuntime): THREE.Vector3 {
  const pointer = new THREE.Vector2(runtime.input.aimX, -runtime.input.aimY);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, runtime.camera);
  const targets = runtime.enemies.filter((enemy) => enemy.alive).map((enemy) => enemy.mesh);
  const firstHit = raycaster.intersectObjects(targets, true)[0];
  const start = runtime.player.model.root.position.clone().add(new THREE.Vector3(0, 1.24, 0));
  const aimedEnemy = firstHit === undefined ? undefined : enemyForObject(runtime, firstHit.object);
  if (aimedEnemy !== undefined) return enemyTarget(aimedEnemy).sub(start).normalize();

  const playerOnScreen = start.clone().project(runtime.camera);
  const forward = pointer.x >= playerOnScreen.x;
  const targetPlane = new THREE.Plane(
    new THREE.Vector3(1, 0, 0),
    -(start.x + (forward ? 24 : -24)),
  );
  const target = raycaster.ray.intersectPlane(targetPlane, new THREE.Vector3());
  return target?.sub(start).normalize() ?? new THREE.Vector3(forward ? 1 : -1, 0, 0);
}

function shotDelay(runtime: GameRuntime): number {
  switch (runtime.player.weapon) {
    case Weapon.rifle:
      return 0.22;
    case Weapon.rapid:
      return 0.095;
    case Weapon.spread:
      return 0.31;
    case Weapon.laser:
      return 0.28;
  }
}

function addShot(runtime: GameRuntime, direction: THREE.Vector3): void {
  const laser = runtime.player.weapon === Weapon.laser;
  const mesh = createProjectile(false, laser);
  const start = runtime.player.model.root.position;
  mesh.position.set(start.x + direction.x, start.y + 1.24, start.z + direction.z * 0.4);
  if (laser) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  runtime.scene.add(mesh);
  runtime.playerShots.push({
    mesh,
    velocity: direction.multiplyScalar(laser ? 38 : 27),
    enemyOwned: false,
    damage: laser ? 3 : 1,
    life: 1.35,
  });
}

export function firePlayer(runtime: GameRuntime, now: number): void {
  const firing = runtime.input.isHeld(Control.fire) || runtime.input.isHeld(Control.mouseFire);
  if (!firing || now < runtime.player.nextShotAt) return;
  runtime.player.nextShotAt = now + shotDelay(runtime);
  const direction = aimDirection(runtime);
  if (runtime.player.weapon === Weapon.spread) {
    for (const offset of [-0.2, 0, 0.2]) {
      addShot(
        runtime,
        direction
          .clone()
          .add(new THREE.Vector3(0, offset * 0.25, offset))
          .normalize(),
      );
    }
  } else {
    addShot(runtime, direction);
  }
  runtime.player.model.root.rotation.y = direction.x < 0 ? Math.PI : 0;
  runtime.audio.shoot(runtime.player.weapon === Weapon.laser ? "laser" : "rifle");
}

export function fireEnemy(runtime: GameRuntime, enemy: EnemyActor, now: number): void {
  if (now < enemy.nextShotAt) return;
  const origin = enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
  const target = runtime.player.model.root.position.clone().add(new THREE.Vector3(0, 1, 0));
  const direction = target.sub(origin).normalize();
  const mesh = createProjectile(true, false);
  mesh.position.copy(origin);
  runtime.scene.add(mesh);
  runtime.enemyShots.push({
    mesh,
    velocity: direction.multiplyScalar(6),
    enemyOwned: true,
    damage: 1,
    life: 2.5,
  });
  const cadence =
    enemy.kind === EnemyKind.turret ? 2 : enemy.kind === EnemyKind.gunner ? 2.35 : 2.8;
  enemy.nextShotAt = now + cadence + Math.random() * 0.45;
}

function guardianAlive(runtime: GameRuntime): boolean {
  return runtime.enemies.some(
    (enemy) => enemy.alive && enemy.mesh.position.x > 140 && enemy.kind !== EnemyKind.core,
  );
}

function destroyEnemy(runtime: GameRuntime, enemy: EnemyActor): void {
  enemy.alive = false;
  runtime.scene.remove(enemy.mesh);
  runtime.player.score +=
    enemy.kind === EnemyKind.core ? 5000 : enemy.kind === EnemyKind.turret ? 500 : 150;
  spawnExplosion(runtime, {
    position: enemy.mesh.position,
    color: enemy.kind === EnemyKind.core ? 0xff2a00 : 0xff6a22,
    count: enemy.kind === EnemyKind.core ? 42 : 15,
  });
  if (enemy.kind === EnemyKind.core) {
    runtime.phase = Phase.victory;
    runtime.ui.setPhase(runtime.phase);
    runtime.ui.showResult(true, runtime.player.score);
  }
}

function hitEnemy(runtime: GameRuntime, shot: Shot): boolean {
  for (const enemy of runtime.enemies) {
    if (!enemy.alive || !enemy.active) continue;
    const radius =
      enemy.kind === EnemyKind.core ? 1.5 : enemy.kind === EnemyKind.turret ? 0.9 : 0.72;
    const target = enemyTarget(enemy);
    if (!isHit(shot.mesh.position, target, radius)) continue;
    if (enemy.kind === EnemyKind.core && guardianAlive(runtime)) {
      spawnExplosion(runtime, { position: shot.mesh.position, color: 0xbfeaff, count: 4 });
      return true;
    }
    enemy.hp -= shot.damage;
    runtime.player.score += 20;
    if (enemy.hp <= 0) destroyEnemy(runtime, enemy);
    return true;
  }
  return false;
}

function damagePlayer(runtime: GameRuntime, now: number): void {
  const result = takeDamage(runtime.player, now);
  if (!result.wasHit) return;
  runtime.player.lives = result.lives;
  runtime.player.invulnerableUntil = now + 3;
  spawnExplosion(runtime, {
    position: runtime.player.model.root.position,
    color: 0xff4a20,
    count: 18,
  });
  if (runtime.player.lives <= 0) {
    runtime.phase = Phase.gameOver;
    runtime.ui.setPhase(runtime.phase);
    runtime.ui.showResult(false, runtime.player.score);
    return;
  }
  const checkpoint = checkpointFor(runtime.player.model.root.position.x);
  const height = groundHeightAt(checkpoint, 0);
  runtime.player.model.root.position.set(checkpoint, height, 0);
  runtime.player.velocityY = 0;
  runtime.player.weapon = Weapon.rifle;
  runtime.ui.toast(`损失一条命，从 ${checkpoint}m 检查点复活`);
}

function updateShotList(runtime: GameRuntime, update: ShotUpdate): void {
  for (let index = update.shots.length - 1; index >= 0; index -= 1) {
    const shot = update.shots[index];
    if (shot === undefined) continue;
    shot.life -= update.delta;
    shot.mesh.position.addScaledVector(shot.velocity, update.delta);
    const playerHit =
      shot.enemyOwned &&
      isHit(
        shot.mesh.position,
        runtime.player.model.root.position.clone().add(new THREE.Vector3(0, 0.9, 0)),
        0.28,
      );
    const enemyHit = !shot.enemyOwned && hitEnemy(runtime, shot);
    if (playerHit) damagePlayer(runtime, update.now);
    if (shot.life <= 0 || playerHit || enemyHit || Math.abs(shot.mesh.position.z) > 15) {
      runtime.scene.remove(shot.mesh);
      update.shots.splice(index, 1);
    }
  }
}

export function updateCombat(runtime: GameRuntime, delta: number, now: number): void {
  firePlayer(runtime, now);
  updateShotList(runtime, { shots: runtime.playerShots, delta, now });
  updateShotList(runtime, { shots: runtime.enemyShots, delta, now });
}

export function bossHealthPercent(runtime: GameRuntime): number {
  const core = runtime.enemies.find((enemy) => enemy.kind === EnemyKind.core);
  if (core === undefined) return 0;
  return Math.max(0, Math.round((core.hp / CORE_HEALTH) * 100));
}
