import * as THREE from "three";
import type { GameAudio } from "./audio";
import type { Input } from "./input";
import {
  createContainerModel,
  createEnemyModel,
  createPickupModel,
  createPlayerModel,
} from "./models";
import { BRIDGES, CORE_HEALTH, ENEMY_SPAWNS, PICKUP_SPAWNS, VIEW_WIDTH } from "./stage";
import {
  type BridgeSegment,
  type Container,
  type EnemyActor,
  EnemyKind,
  type GameOptions,
  type GamePhase,
  Phase,
  type Pickup,
  type PlayerActor,
  type Shot,
  type Spark,
  Weapon,
} from "./types";
import type { GameUi } from "./ui";

export type GameRuntime = {
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  readonly input: Input;
  readonly audio: GameAudio;
  readonly ui: GameUi;
  readonly player: PlayerActor;
  readonly enemies: EnemyActor[];
  readonly playerShots: Shot[];
  readonly enemyShots: Shot[];
  readonly pickups: Pickup[];
  readonly containers: Container[];
  readonly bridges: BridgeSegment[];
  readonly sparks: Spark[];
  readonly triggers: Set<string>;
  phase: GamePhase;
  options: GameOptions;
  simulationTime: number;
  accumulator: number;
  cameraX: number;
  hitFlashUntil: number;
  waveId: number;
  bonusLives: boolean;
};
type RuntimeDependencies = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  input: Input;
  audio: GameAudio;
  ui: GameUi;
};
export function enemyHealth(kind: EnemyActor["kind"]): number {
  return kind === EnemyKind.core
    ? CORE_HEALTH
    : kind === EnemyKind.turret
      ? 8
      : kind === EnemyKind.mortar
        ? 10
        : 1;
}
export function createRuntime(deps: RuntimeDependencies): GameRuntime {
  const { scene } = deps;
  const model = createPlayerModel();
  model.root.position.set(1, 0, 0);
  scene.add(model.root);
  const player: PlayerActor = {
    model,
    lives: 3,
    score: 0,
    weapon: Weapon.rifle,
    rapid: false,
    hp: 1,
    maxHp: 1,
    facing: 1,
    pose: "standing",
    velocityX: 0,
    velocityY: 0,
    grounded: true,
    groundId: "bank-west",
    invulnerableUntil: 0,
    nextShotAt: 0,
    deadUntil: 0,
    dropThroughUntil: 0,
    aimX: 1,
    aimY: 0,
    lastDamage: "",
  };
  const enemies = ENEMY_SPAWNS.map((spawn, id): EnemyActor => {
    const built = createEnemyModel(spawn.kind);
    built.mesh.position.set(spawn.x, spawn.y, 0);
    scene.add(built.mesh);
    return {
      id,
      kind: spawn.kind,
      model: built.humanoid,
      mesh: built.mesh,
      hp: enemyHealth(spawn.kind),
      alive: true,
      active: false,
      nextShotAt: 0,
      velocityY: 0,
      facing: -1,
      hitUntil: 0,
    };
  });
  const pickups = PICKUP_SPAWNS.map((spawn): Pickup => {
    const mesh = createPickupModel(spawn.weapon);
    mesh.position.set(spawn.x, spawn.y, 0);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, weapon: spawn.weapon, collected: false, released: false, velocityY: 0 };
  });
  const containers = PICKUP_SPAWNS.map((spawn, pickupIndex): Container => {
    const mesh = createContainerModel(spawn.flying);
    mesh.position.set(spawn.x, spawn.y, 0);
    scene.add(mesh);
    return {
      mesh,
      pickupIndex,
      flying: spawn.flying,
      startX: spawn.x,
      startY: spawn.y,
      alive: true,
      hp: 2,
      activatedAt: -1,
    };
  });
  const timber = new THREE.MeshStandardMaterial({ color: 0xc78a47 });
  const bridges: BridgeSegment[] = [];
  for (const [bridge, bounds] of BRIDGES.entries()) {
    for (let start = bounds.start; start < bounds.end; start += 2) {
      const end = Math.min(bounds.end, start + 2);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(end - start - 0.04, 0.24, 1.2), timber);
      mesh.position.set((start + end) / 2, -0.12, 0);
      scene.add(mesh);
      bridges.push({
        id: `bridge-${bridge}-${start}`,
        bridge,
        start,
        end,
        mesh,
        destroyed: false,
        explodeAt: Number.POSITIVE_INFINITY,
      });
    }
  }
  return {
    ...deps,
    player,
    enemies,
    playerShots: [],
    enemyShots: [],
    pickups,
    containers,
    bridges,
    sparks: [],
    triggers: new Set(),
    phase: Phase.briefing,
    options: { mode: "classic", invincible: false },
    simulationTime: 0,
    accumulator: 0,
    cameraX: VIEW_WIDTH / 2 - 2,
    hitFlashUntil: 0,
    waveId: 0,
    bonusLives: false,
  };
}
