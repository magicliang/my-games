import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { damagePlayer, firePlayer } from "../src/game/combat";
import { restartGame, startGame } from "../src/game/engine";
import { animatePlayer } from "../src/game/movement";
import type { Pose } from "../src/game/types";
import { fixture } from "./helpers";

describe("pixel character integration", () => {
  it("does not wrap the rightmost prone gun outline onto the left edge of its frame", () => {
    const { runtime } = fixture();
    const model = runtime.player.model;
    model.setPose("prone", 0, false, 0);
    const image = model.body.material.map?.image as {
      width: number;
      height: number;
      data: Uint8Array;
    };
    const uv = model.body.geometry.getAttribute("uv");
    const left = Math.round(uv.getX(0) * image.width);
    const bottom = Math.round(uv.getY(2) * image.height);
    const top = Math.round(uv.getY(0) * image.height);
    for (let y = bottom; y < top; y++) expect(image.data[(y * image.width + left) * 4 + 3]).toBe(0);
  });

  it("keeps the drawn gun anchor aligned with emitted shots in both directions", () => {
    const { runtime, pressed } = fixture();
    startGame(runtime);
    for (const facing of [-1, 1]) {
      for (const pose of ["standing", "prone", "jumping", "swimming"] as Pose[]) {
        for (const aimY of pose === "prone" ? [0] : [0, 1]) {
          const player = runtime.player;
          player.pose = pose;
          player.facing = facing;
          player.aimX = facing;
          player.aimY = aimY;
          player.nextShotAt = 0;
          runtime.playerShots.length = 0;
          animatePlayer(runtime, 2);
          player.model.root.updateMatrixWorld(true);
          const muzzle = player.model.muzzle.getWorldPosition(new THREE.Vector3());
          pressed.add("fire");
          firePlayer(runtime, 2);
          const shot = runtime.playerShots[0];
          expect(shot).toBeDefined();
          expect(shot?.origin.x).toBeCloseTo(muzzle.x, 6);
          expect(shot?.origin.y).toBeCloseTo(muzzle.y, 6);
        }
      }
    }
  });

  it("shows the final death frame immediately and restores the standing frame on restart", () => {
    const { runtime } = fixture();
    startGame(runtime);
    const player = runtime.player;
    const standing = player.model.body.geometry;
    player.lives = 1;
    damagePlayer(runtime, 2);
    expect(runtime.phase).toBe("game-over");
    expect(player.model.body.geometry).not.toBe(standing);
    expect(player.model.gun.visible).toBe(false);
    expect(player.model.body.rotation.z).toBe(0);
    restartGame(runtime);
    expect(player.model.body.geometry).toBe(standing);
    expect(player.model.gun.visible).toBe(true);
  });
});
