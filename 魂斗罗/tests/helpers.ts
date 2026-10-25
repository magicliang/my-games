import * as THREE from "three";
import { vi } from "vitest";
import type { GameAudio } from "../src/game/audio";
import type { Input } from "../src/game/input";
import { createRuntime, type GameRuntime } from "../src/game/runtime";
import type { Shot } from "../src/game/types";
import type { GameUi } from "../src/game/ui";

export function fixture() {
  const held = new Set<string>();
  const pressed = new Set<string>();
  const input = {
    held,
    pressed,
    isHeld: (code: string) => held.has(code),
    consume: (code: string) => {
      const result = pressed.has(code);
      pressed.delete(code);
      return result;
    },
    clear: () => {
      held.clear();
      pressed.clear();
    },
    consumeClassicCode: () => false,
  } as unknown as Input;
  const audio = {
    jump: vi.fn(),
    shoot: vi.fn(),
    explosion: vi.fn(),
    pickup: vi.fn(),
    resume: vi.fn(),
  } as unknown as GameAudio;
  const ui = {
    setPhase: vi.fn(),
    updateHud: vi.fn(),
    toast: vi.fn(),
    showResult: vi.fn(),
    onStart: vi.fn(),
    onRestart: vi.fn(),
    onResume: vi.fn(),
    onPause: vi.fn(),
    readOptions: () => ({ mode: "classic", invincible: false }),
    bindInput: vi.fn(),
  } as unknown as GameUi;
  const camera = new THREE.OrthographicCamera(-14, 14, 8, -8, 0.1, 220);
  camera.position.set(14, 3, 30);
  camera.lookAt(14, 3, 0);
  camera.updateMatrixWorld();
  const runtime = createRuntime({ scene: new THREE.Scene(), camera, input, audio, ui });
  return { runtime, held, pressed, ui, audio };
}

export function quietEnemies(runtime: GameRuntime): void {
  for (const enemy of runtime.enemies) {
    enemy.alive = false;
    runtime.scene.remove(enemy.mesh);
  }
}

export function projectile(x: number, y: number, enemyOwned = true): Shot {
  const mesh = new THREE.Mesh();
  mesh.position.set(x, y, 0);
  return {
    mesh,
    velocity: new THREE.Vector3(),
    enemyOwned,
    damage: 1,
    kind: enemyOwned ? "enemy" : "rifle",
    origin: mesh.position.clone(),
    direction: new THREE.Vector3(enemyOwned ? -1 : 1, 0, 0),
    age: 0,
    life: 2,
    hitIds: [],
  };
}
