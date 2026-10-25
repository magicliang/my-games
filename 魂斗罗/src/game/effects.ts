import * as THREE from "three";

import { createSpark } from "./models";
import type { GameRuntime } from "./runtime";
import type { Vector } from "./types";

type ExplosionSpec = {
  readonly position: Vector;
  readonly color: number;
  readonly count: number;
};

export function spawnExplosion(runtime: GameRuntime, spec: ExplosionSpec): void {
  runtime.audio.explosion();
  for (let index = 0; index < spec.count; index += 1) {
    const mesh = createSpark(index % 3 === 0 ? 0xffd65a : spec.color);
    mesh.position.set(spec.position.x, spec.position.y, spec.position.z);
    runtime.scene.add(mesh);
    const angle = (index / spec.count) * Math.PI * 2;
    runtime.sparks.push({
      mesh,
      velocity: new THREE.Vector3(
        Math.cos(angle) * (2 + Math.random() * 3),
        2 + Math.random() * 4,
        Math.sin(angle) * 3,
      ),
      life: 0.55 + Math.random() * 0.55,
    });
  }
}

export function updateEffects(runtime: GameRuntime, delta: number, now: number): void {
  for (let index = runtime.sparks.length - 1; index >= 0; index -= 1) {
    const spark = runtime.sparks[index];
    if (spark === undefined) continue;
    spark.life -= delta;
    spark.velocity.y -= 10 * delta;
    spark.mesh.position.addScaledVector(spark.velocity, delta);
    spark.mesh.rotation.x += delta * 9;
    if (spark.life <= 0) {
      runtime.scene.remove(spark.mesh);
      runtime.sparks.splice(index, 1);
    }
  }
  for (const pickup of runtime.pickups) {
    if (pickup.collected) continue;
    pickup.mesh.rotation.y = now * 1.8;
    pickup.mesh.position.y += Math.sin(now * 3 + pickup.mesh.position.x) * delta * 0.18;
  }
}

export function updateStageEvents(runtime: GameRuntime): void {
  const x = runtime.player.model.root.position.x;
  if (x > 31 && !runtime.triggers.has("bridge-one")) {
    runtime.triggers.add("bridge-one");
    runtime.ui.toast("前方桥面爆破！保持移动");
    for (const blastX of [34, 38, 42]) {
      spawnExplosion(runtime, {
        position: { x: blastX, y: 0.3, z: 0 },
        color: 0xff4f14,
        count: 11,
      });
    }
  }
  if (x > 79 && !runtime.triggers.has("bridge-two")) {
    runtime.triggers.add("bridge-two");
    runtime.ui.toast("第二爆破桥：敌军增援抵达");
    for (const blastX of [82, 86, 90]) {
      spawnExplosion(runtime, {
        position: { x: blastX, y: 0.3, z: 0 },
        color: 0xff4f14,
        count: 11,
      });
    }
  }
  if (x > 132 && !runtime.triggers.has("boss")) {
    runtime.triggers.add("boss");
    runtime.ui.toast("堡垒进入射程：先摧毁三处守卫火力");
  }
}
