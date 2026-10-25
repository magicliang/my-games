import { describe, expect, it, vi } from "vitest";
import { firePlayer, updateCombat } from "../src/game/combat";
import { advanceGame, restartGame, startGame, togglePause } from "../src/game/engine";
import { Control } from "../src/game/input";
import { collectPickups } from "../src/game/movement";
import type { GameRuntime } from "../src/game/runtime";
import { CORE_HEALTH, SURFACES, VIEW_WIDTH, WATER_Y } from "../src/game/stage";
import { EnemyKind, Phase, Weapon } from "../src/game/types";
import { fixture, projectile, quietEnemies } from "./helpers";

function frames(runtime: GameRuntime, count: number): void {
  for (let index = 0; index < count; index += 1) advanceGame(runtime, 1 / 60);
}

function started() {
  const setup = fixture();
  startGame(setup.runtime);
  quietEnemies(setup.runtime);
  setup.runtime.player.invulnerableUntil = 0;
  return setup;
}

function shoot(setup: ReturnType<typeof fixture>, now: number): void {
  setup.held.add(Control.fire);
  setup.pressed.add(Control.fire);
  firePlayer(setup.runtime, now);
}

function collide(runtime: GameRuntime, y = 1): void {
  const shot = projectile(
    runtime.player.model.root.position.x,
    runtime.player.model.root.position.y + y,
  );
  runtime.scene.add(shot.mesh);
  runtime.enemyShots.push(shot);
  updateCombat(runtime, 1 / 60, runtime.simulationTime);
}

describe("movement through the real actor/update pipeline", () => {
  it("aims up without depth movement and uses down for prone", () => {
    const { runtime, held } = started();
    held.add(Control.up);
    frames(runtime, 10);
    expect(runtime.player.model.root.position.z).toBe(0);
    expect(runtime.player.aimY).toBeGreaterThan(0);
    held.clear();
    held.add(Control.down);
    frames(runtime, 1);
    expect(runtime.player.pose).toBe("prone");
    expect(runtime.player.model.root.position.z).toBe(0);
  });

  it("jumps through a platform from below, then lands on its top", () => {
    const setup = started();
    const { runtime, pressed, held } = setup;
    const ledge = SURFACES.find((surface) => surface.id === "ledge-one");
    if (!ledge) throw new Error("the opening platform is required");
    runtime.player.model.root.position.set((ledge.start + ledge.end) / 2, 0, 0);
    runtime.player.groundId = "bank-west";
    pressed.add(Control.jump);
    held.add(Control.jump);
    let peak = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      frames(runtime, 1);
      peak = Math.max(peak, runtime.player.model.root.position.y);
    }
    expect(peak).toBeGreaterThan(ledge.y);
    expect(runtime.player.groundId).toBe(ledge.id);
    expect(runtime.player.model.root.position.y).toBeCloseTo(ledge.y, 5);
    expect(runtime.player.grounded).toBe(true);
    expect(setup.audio.jump).toHaveBeenCalledTimes(1);
  });

  it("down + jump drops through a platform without snapping back", () => {
    const { runtime, held, pressed } = started();
    runtime.player.model.root.position.set(13, 2.5, 0);
    runtime.player.groundId = "ledge-one";
    held.add(Control.down);
    pressed.add(Control.jump);
    frames(runtime, 90);
    expect(runtime.player.model.root.position.y).toBeCloseTo(0, 5);
    expect(runtime.player.groundId).toBe("bank-west");
    expect(runtime.player.grounded).toBe(true);
  });

  it("retains jump momentum on release and permits intentional air reversal", () => {
    const { runtime, held, pressed } = started();
    held.add(Control.right);
    pressed.add(Control.jump);
    frames(runtime, 4);
    const airborneX = runtime.player.model.root.position.x;
    held.clear();
    frames(runtime, 4);
    expect(runtime.player.model.root.position.x).toBeGreaterThan(airborneX);
    const releasedX = runtime.player.model.root.position.x;
    held.add(Control.left);
    frames(runtime, 4);
    expect(runtime.player.model.root.position.x).toBeLessThan(releasedX);
    expect(runtime.player.grounded).toBe(false);
  });

  it("does not accumulate animation offsets while standing on a surface", () => {
    const { runtime } = started();
    frames(runtime, 180);
    expect(runtime.player.model.root.position.y).toBeCloseTo(0, 5);
    expect(runtime.player.velocityY).toBe(0);
  });

  it("dives in water, cannot jump/fire underwater, and climbs out at the bank", () => {
    const { runtime, held, pressed } = started();
    for (const segment of runtime.bridges) segment.destroyed = true;
    runtime.player.model.root.position.set(38.5, WATER_Y, 0);
    runtime.player.groundId = "river-one";
    held.add(Control.down);
    held.add(Control.fire);
    pressed.add(Control.jump);
    pressed.add(Control.fire);
    frames(runtime, 5);
    expect(runtime.player.pose).toBe("diving");
    expect(runtime.player.model.root.position.y).toBeCloseTo(WATER_Y, 5);
    expect(runtime.playerShots).toHaveLength(0);
    held.clear();
    held.add(Control.right);
    frames(runtime, 60);
    expect(runtime.player.model.root.position.x).toBeGreaterThan(39);
    expect(runtime.player.model.root.position.y).toBeCloseTo(0, 5);
    expect(runtime.player.pose).not.toBe("swimming");
  });

  it("collapsing bridge segments remove support and let the player fall into water", () => {
    const { runtime } = started();
    const segment = runtime.bridges[0];
    if (!segment) throw new Error("stage must contain a bridge");
    runtime.options.invincible = true;
    runtime.player.model.root.position.set((segment.start + segment.end) / 2, 0, 0);
    runtime.player.groundId = segment.id;
    frames(runtime, 1);
    expect(segment.explodeAt).toBeGreaterThan(runtime.simulationTime);
    const scheduled = segment.explodeAt;
    togglePause(runtime);
    frames(runtime, 180);
    expect(segment.explodeAt).toBe(scheduled);
    expect(segment.destroyed).toBe(false);
    togglePause(runtime);
    frames(runtime, 120);
    expect(segment.destroyed).toBe(true);
    expect(segment.mesh.visible).toBe(false);
    expect(runtime.player.model.root.position.y).toBeCloseTo(WATER_Y, 5);
    expect(runtime.player.pose).toBe("swimming");
  });

  it("produces the same jump state at 120, 60 and 10 render frames per second", () => {
    const samples = [120, 60, 10].map((fps) => {
      const { runtime, held, pressed } = started();
      held.add(Control.right);
      pressed.add(Control.jump);
      for (let index = 0; index < fps; index += 1) advanceGame(runtime, 1 / fps);
      return {
        time: runtime.simulationTime,
        x: runtime.player.model.root.position.x,
        y: runtime.player.model.root.position.y,
        grounded: runtime.player.grounded,
      };
    });
    for (const state of samples) {
      expect(state.time).toBeCloseTo(samples[0]?.time ?? -1, 9);
      expect(state.x).toBeCloseTo(samples[0]?.x ?? -1, 9);
      expect(state.y).toBeCloseTo(samples[0]?.y ?? -1, 9);
      expect(state.grounded).toBe(samples[0]?.grounded);
    }
  });

  it("advances the camera monotonically and prevents backtracking off screen", () => {
    const { runtime, held } = started();
    runtime.player.model.root.position.x = 55;
    frames(runtime, 1);
    const cameraX = runtime.cameraX;
    held.add(Control.left);
    frames(runtime, 240);
    expect(runtime.cameraX).toBeGreaterThanOrEqual(cameraX);
    expect(runtime.player.model.root.position.x).toBeGreaterThanOrEqual(cameraX - VIEW_WIDTH / 2);
  });
});

describe("weapon and collision chains", () => {
  it("fires five spread projectiles in XY and caps the on-screen volley count", () => {
    const setup = started();
    setup.runtime.player.weapon = Weapon.spread;
    shoot(setup, 1);
    expect(setup.runtime.playerShots).toHaveLength(5);
    expect(setup.runtime.playerShots.every((shot) => shot.velocity.z === 0)).toBe(true);
    expect(new Set(setup.runtime.playerShots.map((shot) => shot.velocity.y)).size).toBe(5);
    for (let index = 2; index < 30; index += 1) shoot(setup, index);
    expect(setup.runtime.playerShots.length).toBeLessThanOrEqual(10);
  });

  it.each(Object.values(Weapon))("%s shots damage an enemy through updateCombat", (weapon) => {
    const setup = started();
    const { runtime } = setup;
    const target = runtime.enemies.find((enemy) => enemy.kind === EnemyKind.gunner);
    if (!target) throw new Error("stage must contain a gunner");
    target.alive = true;
    target.active = true;
    target.hp = 20;
    target.mesh.position.set(5, 0, 0);
    runtime.scene.add(target.mesh);
    runtime.player.weapon = weapon;
    runtime.player.model.root.position.set(1, 0, 0);
    shoot(setup, 0);
    setup.held.clear();
    for (let frame = 0; frame < 90; frame += 1) updateCombat(runtime, 1 / 60, frame / 60);
    expect(target.hp).toBeLessThan(20);
  });

  it("only M repeats while the fire key remains held", () => {
    for (const weapon of Object.values(Weapon)) {
      const setup = started();
      setup.runtime.player.weapon = weapon;
      shoot(setup, 0);
      const calls = vi.mocked(setup.audio.shoot);
      const initialShots = calls.mock.calls.length;
      for (let frame = 1; frame < 90; frame += 1) {
        updateCombat(setup.runtime, 1 / 60, frame / 60);
      }
      if (weapon === Weapon.machine) expect(calls.mock.calls.length).toBeGreaterThan(initialShots);
      else expect(calls.mock.calls.length).toBe(initialShots);
    }
  });

  it("shooting a weapon carrier releases an item that the player can actually collect", () => {
    const { runtime } = started();
    const container = runtime.containers[0];
    if (!container) throw new Error("stage must contain weapon carriers");
    container.activatedAt = 0;
    container.hp = 1;
    const shot = projectile(container.mesh.position.x, container.mesh.position.y, false);
    runtime.playerShots.push(shot);
    updateCombat(runtime, 1 / 60, 0);
    expect(container.alive).toBe(false);
    const pickup = runtime.pickups[container.pickupIndex];
    if (!pickup) throw new Error("carrier must be linked to an item");
    expect(pickup.released).toBe(true);
    expect(pickup.collected).toBe(false);
    runtime.player.model.root.position.copy(pickup.mesh.position);
    collectPickups(runtime);
    expect(pickup.collected).toBe(true);
    expect(runtime.player.weapon).toBe(Weapon.machine);
  });

  it("collects R as a speed modifier without replacing S", () => {
    const setup = started();
    const { runtime } = setup;
    runtime.player.weapon = Weapon.spread;
    const pickup = runtime.pickups.find((item) => item.weapon === "rapid");
    if (!pickup) throw new Error("stage must contain R");
    pickup.released = true;
    pickup.mesh.position.copy(runtime.player.model.root.position);
    collectPickups(runtime);
    expect(pickup.collected).toBe(true);
    expect(runtime.player.weapon).toBe(Weapon.spread);
    expect(runtime.player.rapid).toBe(true);
    shoot(setup, 0);
    const rapidSpeed = setup.runtime.playerShots[2]?.velocity.length();
    const normal = started();
    normal.runtime.player.weapon = Weapon.spread;
    shoot(normal, 0);
    expect(rapidSpeed).toBeGreaterThan(
      normal.runtime.playerShots[2]?.velocity.length() ?? Infinity,
    );
  });

  it("re-firing L replaces the old beam and R does not accelerate L", () => {
    const setup = started();
    setup.runtime.player.weapon = Weapon.laser;
    shoot(setup, 0);
    const oldMeshes = setup.runtime.playerShots.map((shot) => shot.mesh);
    const count = setup.runtime.playerShots.length;
    const speed = setup.runtime.playerShots[0]?.velocity.length();
    expect(count).toBeGreaterThan(1);
    setup.runtime.player.rapid = true;
    shoot(setup, 1);
    expect(setup.runtime.playerShots).toHaveLength(count);
    expect(setup.runtime.playerShots.every((shot) => !oldMeshes.includes(shot.mesh))).toBe(true);
    expect(setup.runtime.playerShots[0]?.velocity.length()).toBe(speed);
  });

  it("laser segments penetrate two targets without repeatedly damaging the same target", () => {
    const setup = started();
    const { runtime } = setup;
    const targets = runtime.enemies.filter((enemy) => enemy.kind === EnemyKind.gunner).slice(0, 2);
    expect(targets).toHaveLength(2);
    targets.forEach((enemy, index) => {
      enemy.alive = true;
      enemy.active = true;
      enemy.hp = 20;
      enemy.mesh.position.set(5 + index * 4, 0, 0);
      runtime.scene.add(enemy.mesh);
    });
    runtime.player.weapon = Weapon.laser;
    shoot(setup, 0);
    setup.held.clear();
    for (let frame = 0; frame < 90; frame += 1) updateCombat(runtime, 1 / 60, frame / 60);
    expect(targets.map((enemy) => enemy.hp)).toEqual([15, 15]);
  });

  it("retiring off-screen bullets frees the rifle slot limit for new shots", () => {
    const setup = started();
    for (let index = 0; index < 20; index += 1) shoot(setup, index);
    expect(setup.runtime.playerShots).toHaveLength(4);
    setup.held.clear();
    for (let frame = 0; frame < 180; frame += 1)
      updateCombat(setup.runtime, 1 / 60, 20 + frame / 60);
    expect(setup.runtime.playerShots).toHaveLength(0);
    shoot(setup, 24);
    expect(setup.runtime.playerShots).toHaveLength(1);
  });

  it("prone reduces the hurtbox so standing-height bullets pass overhead", () => {
    const { runtime, held } = started();
    held.add(Control.down);
    frames(runtime, 1);
    collide(runtime, 1.3);
    expect(runtime.player.lives).toBe(3);
    held.clear();
    frames(runtime, 1);
    collide(runtime, 1.3);
    expect(runtime.player.lives).toBe(2);
  });

  it("sweeps a fast shot through a target between simulation positions", () => {
    const { runtime } = started();
    const target = runtime.enemies.find((enemy) => enemy.kind === EnemyKind.gunner);
    if (!target) throw new Error("stage must contain gunner");
    target.alive = true;
    target.active = true;
    target.mesh.position.set(5, 0, 0);
    target.hp = 2;
    const shot = projectile(1, 1, false);
    shot.velocity.x = 480;
    runtime.playerShots.push(shot);
    updateCombat(runtime, 1 / 60, 0);
    expect(target.hp).toBe(1);
  });
});

describe("death, timers, fortress, and restart", () => {
  it("uses classic defaults and loses one life for simultaneous hits", () => {
    const { runtime } = started();
    expect(runtime.options).toEqual({ mode: "classic", invincible: false });
    expect(runtime.player.maxHp).toBe(1);
    collide(runtime);
    collide(runtime);
    expect(runtime.player.lives).toBe(2);
    expect(runtime.player.pose).toBe("dead");
  });

  it("death resets upgrades, delays respawn, and never returns to a checkpoint", () => {
    const { runtime } = started();
    runtime.player.model.root.position.set(60, 0, 0);
    frames(runtime, 1);
    const cameraX = runtime.cameraX;
    runtime.player.weapon = Weapon.spread;
    runtime.player.rapid = true;
    collide(runtime);
    expect(runtime.player.pose).toBe("dead");
    expect(runtime.player.weapon).toBe(Weapon.rifle);
    expect(runtime.player.rapid).toBe(false);
    expect(runtime.player.model.root.position.x).toBeGreaterThanOrEqual(cameraX - VIEW_WIDTH / 2);
    frames(runtime, Math.ceil((runtime.player.deadUntil - runtime.simulationTime) * 60) + 2);
    expect(runtime.player.pose).not.toBe("dead");
    expect(runtime.player.model.root.position.x).toBeGreaterThanOrEqual(cameraX - VIEW_WIDTH / 2);
    expect(runtime.player.invulnerableUntil).toBeGreaterThan(runtime.simulationTime);
  });

  it("freezes invulnerability, shots, enemy cooldowns, and respawn while paused", () => {
    const setup = started();
    const { runtime, held } = setup;
    runtime.player.invulnerableUntil = runtime.simulationTime + 3;
    shoot(setup, 0);
    frames(runtime, 1);
    const time = runtime.simulationTime;
    const until = runtime.player.invulnerableUntil;
    const position = runtime.playerShots[0]?.mesh.position.clone();
    const cooldowns = runtime.enemies.map((enemy) => enemy.nextShotAt);
    togglePause(runtime);
    expect(runtime.phase).toBe(Phase.paused);
    expect(held.size).toBe(0);
    frames(runtime, 600);
    expect(runtime.simulationTime).toBe(time);
    expect(runtime.player.invulnerableUntil).toBe(until);
    expect(runtime.playerShots[0]?.mesh.position).toEqual(position);
    expect(runtime.enemies.map((enemy) => enemy.nextShotAt)).toEqual(cooldowns);
    togglePause(runtime);
    frames(runtime, 1);
    expect(runtime.simulationTime - time).toBeCloseTo(1 / 60, 8);
    runtime.player.invulnerableUntil = 0;
    collide(runtime);
    const deadUntil = runtime.player.deadUntil;
    togglePause(runtime);
    frames(runtime, 300);
    expect(runtime.player.deadUntil).toBe(deadUntil);
    expect(runtime.player.pose).toBe("dead");
  });

  it("high health absorbs hits while explicit invincibility prevents damage", () => {
    const setup = fixture();
    startGame(setup.runtime, { mode: "high-health", invincible: false });
    quietEnemies(setup.runtime);
    setup.runtime.player.invulnerableUntil = 0;
    const maxHp = setup.runtime.player.maxHp;
    expect(maxHp).toBeGreaterThan(1);
    collide(setup.runtime);
    expect(setup.runtime.player.hp).toBe(maxHp - 1);
    expect(setup.runtime.player.lives).toBe(3);
    const invincible = fixture();
    startGame(invincible.runtime, { mode: "classic", invincible: true });
    collide(invincible.runtime);
    expect(invincible.runtime.player.hp).toBe(1);
    expect(invincible.runtime.player.lives).toBe(3);
  });

  it("breaks the core through projectile collision with guards alive, then fully restarts", () => {
    const setup = fixture();
    const { runtime, held } = setup;
    startGame(runtime);
    const core = runtime.enemies.find((enemy) => enemy.kind === EnemyKind.core);
    if (!core) throw new Error("stage must contain fortress core");
    core.active = true;
    core.hp = 1;
    const guards = runtime.enemies.filter((enemy) => enemy.kind === EnemyKind.mortar);
    expect(guards).toHaveLength(2);
    expect(guards.every((guard) => guard.alive)).toBe(true);
    const guardHealth = guards.map((guard) => guard.hp);
    const shot = projectile(core.mesh.position.x, core.mesh.position.y, false);
    runtime.playerShots.push(shot);
    updateCombat(runtime, 1 / 60, runtime.simulationTime);
    expect(runtime.phase).toBe(Phase.victory);
    expect(core.alive).toBe(false);
    expect(guards.map((guard) => guard.hp)).toEqual(guardHealth);
    expect(runtime.enemies.every((enemy) => !enemy.alive)).toBe(true);
    expect(setup.ui.showResult).toHaveBeenCalledWith(true, runtime.player.score);
    held.add(Control.fire);
    runtime.triggers.add("test-trigger");
    restartGame(runtime);
    expect(runtime.phase).toBe(Phase.playing);
    expect(runtime.player.lives).toBe(3);
    expect(runtime.player.score).toBe(0);
    expect(runtime.player.weapon).toBe(Weapon.rifle);
    expect(runtime.playerShots).toHaveLength(0);
    expect(runtime.enemyShots).toHaveLength(0);
    expect(runtime.sparks).toHaveLength(0);
    expect(runtime.triggers.size).toBe(0);
    expect(runtime.simulationTime).toBe(0);
    expect(held.size).toBe(0);
    expect(runtime.bridges.every((segment) => !segment.destroyed)).toBe(true);
    expect(runtime.containers.every((container) => container.alive)).toBe(true);
    const restartedCore = runtime.enemies.find((enemy) => enemy.kind === EnemyKind.core);
    expect(restartedCore?.alive).toBe(true);
    expect(restartedCore?.hp).toBe(CORE_HEALTH);
  });

  it("reaches game over on the final life and can restart into a playable state", () => {
    const { runtime } = started();
    runtime.player.lives = 1;
    collide(runtime);
    frames(runtime, 120);
    expect(runtime.phase).toBe(Phase.gameOver);
    restartGame(runtime);
    expect(runtime.phase).toBe(Phase.playing);
    expect(runtime.player.lives).toBe(3);
    expect(runtime.player.pose).not.toBe("dead");
    expect(runtime.player.grounded).toBe(true);
  });
});
