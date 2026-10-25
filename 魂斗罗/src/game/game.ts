import * as THREE from "three";

import { GameAudio } from "./audio";
import { bossHealthPercent, updateCombat } from "./combat";
import { updateEffects, updateStageEvents } from "./effects";
import { Control, Input } from "./input";
import { collectPickups, updateEnemies, updatePlayer } from "./movement";
import { missionProgress } from "./rules";
import { createRuntime, type GameRuntime } from "./runtime";
import { STAGE_LENGTH } from "./stage";
import { EnemyKind, Phase } from "./types";
import type { GameUi } from "./ui";
import { createWorld } from "./world";

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly runtime: GameRuntime;

  constructor(container: HTMLElement, ui: GameUi) {
    const scene = new THREE.Scene();
    createWorld(scene);
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 220);
    this.camera.position.set(-9, 7, 14);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.append(this.renderer.domElement);
    this.runtime = createRuntime({
      scene,
      camera: this.camera,
      input: new Input(ui.crosshair),
      audio: new GameAudio(),
      ui,
    });
  }

  run(): void {
    this.runtime.ui.onStart(() => this.start());
    window.addEventListener("resize", () => this.resize());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private start(): void {
    this.runtime.phase = Phase.playing;
    const classicCode = this.runtime.input.consumeClassicCode();
    if (classicCode) this.runtime.player.lives = 30;
    this.runtime.audio.resume();
    this.runtime.ui.setPhase(this.runtime.phase);
    this.runtime.ui.toast(classicCode ? "经典秘籍启动：30 条命" : "行动开始：向东推进");
    this.clock.start();
  }

  private frame(): void {
    const delta = Math.min(this.clock.getDelta(), 0.04);
    const now = this.clock.elapsedTime;
    if (this.runtime.input.consume(Control.pause)) this.togglePause();
    if (this.runtime.phase === Phase.playing) {
      updatePlayer(this.runtime, delta, now);
      updateEnemies(this.runtime, delta, now);
      updateCombat(this.runtime, delta, now);
      collectPickups(this.runtime);
      updateStageEvents(this.runtime);
    }
    updateEffects(this.runtime, delta, now);
    this.updateCamera(delta);
    this.updateHud();
    this.renderer.render(this.runtime.scene, this.camera);
  }

  private togglePause(): void {
    if (this.runtime.phase === Phase.playing) {
      this.runtime.phase = Phase.paused;
    } else if (this.runtime.phase === Phase.paused) {
      this.runtime.phase = Phase.playing;
    } else {
      return;
    }
    this.runtime.ui.setPhase(this.runtime.phase);
  }

  private updateCamera(delta: number): void {
    const player = this.runtime.player.model.root.position;
    const desired = new THREE.Vector3(player.x - 9.5, player.y + 7.2, 14.5);
    this.camera.position.lerp(desired, 1 - Math.exp(-delta * 4.5));
    this.camera.lookAt(player.x + 4.2, player.y + 1, 0);
  }

  private updateHud(): void {
    const player = this.runtime.player;
    const bossActive = player.model.root.position.x > 132;
    this.runtime.ui.updateHud({
      lives: player.lives,
      score: player.score,
      weapon: player.weapon,
      progress: missionProgress(player.model.root.position.x, STAGE_LENGTH),
      bossHealth: bossHealthPercent(this.runtime),
      bossActive,
    });
    const core = this.runtime.enemies.find((enemy) => enemy.kind === EnemyKind.core);
    if (core !== undefined) core.mesh.rotation.x += 0.018;
  }

  private resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  }
}
