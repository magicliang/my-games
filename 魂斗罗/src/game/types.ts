import type * as THREE from "three";

export const Weapon = {
  rifle: "rifle",
  machine: "machine",
  fire: "fire",
  spread: "spread",
  laser: "laser",
} as const;
export type WeaponKind = (typeof Weapon)[keyof typeof Weapon];
export type PickupKind = WeaponKind | "rapid" | "barrier" | "bomb";
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
  mortar: "mortar",
  core: "core",
} as const;
export type EnemyType = (typeof EnemyKind)[keyof typeof EnemyKind];
export type Vector = { readonly x: number; readonly y: number; readonly z: number };
export type Damageable = { readonly lives: number; readonly invulnerableUntil: number };
export type DamageResult = { readonly lives: number; readonly wasHit: boolean };
export type GameOptions = { mode: "classic" | "high-health"; invincible: boolean };
export type Pose = "standing" | "prone" | "jumping" | "swimming" | "diving" | "dead";
export type HumanoidModel = {
  readonly root: THREE.Group;
  readonly body: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly gun: THREE.Group;
  readonly muzzle: THREE.Object3D;
  readonly setPose: (pose: Pose, now: number, moving: boolean, angle: number) => void;
};
export type PlayerActor = {
  readonly model: HumanoidModel;
  lives: number;
  score: number;
  weapon: WeaponKind;
  rapid: boolean;
  hp: number;
  maxHp: number;
  facing: number;
  pose: Pose;
  velocityX: number;
  velocityY: number;
  grounded: boolean;
  groundId: string | null;
  invulnerableUntil: number;
  nextShotAt: number;
  deadUntil: number;
  dropThroughUntil: number;
  aimX: number;
  aimY: number;
  lastDamage: string;
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
  velocityY: number;
  facing: number;
  hitUntil: number;
};
export type Shot = {
  readonly mesh: THREE.Mesh;
  readonly velocity: THREE.Vector3;
  readonly enemyOwned: boolean;
  readonly damage: number;
  readonly kind: WeaponKind | "enemy" | "mortar";
  readonly origin: THREE.Vector3;
  readonly direction: THREE.Vector3;
  age: number;
  life: number;
  hitIds: number[];
};
export type Pickup = {
  readonly mesh: THREE.Group;
  readonly weapon: PickupKind;
  collected: boolean;
  released: boolean;
  velocityY: number;
};
export type Container = {
  readonly mesh: THREE.Group;
  readonly pickupIndex: number;
  readonly flying: boolean;
  readonly startX: number;
  readonly startY: number;
  alive: boolean;
  hp: number;
  activatedAt: number;
};
export type BridgeSegment = {
  readonly id: string;
  readonly bridge: number;
  readonly start: number;
  readonly end: number;
  readonly mesh: THREE.Object3D;
  destroyed: boolean;
  explodeAt: number;
};
export type Spark = { readonly mesh: THREE.Mesh; readonly velocity: THREE.Vector3; life: number };
export type HudState = {
  readonly lives: number;
  readonly score: number;
  readonly weapon: WeaponKind;
  readonly progress: number;
  readonly bossHealth: number;
  readonly bossActive: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly rapid: boolean;
  readonly mode: GameOptions["mode"];
  readonly invincible: boolean;
  readonly now: number;
  readonly lastDamage: string;
  readonly bonusLives: boolean;
};
