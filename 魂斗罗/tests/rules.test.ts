import { describe, expect, it } from "vitest";

import { classicCodeComplete, isHit, missionProgress, takeDamage } from "../src/game/rules";

describe("combat rules", () => {
  it("detects a projectile hit inside the collision radius", () => {
    // Given
    const projectile = { x: 8, y: 1, z: 0 };
    const target = { x: 8.5, y: 1.2, z: 0.2 };

    // When
    const hit = isHit(projectile, target, 0.8);

    // Then
    expect(hit).toBe(true);
  });

  it("preserves a life while the player is invulnerable", () => {
    // Given
    const player = { lives: 3, invulnerableUntil: 10 };

    // When
    const result = takeDamage(player, 8);

    // Then
    expect(result).toEqual({ lives: 3, wasHit: false });
  });

  it("removes one life when the player is vulnerable", () => {
    // Given
    const player = { lives: 3, invulnerableUntil: 2 };

    // When
    const result = takeDamage(player, 8);

    // Then
    expect(result).toEqual({ lives: 2, wasHit: true });
  });
});

describe("mission rules", () => {
  it("reports full progress at the jungle fortress", () => {
    // Given
    const playerX = 150;

    // When
    const progress = missionProgress(playerX, 150);

    // Then
    expect(progress).toBe(100);
  });

  it("recognizes the complete classic 30-life code", () => {
    // Given
    const keys = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "KeyB",
      "KeyA",
      "Enter",
    ];

    // When
    const complete = classicCodeComplete(keys);

    // Then
    expect(complete).toBe(true);
  });
});
