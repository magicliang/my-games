import type * as THREE from "three";

import type { GameAudio } from "./audio";
import type { Input } from "./input";
import { createEnemyModel, createPickupModel, createPlayerModel } from "./models";
import { CORE_HEALTH, ENEMY_SPAWNS, PICKUP_SPAWNS } from "./stage";
import {
  type EnemyActor,
  EnemyKind,
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
  readonly camera: THREE.PerspectiveCamera;
  readonly input: Input;
  readonly audio: GameAudio;
  readonly ui: GameUi;
  readonly player: PlayerActor;
  readonly enemies: EnemyActor[];
  readonly playerShots: Shot[];
  readonly enemyShots: Shot[];
  readonly pickups: Pickup[];
  readonly sparks: Spark[];
  readonly triggers: Set<string>;
  phase: GamePhase;
};

type RuntimeDependencies = {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly input: Input;
  readonly audio: GameAudio;
  readonly ui: GameUi;
};

function enemyHealth(kind: EnemyActor["kind"]): number {
  switch (kind) {
    case EnemyKind.runner:
      return 1;
    case EnemyKind.gunner:
      return 2;
    case EnemyKind.sniper:
      return 2;
    case EnemyKind.turret:
      return 5;
    case EnemyKind.core:
      return CORE_HEALTH;
  }
}

export function createRuntime(dependencies: RuntimeDependencies): GameRuntime {
  const { scene, camera, input, audio, ui } = dependencies;
  const playerModel = createPlayerModel();
  playerModel.root.position.set(0, 0.1, 0);
  scene.add(playerModel.root);
  const player: PlayerActor = {
    model: playerModel,
    lives: 3,
    score: 0,
    weapon: Weapon.rifle,
    velocityY: 0,
    grounded: true,
    invulnerableUntil: 0,
    nextShotAt: 0,
  };
  const enemies = ENEMY_SPAWNS.map((spawn, id) => {
    const model = createEnemyModel(spawn.kind);
    model.mesh.position.set(spawn.x, spawn.y, spawn.z);
    model.mesh.rotation.y = Math.PI;
    scene.add(model.mesh);
    return {
      id,
      kind: spawn.kind,
      model: model.humanoid,
      mesh: model.mesh,
      hp: enemyHealth(spawn.kind),
      alive: true,
      active: false,
      nextShotAt: 0,
    } satisfies EnemyActor;
  });
  const pickups = PICKUP_SPAWNS.map((spawn) => {
    const mesh = createPickupModel(spawn.weapon);
    mesh.position.set(spawn.x, spawn.y, spawn.z);
    scene.add(mesh);
    return { mesh, weapon: spawn.weapon, collected: false } satisfies Pickup;
  });
  return {
    scene,
    camera,
    input,
    audio,
    ui,
    player,
    enemies,
    playerShots: [],
    enemyShots: [],
    pickups,
    sparks: [],
    triggers: new Set<string>(),
    phase: Phase.briefing,
  };
}
