import * as THREE from "three";
import { GameAudio } from "./audio";
import { bossHealthPercent } from "./combat";
import { advanceGame, restartGame, startGame, togglePause } from "./engine";
import { Input } from "./input";
import { missionProgress } from "./rules";
import { createRuntime, type GameRuntime } from "./runtime";
import { STAGE_LENGTH, VIEW_WIDTH } from "./stage";
import { Phase } from "./types";
import type { GameUi } from "./ui";
import { createWorld } from "./world";

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.OrthographicCamera;
  private readonly runtime: GameRuntime;
  private lastFrame: number | null = null;
  private readonly frameTimes: number[] = [];
  private readonly renderTimes: number[] = [];
  private readonly debug: HTMLOutputElement | null;
  private hudElapsed = 0;

  constructor(container: HTMLElement, ui: GameUi) {
    const scene = new THREE.Scene();
    createWorld(scene);
    this.camera = new THREE.OrthographicCamera(-VIEW_WIDTH / 2, VIEW_WIDTH / 2, 8, -8, 0.1, 120);
    this.camera.position.set(12, 2.8, 30);
    this.camera.lookAt(12, 2.8, 0);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.append(this.renderer.domElement);
    const input = new Input();
    ui.bindInput(input);
    this.runtime = createRuntime({ scene, camera: this.camera, input, audio: new GameAudio(), ui });
    input.onDeactivate(() => {
      if (this.runtime.phase === Phase.playing) togglePause(this.runtime);
      this.lastFrame = null;
    });
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      if (this.runtime.phase === Phase.playing) togglePause(this.runtime);
      ui.toast("画面上下文中断，恢复后可继续");
    });
    this.debug =
      import.meta.env.DEV && new URLSearchParams(location.search).has("test")
        ? document.createElement("output")
        : null;
    if (this.debug) {
      this.debug.id = "debug-state";
      this.debug.hidden = true;
      container.append(this.debug);
      Object.assign(window, {
        __contra: {
          runtime: this.runtime,
          advance: (delta: number) => advanceGame(this.runtime, delta),
          snapshot: () => this.snapshot(),
        },
      });
    }
    this.resize();
  }
  run(): void {
    this.runtime.ui.onStart(() => {
      this.lastFrame = null;
      startGame(this.runtime, this.runtime.ui.readOptions());
    });
    this.runtime.ui.onRestart(() => {
      this.lastFrame = null;
      restartGame(this.runtime);
    });
    this.runtime.ui.onResume(() => {
      this.lastFrame = null;
      if (this.runtime.phase === Phase.paused) togglePause(this.runtime);
    });
    this.runtime.ui.onPause(() => {
      if (this.runtime.phase === Phase.playing) togglePause(this.runtime);
    });
    window.addEventListener("resize", () => this.resize());
    this.renderer.setAnimationLoop((timestamp) => this.frame(timestamp));
  }
  private frame(timestamp: number): void {
    const delta = this.lastFrame === null ? 0 : Math.max(0, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;
    if (delta > 0 && delta < 0.2) {
      this.frameTimes.push(delta * 1000);
      if (this.frameTimes.length > 600) this.frameTimes.shift();
    }
    advanceGame(this.runtime, delta);
    this.camera.position.x = this.runtime.cameraX;
    this.hudElapsed += delta;
    if (this.hudElapsed >= 0.08 || delta === 0) {
      this.updateHud();
      this.hudElapsed = 0;
    }
    const renderStart = performance.now();
    this.renderer.render(this.runtime.scene, this.camera);
    this.renderTimes.push(performance.now() - renderStart);
    if (this.renderTimes.length > 600) this.renderTimes.shift();
    if (this.debug) this.debug.textContent = JSON.stringify(this.snapshot());
    this.renderer.domElement.classList.toggle(
      "hit-flash",
      this.runtime.simulationTime < this.runtime.hitFlashUntil,
    );
  }
  private updateHud(): void {
    const p = this.runtime.player;
    this.runtime.ui.updateHud({
      lives: p.lives,
      score: p.score,
      weapon: p.weapon,
      progress:
        this.runtime.phase === Phase.victory
          ? 100
          : missionProgress(p.model.root.position.x, STAGE_LENGTH),
      bossHealth: bossHealthPercent(this.runtime),
      bossActive: this.runtime.triggers.has("boss"),
      hp: p.hp,
      maxHp: p.maxHp,
      rapid: p.rapid,
      mode: this.runtime.options.mode,
      invincible: this.runtime.options.invincible,
      now: this.runtime.simulationTime,
      lastDamage: p.lastDamage,
      bonusLives: this.runtime.bonusLives,
    });
  }
  private snapshot() {
    const r = this.runtime;
    const p = r.player;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    return {
      phase: r.phase,
      time: r.simulationTime,
      player: {
        x: p.model.root.position.x,
        y: p.model.root.position.y,
        z: p.model.root.position.z,
        pose: p.pose,
        grounded: p.grounded,
        groundId: p.groundId,
        lives: p.lives,
        hp: p.hp,
        weapon: p.weapon,
        rapid: p.rapid,
        invulnerableUntil: p.invulnerableUntil,
        lastDamage: p.lastDamage,
        bonusLives: this.runtime.bonusLives,
      },
      cameraX: r.cameraX,
      held: [...r.input.held],
      shots: r.playerShots.length,
      enemyShots: r.enemyShots.length,
      sparks: r.sparks.length,
      enemies: r.enemies.filter((e) => e.alive && e.active).length,
      bridgesDestroyed: r.bridges.filter((b) => b.destroyed).length,
      bossHealth: bossHealthPercent(r),
      options: r.options,
      performance: {
        frames: sorted.length,
        frameMsP50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        frameMsP95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        renderMsMean: this.renderTimes.reduce((a, b) => a + b, 0) / (this.renderTimes.length || 1),
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      },
    };
  }
  private resize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const halfHeight = VIEW_WIDTH / aspect / 2;
    this.camera.left = -VIEW_WIDTH / 2;
    this.camera.right = VIEW_WIDTH / 2;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  }
}
