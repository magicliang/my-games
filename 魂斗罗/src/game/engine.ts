import { updateCombat } from "./combat";
import { updateEffects, updateStageEvents } from "./effects";
import { Control } from "./input";
import { createEnemyModel } from "./models";
import { animatePlayer, collectPickups, updateEnemies, updatePlayer } from "./movement";
import { enemyHealth, type GameRuntime } from "./runtime";
import { ENEMY_SPAWNS, PICKUP_SPAWNS, VIEW_WIDTH, WAVES } from "./stage";
import { floorAt } from "./terrain";
import { EnemyKind, type GameOptions, Phase, Weapon } from "./types";

export const FIXED_STEP = 1 / 60;
export function resetGame(runtime: GameRuntime): void {
  for (const objects of [runtime.playerShots, runtime.enemyShots, runtime.sparks]) {
    for (const item of objects) runtime.scene.remove(item.mesh);
    objects.length = 0;
  }
  for (const enemy of runtime.enemies.slice(ENEMY_SPAWNS.length)) runtime.scene.remove(enemy.mesh);
  runtime.enemies.length = ENEMY_SPAWNS.length;
  runtime.enemies.forEach((enemy, i) => {
    const spawn = ENEMY_SPAWNS[i];
    if (!spawn) return;
    enemy.mesh.position.set(spawn.x, spawn.y, 0);
    enemy.mesh.scale.set(1, 1, 1);
    enemy.mesh.visible = true;
    enemy.hp = enemyHealth(enemy.kind);
    enemy.alive = true;
    enemy.active = false;
    enemy.nextShotAt = 0;
    enemy.velocityY = 0;
    enemy.facing = -1;
    enemy.hitUntil = 0;
  });
  runtime.pickups.forEach((pickup, i) => {
    const spawn = PICKUP_SPAWNS[i];
    if (!spawn) return;
    pickup.mesh.position.set(spawn.x, spawn.y, 0);
    pickup.mesh.visible = false;
    pickup.collected = false;
    pickup.released = false;
    pickup.velocityY = 0;
  });
  for (const container of runtime.containers) {
    container.alive = true;
    container.hp = 2;
    container.activatedAt = -1;
    container.mesh.visible = true;
    container.mesh.position.set(container.startX, container.startY, 0);
  }
  for (const bridge of runtime.bridges) {
    bridge.destroyed = false;
    bridge.mesh.visible = true;
    bridge.explodeAt = Number.POSITIVE_INFINITY;
  }
  const p = runtime.player;
  Object.assign(p, {
    lives: 3,
    score: 0,
    weapon: Weapon.rifle,
    rapid: false,
    hp: runtime.options.mode === "high-health" ? 5 : 1,
    maxHp: runtime.options.mode === "high-health" ? 5 : 1,
    facing: 1,
    pose: "standing",
    velocityX: 0,
    velocityY: 0,
    grounded: true,
    groundId: "bank-west",
    invulnerableUntil: 1.5,
    nextShotAt: 0,
    deadUntil: 0,
    dropThroughUntil: 0,
    aimX: 1,
    aimY: 0,
    lastDamage: "",
  });
  p.model.root.position.set(1, 0, 0);
  p.model.root.visible = true;
  runtime.simulationTime = 0;
  runtime.accumulator = 0;
  runtime.cameraX = VIEW_WIDTH / 2 - 2;
  runtime.hitFlashUntil = 0;
  runtime.waveId = 0;
  runtime.bonusLives = false;
  runtime.triggers.clear();
  runtime.input.clear();
  animatePlayer(runtime, 2);
}
export function startGame(runtime: GameRuntime, options: GameOptions = runtime.options): void {
  const cheat = runtime.phase === Phase.briefing && runtime.input.consumeClassicCode();
  runtime.options = { ...options };
  resetGame(runtime);
  if (cheat) {
    runtime.player.lives = 30;
    runtime.bonusLives = true;
  }
  runtime.phase = Phase.playing;
  runtime.audio.resume();
  runtime.ui.setPhase(runtime.phase);
  runtime.ui.toast(cheat ? "30 条命辅助已开启" : "向右推进 · J 射击，K / 空格跳跃");
}
export function restartGame(runtime: GameRuntime): void {
  startGame(runtime, runtime.options);
}
export function togglePause(runtime: GameRuntime): void {
  if (runtime.phase !== Phase.playing && runtime.phase !== Phase.paused) return;
  runtime.phase = runtime.phase === Phase.playing ? Phase.paused : Phase.playing;
  runtime.accumulator = 0;
  runtime.input.clear();
  runtime.ui.setPhase(runtime.phase);
}
function respawn(runtime: GameRuntime): void {
  const p = runtime.player;
  if (runtime.simulationTime < p.deadUntil) return;
  const left = runtime.cameraX - VIEW_WIDTH / 2 + 1.5;
  let x = Math.max(left, Math.min(p.model.root.position.x, runtime.cameraX + 8));
  let surface = floorAt(runtime, x);
  if (!surface) {
    for (let d = 0.5; d <= VIEW_WIDTH - 3; d += 0.5) {
      for (const candidate of [x - d, x + d]) {
        if (candidate < left || candidate > Math.min(145.4, runtime.cameraX + VIEW_WIDTH / 2 - 1.5))
          continue;
        surface = floorAt(runtime, candidate);
        if (surface) {
          x = candidate;
          break;
        }
      }
      if (surface) break;
    }
  }
  p.model.root.position.set(x, (surface?.y ?? 0) + 2.8, 0);
  p.hp = p.maxHp;
  p.pose = "jumping";
  p.velocityX = 0;
  p.velocityY = 0;
  p.grounded = false;
  p.groundId = null;
  p.deadUntil = 0;
  p.nextShotAt = runtime.simulationTime;
  p.invulnerableUntil = runtime.simulationTime + 2;
}
function spawnWaves(runtime: GameRuntime): void {
  for (const [index, x] of WAVES.entries()) {
    const key = `wave-${index}`;
    if (runtime.player.model.root.position.x < x || runtime.triggers.has(key)) continue;
    runtime.triggers.add(key);
    for (let i = 0; i < 3; i++) {
      const model = createEnemyModel(EnemyKind.runner);
      const startX = runtime.cameraX + VIEW_WIDTH / 2 + i * 1.7;
      model.mesh.position.set(startX, 0, 0);
      runtime.scene.add(model.mesh);
      runtime.enemies.push({
        id: ENEMY_SPAWNS.length + runtime.waveId++,
        kind: EnemyKind.runner,
        model: model.humanoid,
        mesh: model.mesh,
        hp: 1,
        alive: true,
        active: false,
        nextShotAt: 0,
        velocityY: 0,
        facing: -1,
        hitUntil: 0,
      });
    }
  }
}
export function advanceGame(runtime: GameRuntime, wallDelta: number): void {
  if (runtime.input.consume(Control.pause)) togglePause(runtime);
  if (runtime.phase !== Phase.playing) {
    runtime.accumulator = 0;
    return;
  }
  runtime.accumulator += Math.max(0, Math.min(wallDelta, 0.1));
  while (runtime.accumulator + 1e-9 >= FIXED_STEP && runtime.phase === Phase.playing) {
    runtime.accumulator -= FIXED_STEP;
    runtime.simulationTime += FIXED_STEP;
    const now = runtime.simulationTime;
    updateStageEvents(runtime);
    if (runtime.player.pose === "dead") {
      respawn(runtime);
      animatePlayer(runtime, now);
    } else updatePlayer(runtime, FIXED_STEP, now);
    if (runtime.phase !== Phase.playing) break;
    runtime.cameraX = Math.max(
      runtime.cameraX,
      Math.min(136, runtime.player.model.root.position.x + 6),
    );
    spawnWaves(runtime);
    updateEnemies(runtime, FIXED_STEP, now);
    updateCombat(runtime, FIXED_STEP, now);
    updateEffects(runtime, FIXED_STEP, now);
    collectPickups(runtime);
  }
}
