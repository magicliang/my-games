import * as THREE from "three";
import { spawnExplosion } from "./effects";
import { Control } from "./input";
import { createProjectile } from "./models";
import type { GameRuntime } from "./runtime";
import { CORE_HEALTH, VIEW_WIDTH } from "./stage";
import { type EnemyActor, EnemyKind, Phase, type Shot, Weapon, type WeaponKind } from "./types";

// Deliberate local tuning. FC slot counts/cadences still need frame-by-frame measurement.
export const WEAPON_RULES: Record<WeaponKind, { delay: number; speed: number; limit: number }> = {
  rifle: { delay: 0.13, speed: 22, limit: 4 },
  machine: { delay: 0.1, speed: 26, limit: 6 },
  fire: { delay: 0.2, speed: 18, limit: 4 },
  spread: { delay: 0.18, speed: 23, limit: 10 },
  laser: { delay: 0.13, speed: 30, limit: 5 },
};
export type HitBox = { left: number; right: number; bottom: number; top: number };
export function segmentHitsBox(from: THREE.Vector3, to: THREE.Vector3, box: HitBox): boolean {
  let enter = 0;
  let exit = 1;
  for (const [start, diff, min, max] of [
    [from.x, to.x - from.x, box.left, box.right],
    [from.y, to.y - from.y, box.bottom, box.top],
  ]) {
    if (start === undefined || diff === undefined || min === undefined || max === undefined)
      continue;
    if (Math.abs(diff) < 1e-9) {
      if (start < min || start > max) return false;
    } else {
      const a = (min - start) / diff;
      const b = (max - start) / diff;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (enter > exit) return false;
    }
  }
  return true;
}
export function playerHitBox(runtime: GameRuntime): HitBox {
  const p = runtime.player;
  const { x, y } = p.model.root.position;
  const prone = p.pose === "prone";
  const swim = p.pose === "swimming";
  return {
    left: x - (prone ? 0.7 : 0.28),
    right: x + (prone ? 0.9 : 0.28),
    bottom: y + 0.12,
    top: y + (prone ? 0.52 : swim ? 1.32 : 1.72),
  };
}
function addShot(
  runtime: GameRuntime,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  kind: Shot["kind"],
  speed: number,
): Shot {
  const enemyOwned = kind === "enemy" || kind === "mortar";
  const mesh = createProjectile(enemyOwned, kind === Weapon.laser, kind === Weapon.fire);
  mesh.position.copy(origin);
  mesh.rotation.z = Math.atan2(direction.y, direction.x);
  runtime.scene.add(mesh);
  const shot: Shot = {
    mesh,
    velocity: direction.clone().multiplyScalar(speed),
    enemyOwned,
    damage: 1,
    kind,
    origin: origin.clone(),
    direction: direction.clone(),
    age: 0,
    life: 4,
    hitIds: [],
  };
  (enemyOwned ? runtime.enemyShots : runtime.playerShots).push(shot);
  return shot;
}
function clearShots(runtime: GameRuntime, shots: Shot[]): void {
  for (const shot of shots) runtime.scene.remove(shot.mesh);
  shots.length = 0;
}
export function firePlayer(runtime: GameRuntime, now: number): void {
  const p = runtime.player;
  const pressed = runtime.input.consume(Control.fire);
  if (p.pose === "dead" || p.pose === "diving") return;
  if (
    !(pressed || (p.weapon === Weapon.machine && runtime.input.isHeld(Control.fire))) ||
    now + 1e-9 < p.nextShotAt
  )
    return;
  const spec = WEAPON_RULES[p.weapon];
  const count = p.weapon === Weapon.spread || p.weapon === Weapon.laser ? 5 : 1;
  if (p.weapon === Weapon.laser) clearShots(runtime, runtime.playerShots);
  if (runtime.playerShots.length + count > spec.limit) return;
  p.nextShotAt = now + spec.delay;
  const direction = new THREE.Vector3(p.aimX, p.aimY, 0).normalize();
  const origin = p.model.root.position.clone();
  origin.y += p.pose === "prone" ? 0.32 : p.pose === "swimming" ? 1.05 : 1.2;
  if (p.pose === "prone") origin.x += 0.55 * p.facing;
  origin.addScaledVector(direction, 0.9);
  const speed = spec.speed * (p.rapid && p.weapon !== Weapon.laser ? 1.5 : 1);
  const angle = Math.atan2(direction.y, direction.x);
  for (let i = 0; i < count; i++) {
    const offset = p.weapon === Weapon.spread ? (i - 2) * 0.16 : 0;
    const vector = new THREE.Vector3(Math.cos(angle + offset), Math.sin(angle + offset), 0);
    const start = origin.clone();
    if (p.weapon === Weapon.laser) start.addScaledVector(vector, i * 0.4);
    addShot(runtime, start, vector, p.weapon, speed);
  }
  runtime.audio.shoot(p.weapon === Weapon.laser ? "laser" : "rifle");
}
export function fireEnemy(runtime: GameRuntime, enemy: EnemyActor, now: number): void {
  if (
    now < enemy.nextShotAt ||
    enemy.kind === EnemyKind.runner ||
    enemy.kind === EnemyKind.core ||
    runtime.enemyShots.length >= 36
  )
    return;
  enemy.mesh.updateMatrixWorld(true);
  const muzzle = enemy.model?.muzzle ?? enemy.mesh.getObjectByName("enemy-muzzle");
  const origin = muzzle?.getWorldPosition(new THREE.Vector3()) ?? enemy.mesh.position.clone();
  origin.z = 0;
  const player = runtime.player.model.root.position;
  const target = new THREE.Vector3(player.x, player.y + 1.15, 0);
  if (enemy.kind === EnemyKind.mortar) {
    const velocity = new THREE.Vector3(-4.2, 5.8, 0);
    addShot(runtime, origin, velocity.clone().normalize(), "mortar", velocity.length());
  } else {
    const direction = target.sub(origin).normalize();
    const angle = (Math.round(Math.atan2(direction.y, direction.x) / (Math.PI / 8)) * Math.PI) / 8;
    addShot(runtime, origin, new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0), "enemy", 5.8);
  }
  enemy.nextShotAt =
    now + (enemy.kind === EnemyKind.turret ? 1.3 : enemy.kind === EnemyKind.mortar ? 1.8 : 2.1);
}
function destroyEnemy(runtime: GameRuntime, enemy: EnemyActor): void {
  enemy.alive = false;
  enemy.mesh.visible = false;
  runtime.player.score +=
    enemy.kind === EnemyKind.core ? 10000 : enemy.kind === EnemyKind.runner ? 100 : 500;
  spawnExplosion(runtime, {
    position: enemy.mesh.position,
    color: 0xff653a,
    count: enemy.kind === EnemyKind.core ? 36 : 8,
  });
  if (enemy.kind === EnemyKind.core) {
    runtime.phase = Phase.victory;
    for (const defender of runtime.enemies) {
      defender.alive = false;
      defender.mesh.visible = false;
    }
    clearShots(runtime, runtime.enemyShots);
    runtime.input.clear();
    runtime.ui.setPhase(runtime.phase);
    runtime.ui.showResult(true, runtime.player.score);
  }
}
function hitTargets(
  runtime: GameRuntime,
  shot: Shot,
  previous: THREE.Vector3,
  now: number,
): boolean {
  let hit = false;
  for (const enemy of runtime.enemies) {
    if (!enemy.alive || !enemy.active || shot.hitIds.includes(enemy.id)) continue;
    const { x, y } = enemy.mesh.position;
    const core = enemy.kind === EnemyKind.core;
    const turret = enemy.kind === EnemyKind.turret || enemy.kind === EnemyKind.mortar;
    const box = {
      left: x - (core ? 0.85 : turret ? 0.65 : 0.5),
      right: x + (core ? 0.85 : turret ? 0.65 : 0.5),
      bottom: core ? y - 0.7 : y,
      top: core ? y + 0.7 : y + (turret ? 1.1 : 1.75),
    };
    if (!segmentHitsBox(previous, shot.mesh.position, box)) continue;
    shot.hitIds.push(enemy.id);
    enemy.hp -= shot.damage;
    enemy.hitUntil = now + 0.12;
    hit = true;
    if (enemy.hp <= 0) destroyEnemy(runtime, enemy);
    if (shot.kind !== Weapon.laser) return true;
  }
  for (const container of runtime.containers) {
    if (
      !container.alive ||
      container.activatedAt < 0 ||
      shot.hitIds.includes(-container.pickupIndex - 1)
    )
      continue;
    const { x, y } = container.mesh.position;
    if (
      !segmentHitsBox(previous, shot.mesh.position, {
        left: x - 0.65,
        right: x + 0.65,
        bottom: y - 0.4,
        top: y + 0.4,
      })
    )
      continue;
    shot.hitIds.push(-container.pickupIndex - 1);
    container.hp--;
    hit = true;
    if (container.hp <= 0) {
      container.alive = false;
      container.mesh.visible = false;
      const pickup = runtime.pickups[container.pickupIndex];
      if (pickup) {
        pickup.released = true;
        pickup.mesh.visible = true;
        pickup.mesh.position.copy(container.mesh.position);
        pickup.velocityY = 4;
      }
      spawnExplosion(runtime, { position: container.mesh.position, color: 0xffbd64, count: 8 });
    }
    if (shot.kind !== Weapon.laser) return true;
  }
  return hit && shot.kind !== Weapon.laser;
}
export function damagePlayer(
  runtime: GameRuntime,
  now: number,
  cause = "敌弹命中",
  fatal = false,
): void {
  const p = runtime.player;
  if (p.pose === "dead" || runtime.phase !== Phase.playing) return;
  if (!fatal && (runtime.options.invincible || now < p.invulnerableUntil || p.pose === "diving"))
    return;
  p.lastDamage = cause;
  runtime.hitFlashUntil = now + 0.2;
  p.hp = fatal ? 0 : p.hp - 1;
  if (p.hp > 0) {
    p.invulnerableUntil = now + 0.8;
    runtime.ui.toast(`${cause} · 体力 ${p.hp}/${p.maxHp}`);
    return;
  }
  // Assist invincibility includes pit rescue; still return to a safe on-screen surface.
  if (!runtime.options.invincible) p.lives = Math.max(0, p.lives - 1);
  p.weapon = Weapon.rifle;
  p.rapid = false;
  p.velocityX = 0;
  p.velocityY = 0;
  p.pose = "dead";
  p.model.setPose("dead", now, false, 0);
  p.model.root.visible = true;
  p.deadUntil = now + 0.7;
  p.grounded = false;
  p.groundId = null;
  clearShots(runtime, runtime.playerShots);
  spawnExplosion(runtime, { position: p.model.root.position, color: 0xff4938, count: 14 });
  runtime.ui.toast(`${cause} · ${runtime.options.invincible ? "辅助救援" : "阵亡，屏内复活"}`);
  if (p.lives <= 0) {
    runtime.phase = Phase.gameOver;
    runtime.input.clear();
    runtime.ui.setPhase(runtime.phase);
    runtime.ui.showResult(false, p.score);
  }
}
function updateShots(runtime: GameRuntime, shots: Shot[], delta: number, now: number): void {
  for (let i = shots.length - 1; i >= 0; i--) {
    const shot = shots[i];
    if (!shot) continue;
    const before = shot.mesh.position.clone();
    shot.age += delta;
    shot.life -= delta;
    if (shot.kind === "mortar") shot.velocity.y -= 8 * delta;
    shot.mesh.position.addScaledVector(shot.velocity, delta);
    if (shot.kind === Weapon.fire) {
      const wave = Math.sin(shot.age * 20) * 0.48;
      shot.mesh.position.copy(shot.origin).addScaledVector(shot.velocity, shot.age);
      shot.mesh.position.addScaledVector(shot.direction, (Math.cos(shot.age * 20) - 1) * 0.48);
      shot.mesh.position.x -= shot.direction.y * wave;
      shot.mesh.position.y += shot.direction.x * wave;
    }
    let hit = false;
    if (shot.enemyOwned && runtime.player.pose !== "dead" && runtime.player.pose !== "diving") {
      const box = playerHitBox(runtime);
      hit = segmentHitsBox(before, shot.mesh.position, {
        left: box.left - 0.12,
        right: box.right + 0.12,
        bottom: box.bottom - 0.12,
        top: box.top + 0.12,
      });
      if (hit) damagePlayer(runtime, now, shot.kind === "mortar" ? "堡垒抛射弹命中" : "敌弹命中");
    } else if (!shot.enemyOwned) hit = hitTargets(runtime, shot, before, now);
    const outside =
      Math.abs(shot.mesh.position.x - runtime.cameraX) > VIEW_WIDTH / 2 + 1 ||
      shot.mesh.position.y < -6 ||
      shot.mesh.position.y > 12;
    if (hit || outside || shot.life <= 0) {
      runtime.scene.remove(shot.mesh);
      shots.splice(i, 1);
    }
    if (runtime.phase !== Phase.playing) break;
  }
}
export function updateCombat(runtime: GameRuntime, delta: number, now: number): void {
  firePlayer(runtime, now);
  updateShots(runtime, runtime.playerShots, delta, now);
  if (runtime.phase === Phase.playing) updateShots(runtime, runtime.enemyShots, delta, now);
}
export function bossHealthPercent(runtime: GameRuntime): number {
  const core = runtime.enemies.find((e) => e.kind === EnemyKind.core);
  return Math.max(0, Math.round(((core?.hp ?? 0) / CORE_HEALTH) * 100));
}
