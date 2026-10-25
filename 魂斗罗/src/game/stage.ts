import { EnemyKind, type EnemyType, Weapon, type WeaponKind } from "./types";

export const STAGE_LENGTH = 150;
export const CORE_HEALTH = 24;

export type EnemySpawn = {
  readonly kind: EnemyType;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type PickupSpawn = {
  readonly weapon: WeaponKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export const ENEMY_SPAWNS: readonly EnemySpawn[] = [
  { kind: EnemyKind.runner, x: 13, y: 0, z: -2 },
  { kind: EnemyKind.gunner, x: 19, y: 0, z: 2.7 },
  { kind: EnemyKind.runner, x: 25, y: 0, z: 1.5 },
  { kind: EnemyKind.sniper, x: 31, y: 2.1, z: -3.8 },
  { kind: EnemyKind.runner, x: 41, y: 0, z: -1.8 },
  { kind: EnemyKind.gunner, x: 49, y: 0, z: 2.3 },
  { kind: EnemyKind.runner, x: 58, y: 1.2, z: -2 },
  { kind: EnemyKind.sniper, x: 66, y: 3.4, z: 3.5 },
  { kind: EnemyKind.runner, x: 72, y: 0, z: 1 },
  { kind: EnemyKind.gunner, x: 77, y: 0, z: -2.6 },
  { kind: EnemyKind.runner, x: 89, y: 0.15, z: 0.8 },
  { kind: EnemyKind.turret, x: 96, y: 0, z: -3.3 },
  { kind: EnemyKind.runner, x: 103, y: 0, z: 1.7 },
  { kind: EnemyKind.gunner, x: 110, y: 0, z: -2 },
  { kind: EnemyKind.turret, x: 118, y: 0, z: 3.2 },
  { kind: EnemyKind.runner, x: 123, y: 0, z: -1.2 },
  { kind: EnemyKind.gunner, x: 129, y: 0, z: 2.4 },
  { kind: EnemyKind.sniper, x: 145, y: 5, z: 0 },
  { kind: EnemyKind.turret, x: 144, y: 0, z: -3.1 },
  { kind: EnemyKind.turret, x: 144, y: 0, z: 3.1 },
  { kind: EnemyKind.core, x: 148, y: 1.9, z: 0 },
] as const;

export const PICKUP_SPAWNS: readonly PickupSpawn[] = [
  { weapon: Weapon.rapid, x: 18, y: 1.3, z: -3.4 },
  { weapon: Weapon.spread, x: 63, y: 2.7, z: 0 },
  { weapon: Weapon.laser, x: 108, y: 1.3, z: 3 },
] as const;
