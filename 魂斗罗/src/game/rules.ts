import type { Damageable, DamageResult, Vector } from "./types";

const CLASSIC_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
  "Enter",
] as const;

export function isHit(origin: Vector, target: Vector, radius: number): boolean {
  const dx = origin.x - target.x;
  const dy = origin.y - target.y;
  const dz = origin.z - target.z;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

export function takeDamage(target: Damageable, now: number): DamageResult {
  if (now < target.invulnerableUntil) {
    return { lives: target.lives, wasHit: false };
  }

  return { lives: Math.max(0, target.lives - 1), wasHit: true };
}

export function missionProgress(playerX: number, stageLength: number): number {
  return Math.round(Math.min(1, Math.max(0, playerX / stageLength)) * 100);
}

export function checkpointFor(playerX: number): number {
  if (playerX >= 100) return 100;
  if (playerX >= 50) return 50;
  return 0;
}

export function classicCodeComplete(keys: readonly string[]): boolean {
  if (keys.length < CLASSIC_CODE.length) return false;
  const tail = keys.slice(-CLASSIC_CODE.length);
  return tail.every((key, index) => key === CLASSIC_CODE[index]);
}
