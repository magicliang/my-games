import * as THREE from "three";
import { createPixelCharacter } from "./pixel-character";
import { EnemyKind, type EnemyType, type HumanoidModel, type PickupKind } from "./types";

const red = new THREE.MeshStandardMaterial({ color: 0xff6440 });
const green = new THREE.MeshStandardMaterial({ color: 0xb1c64c });
const metal = new THREE.MeshStandardMaterial({ color: 0x243947, metalness: 0.4, roughness: 0.7 });
const geometries = new Map<string, THREE.BoxGeometry>();
function box(x: number, y: number, z: number, material: THREE.Material): THREE.Mesh {
  const key = `${x},${y},${z}`;
  let geometry = geometries.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(x, y, z);
    geometries.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
export function createPlayerModel(): HumanoidModel {
  return createPixelCharacter(false);
}
export function createEnemyModel(kind: EnemyType): {
  mesh: THREE.Object3D;
  humanoid: HumanoidModel | null;
} {
  if (kind === EnemyKind.runner || kind === EnemyKind.gunner || kind === EnemyKind.sniper) {
    const humanoid = createPixelCharacter(true);
    return { mesh: humanoid.root, humanoid };
  }
  const mesh = new THREE.Group();
  if (kind === EnemyKind.core) {
    const frame = box(1.8, 1.8, 0.5, metal);
    const glow = new THREE.MeshBasicMaterial({ color: 0xff522c, toneMapped: false });
    const core = box(1.2, 1.15, 0.55, glow);
    core.position.z = 0.1;
    mesh.add(frame, core);
  } else {
    const base = box(1.3, 0.55, 0.7, metal);
    base.position.y = 0.27;
    const housing = box(0.95, 0.6, 0.7, green);
    housing.position.y = 0.8;
    const barrel = new THREE.Group();
    barrel.name = "barrel";
    barrel.position.set(0, 0.82, 0);
    const pipe = box(1.1, 0.2, 0.23, metal);
    pipe.position.x = -0.6;
    const muzzle = new THREE.Object3D();
    muzzle.name = "enemy-muzzle";
    muzzle.position.x = -1.15;
    barrel.add(pipe, muzzle);
    const warning = box(
      0.18,
      0.18,
      0.12,
      new THREE.MeshBasicMaterial({ color: 0xffbd50, toneMapped: false }),
    );
    warning.name = "warning";
    warning.position.set(0, 0.8, 0.4);
    warning.visible = false;
    mesh.add(base, housing, barrel, warning);
  }
  return { mesh, humanoid: null };
}
export const PICKUP_COLORS: Record<PickupKind, number> = {
  rifle: 0xf1ff83,
  machine: 0x84e3ff,
  rapid: 0xffd34d,
  spread: 0xff7350,
  fire: 0xffb344,
  laser: 0x89ffff,
  barrier: 0xb798ff,
  bomb: 0xffffff,
};
const shotGeometry = new THREE.SphereGeometry(0.11, 7, 6);
const enemyGeometry = new THREE.SphereGeometry(0.17, 8, 6);
const laserGeometry = new THREE.BoxGeometry(0.5, 0.12, 0.12);
const friendlyMaterial = new THREE.MeshBasicMaterial({ color: 0xfffc94, toneMapped: false });
const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff70de, toneMapped: false });
const laserMaterial = new THREE.MeshBasicMaterial({ color: 0x9effff, toneMapped: false });
const fireMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa38, toneMapped: false });
const sparkGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const sparkMaterials = new Map<number, THREE.MeshBasicMaterial>();
const iconTextures = new Map<string, THREE.CanvasTexture>();
export function createProjectile(enemyOwned: boolean, laser: boolean, fire = false): THREE.Mesh {
  return new THREE.Mesh(
    enemyOwned || fire ? enemyGeometry : laser ? laserGeometry : shotGeometry,
    enemyOwned ? enemyMaterial : laser ? laserMaterial : fire ? fireMaterial : friendlyMaterial,
  );
}
export function createPickupModel(weapon: PickupKind): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: PICKUP_COLORS[weapon], toneMapped: false });
  root.add(box(0.8, 0.58, 0.2, material));
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const label = (
      {
        machine: "M",
        rapid: "R",
        spread: "S",
        fire: "F",
        laser: "L",
        barrier: "B",
        bomb: "★",
        rifle: "N",
      } as const
    )[weapon];
    let texture = iconTextures.get(label);
    if (!texture) {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#15202b";
        ctx.font = "bold 50px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, 32, 34);
      }
      texture = new THREE.CanvasTexture(canvas);
      iconTextures.set(label, texture);
    }
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false }),
    );
    sprite.scale.set(0.6, 0.6, 1);
    sprite.position.z = 0.3;
    root.add(sprite);
  }
  return root;
}
export function createContainerModel(flying: boolean): THREE.Group {
  const root = new THREE.Group();
  const plate = box(1.1, 0.65, 0.35, metal);
  root.add(plate);
  const lamp = box(0.55, 0.3, 0.12, red);
  lamp.position.z = 0.25;
  root.add(lamp);
  if (flying) {
    const wings = box(2, 0.12, 0.35, green);
    root.add(wings);
  }
  return root;
}
export function createSpark(color: number): THREE.Mesh {
  let material = sparkMaterials.get(color);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    sparkMaterials.set(color, material);
  }
  return new THREE.Mesh(sparkGeometry, material);
}
