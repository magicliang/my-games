import * as THREE from "three";
import { createSpark } from "./models";
import type { GameRuntime } from "./runtime";
import { BRIDGES, VIEW_WIDTH } from "./stage";
import { landingSurface } from "./terrain";
import type { Vector } from "./types";

type ExplosionSpec = { readonly position: Vector; readonly color: number; readonly count: number };
export function spawnExplosion(runtime: GameRuntime, spec: ExplosionSpec): void {
  runtime.audio.explosion();
  for (let index = 0; index < spec.count && runtime.sparks.length < 160; index++) {
    const mesh = createSpark(index % 3 === 0 ? 0xffd65a : spec.color);
    mesh.position.set(spec.position.x, spec.position.y + 0.5, 0.3);
    runtime.scene.add(mesh);
    const angle = (index / spec.count) * Math.PI * 2;
    runtime.sparks.push({
      mesh,
      velocity: new THREE.Vector3(Math.cos(angle) * 3, Math.sin(angle) * 3 + 2, 0),
      life: 0.6,
    });
  }
}
export function updateEffects(runtime: GameRuntime, delta: number, now: number): void {
  for (let index = runtime.sparks.length - 1; index >= 0; index--) {
    const spark = runtime.sparks[index];
    if (!spark) continue;
    spark.life -= delta;
    spark.velocity.y -= 10 * delta;
    spark.mesh.position.addScaledVector(spark.velocity, delta);
    spark.mesh.rotation.z += delta * 9;
    if (spark.life <= 0) {
      runtime.scene.remove(spark.mesh);
      runtime.sparks.splice(index, 1);
    }
  }
  for (const container of runtime.containers) {
    if (!container.alive) continue;
    if (container.activatedAt < 0 && container.startX < runtime.cameraX + VIEW_WIDTH / 2)
      container.activatedAt = now;
    container.mesh.visible =
      container.activatedAt >= 0 &&
      Math.abs(container.mesh.position.x - runtime.cameraX) < VIEW_WIDTH / 2 + 2;
    if (container.activatedAt >= 0 && container.flying) {
      const age = now - container.activatedAt;
      container.mesh.position.x = container.startX + Math.sin(age * 0.65) * 2.5;
      container.mesh.position.y = container.startY + Math.sin(age * 2) * 0.55;
    }
  }
  for (const pickup of runtime.pickups) {
    if (pickup.collected || !pickup.released) continue;
    const before = pickup.mesh.position.y;
    pickup.velocityY -= 12 * delta;
    const next = before + pickup.velocityY * delta;
    const surface =
      pickup.velocityY <= 0
        ? landingSurface(runtime, pickup.mesh.position.x, before - 0.3, next - 0.3, false)
        : undefined;
    if (surface) {
      pickup.mesh.position.y = surface.y + 0.3;
      pickup.velocityY = 0;
    } else pickup.mesh.position.y = next;
    if (pickup.mesh.position.y < -7) {
      pickup.collected = true;
      pickup.mesh.visible = false;
    }
  }
}
export function updateStageEvents(runtime: GameRuntime): void {
  const x = runtime.player.model.root.position.x;
  const now = runtime.simulationTime;
  for (const [index, bridge] of BRIDGES.entries()) {
    const key = `bridge-${index}`;
    if (x >= bridge.start - 0.2 && !runtime.triggers.has(key)) {
      runtime.triggers.add(key);
      runtime.ui.toast("桥面即将坍塌 · 水中按下潜伏，游向岸边");
      let sequence = 0;
      for (const segment of runtime.bridges)
        if (segment.bridge === index) segment.explodeAt = now + 0.8 + sequence++ * 0.25;
    }
  }
  for (const segment of runtime.bridges) {
    if (!segment.destroyed && now >= segment.explodeAt) {
      segment.destroyed = true;
      segment.mesh.visible = false;
      spawnExplosion(runtime, { position: segment.mesh.position, color: 0xff743d, count: 7 });
    }
  }
  if (x > 130 && !runtime.triggers.has("boss")) {
    runtime.triggers.add("boss");
    runtime.ui.toast("堡垒：攻击底部红色核心 · 双炮可先行清除");
  }
}
