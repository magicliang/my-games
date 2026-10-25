import { describe, expect, it } from "vitest";
import { updateCombat } from "../src/game/combat";
import { advanceGame, startGame } from "../src/game/engine";
import { ENEMY_SPAWNS } from "../src/game/stage";
import { floorAt } from "../src/game/terrain";
import { EnemyKind } from "../src/game/types";
import { fixture, projectile, quietEnemies } from "./helpers";

const frames = (runtime: ReturnType<typeof fixture>["runtime"], n: number): void => {
  for (let i = 0; i < n; i++) advanceGame(runtime, 1 / 60);
};

describe("review regressions", () => {
  it("finds the right bank when the camera excludes the left bank after a pit death", () => {
    const { runtime } = fixture();
    startGame(runtime);
    quietEnemies(runtime);
    runtime.cameraX = 136;
    runtime.player.model.root.position.set(123.7, -8, 0);
    runtime.player.grounded = false;
    runtime.player.groundId = null;
    frames(runtime, 1);
    expect(runtime.player.lives).toBe(2);
    frames(runtime, 120);
    expect(floorAt(runtime, runtime.player.model.root.position.x)).toBeDefined();
    expect(runtime.player.lives).toBe(2);
    expect(runtime.player.grounded).toBe(true);
  });

  it("the complete runner wave enters even if the player stops scrolling", () => {
    const { runtime } = fixture();
    startGame(runtime);
    quietEnemies(runtime);
    runtime.options.invincible = true;
    runtime.player.model.root.position.x = 18;
    frames(runtime, 120);
    const wave = runtime.enemies.slice(ENEMY_SPAWNS.length);
    expect(wave).toHaveLength(3);
    expect(wave.every((enemy) => enemy.active)).toBe(true);
  });

  it("bullets above the turret housing miss it", () => {
    const { runtime } = fixture();
    startGame(runtime);
    const turret = runtime.enemies.find((enemy) => enemy.kind === EnemyKind.turret);
    if (!turret) throw new Error("turret required");
    turret.active = true;
    runtime.cameraX = turret.mesh.position.x;
    const hp = turret.hp;
    const shot = projectile(turret.mesh.position.x, turret.mesh.position.y + 1.65, false);
    runtime.playerShots.push(shot);
    updateCombat(runtime, 1 / 60, 2);
    expect(turret.hp).toBe(hp);
  });
});
