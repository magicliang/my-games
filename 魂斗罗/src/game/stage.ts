import { EnemyKind, type EnemyType, type PickupKind } from "./types";

export const STAGE_LENGTH = 150;
export const CORE_HEALTH = 32;
export const VIEW_WIDTH = 28;
export const GRAVITY = 24;
export const RUN_SPEED = 5.4;
export const JUMP_SPEED = 12;
export const WATER_Y = -2.4;

export type Surface = {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly y: number;
  readonly kind: "ground" | "platform" | "water" | "bridge";
};
// These world units are tuned for this rendition, not claimed as extracted FC coordinates.
export const SURFACES: readonly Surface[] = [
  { id: "bank-west", start: -3, end: 24, y: 0, kind: "ground" },
  { id: "river-one", start: 24, end: 39, y: WATER_Y, kind: "water" },
  { id: "island", start: 39, end: 69, y: 0, kind: "ground" },
  { id: "river-two", start: 69, end: 82, y: WATER_Y, kind: "water" },
  { id: "bank-east", start: 82, end: 121, y: 0, kind: "ground" },
  { id: "fortress-bank", start: 125, end: 153, y: 0, kind: "ground" },
  { id: "ledge-one", start: 10, end: 17, y: 2.5, kind: "platform" },
  { id: "ledge-two", start: 43, end: 50, y: 2.2, kind: "platform" },
  { id: "ledge-three", start: 49, end: 57, y: 4.4, kind: "platform" },
  { id: "ledge-four", start: 57, end: 65, y: 2.2, kind: "platform" },
  { id: "ledge-five", start: 88, end: 96, y: 2.4, kind: "platform" },
  { id: "ledge-six", start: 98, end: 107, y: 4.6, kind: "platform" },
  { id: "ledge-seven", start: 111, end: 120, y: 2.5, kind: "platform" },
];
export const BRIDGES = [
  { start: 24, end: 39 },
  { start: 69, end: 82 },
] as const;
export type EnemySpawn = {
  readonly kind: EnemyType;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};
export const ENEMY_SPAWNS: readonly EnemySpawn[] = [
  { kind: EnemyKind.runner, x: 15, y: 0, z: 0 },
  { kind: EnemyKind.sniper, x: 15.5, y: 2.5, z: 0 },
  { kind: EnemyKind.runner, x: 21, y: 0, z: 0 },
  { kind: EnemyKind.gunner, x: 22, y: 0, z: 0 },
  { kind: EnemyKind.turret, x: 42, y: 0, z: 0 },
  { kind: EnemyKind.runner, x: 46, y: 0, z: 0 },
  { kind: EnemyKind.sniper, x: 54, y: 4.4, z: 0 },
  { kind: EnemyKind.gunner, x: 61, y: 2.2, z: 0 },
  { kind: EnemyKind.runner, x: 65, y: 0, z: 0 },
  { kind: EnemyKind.turret, x: 84, y: 0, z: 0 },
  { kind: EnemyKind.runner, x: 91, y: 0, z: 0 },
  { kind: EnemyKind.sniper, x: 94, y: 2.4, z: 0 },
  { kind: EnemyKind.gunner, x: 103, y: 4.6, z: 0 },
  { kind: EnemyKind.runner, x: 110, y: 0, z: 0 },
  { kind: EnemyKind.turret, x: 116, y: 0, z: 0 },
  { kind: EnemyKind.sniper, x: 118, y: 2.5, z: 0 },
  { kind: EnemyKind.runner, x: 126, y: 0, z: 0 },
  { kind: EnemyKind.gunner, x: 133, y: 0, z: 0 },
  { kind: EnemyKind.sniper, x: 146, y: 6.5, z: 0 },
  { kind: EnemyKind.mortar, x: 144, y: 3.2, z: 0 },
  { kind: EnemyKind.mortar, x: 147, y: 4.8, z: 0 },
  { kind: EnemyKind.core, x: 147, y: 1.05, z: 0 },
];
export type PickupSpawn = {
  readonly weapon: PickupKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly flying: boolean;
};
export const PICKUP_SPAWNS: readonly PickupSpawn[] = [
  { weapon: "machine", x: 8, y: 3.6, z: 0, flying: true },
  { weapon: "rapid", x: 20, y: 1.3, z: 0, flying: false },
  { weapon: "spread", x: 31, y: 3.2, z: 0, flying: true },
  { weapon: "fire", x: 47, y: 3.5, z: 0, flying: false },
  { weapon: "barrier", x: 63, y: 3.2, z: 0, flying: true },
  { weapon: "spread", x: 77, y: 3.2, z: 0, flying: true },
  { weapon: "laser", x: 93, y: 3.7, z: 0, flying: false },
  { weapon: "rapid", x: 108, y: 1.3, z: 0, flying: false },
  { weapon: "spread", x: 124, y: 3.2, z: 0, flying: true },
];
export const WAVES = [18, 44, 59, 85, 105, 125] as const;
