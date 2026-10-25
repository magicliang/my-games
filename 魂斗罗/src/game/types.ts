import type * as THREE from "three";

export const Weapon = {
  rifle: "rifle",
  rapid: "rapid",
  spread: "spread",
  laser: "laser",
} as const;

export type WeaponKind = (typeof Weapon)[keyof typeof Weapon];

export const Phase = {
  briefing: "briefing",
  playing: "playing",
  paused: "paused",
  gameOver: "game-over",
  victory: "victory",
} as const;

export type GamePhase = (typeof Phase)[keyof typeof Phase];

export const EnemyKind = {
  runner: "runner",
  gunner: "gunner",
  turret: "turret",
  sniper: "sniper",
  core: "core",
} as const;

export type EnemyType = (typeof EnemyKind)[keyof typeof EnemyKind];

export type Vector = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type Damageable = {
  readonly lives: number;
  readonly invulnerableUntil: number;
};

export type DamageResult = {
  readonly lives: number;
  readonly wasHit: boolean;
};

export type HumanoidModel = {
  readonly root: THREE.Group;
  readonly leftArm: THREE.Group;
  readonly rightArm: THREE.Group;
  readonly leftLeg: THREE.Group;
  readonly rightLeg: THREE.Group;
  readonly muzzle: THREE.Object3D;
};

export type PlayerActor = {
  readonly model: HumanoidModel;
  lives: number;
  score: number;
  weapon: WeaponKind;
  velocityY: number;
  grounded: boolean;
  invulnerableUntil: number;
  nextShotAt: number;
};

export type EnemyActor = {
  readonly id: number;
  readonly kind: EnemyType;
  readonly model: HumanoidModel | null;
  readonly mesh: THREE.Object3D;
  hp: number;
  alive: boolean;
  active: boolean;
  nextShotAt: number;
};

export type Shot = {
  readonly mesh: THREE.Mesh;
  readonly velocity: THREE.Vector3;
  readonly enemyOwned: boolean;
  readonly damage: number;
  life: number;
};

export type Pickup = {
  readonly mesh: THREE.Group;
  readonly weapon: WeaponKind;
  collected: boolean;
};

export type Spark = {
  readonly mesh: THREE.Mesh;
  readonly velocity: THREE.Vector3;
  life: number;
};

export type HudState = {
  readonly lives: number;
  readonly score: number;
  readonly weapon: WeaponKind;
  readonly progress: number;
  readonly bossHealth: number;
  readonly bossActive: boolean;
};
