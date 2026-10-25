import * as THREE from "three";

import { EnemyKind, type EnemyType, type HumanoidModel, type WeaponKind } from "./types";

const skin = new THREE.MeshStandardMaterial({ color: 0xd49a6a, roughness: 0.9 });
const playerBlue = new THREE.MeshStandardMaterial({ color: 0x2f5b79, roughness: 0.8 });
const playerRed = new THREE.MeshStandardMaterial({ color: 0xc94326, roughness: 0.8 });
const enemyGreen = new THREE.MeshStandardMaterial({ color: 0x596d2c, roughness: 0.9 });
const enemyTan = new THREE.MeshStandardMaterial({ color: 0xb8a36a, roughness: 0.9 });
const gunMetal = new THREE.MeshStandardMaterial({
  color: 0x222a28,
  metalness: 0.6,
  roughness: 0.45,
});

type LimbSpec = {
  readonly material: THREE.Material;
  readonly x: number;
  readonly y: number;
  readonly height: number;
};

function box(size: THREE.Vector3, material: THREE.Material, position: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function limb(spec: LimbSpec): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(spec.x, spec.y, 0);
  const segment = box(
    new THREE.Vector3(0.26, spec.height, 0.3),
    spec.material,
    new THREE.Vector3(0, -spec.height / 2, 0),
  );
  pivot.add(segment);
  return pivot;
}

function soldierModel(enemy: boolean): HumanoidModel {
  const root = new THREE.Group();
  const cloth = enemy ? enemyGreen : playerBlue;
  const accent = enemy ? enemyTan : playerRed;
  const torso = box(new THREE.Vector3(0.72, 0.86, 0.44), cloth, new THREE.Vector3(0, 1.25, 0));
  const belt = box(new THREE.Vector3(0.78, 0.16, 0.48), accent, new THREE.Vector3(0, 0.84, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.set(0, 1.92, 0);
  head.castShadow = true;
  const band = box(new THREE.Vector3(0.64, 0.11, 0.34), accent, new THREE.Vector3(0.04, 2.01, 0));
  const leftArm = limb({ material: skin, x: 0.48, y: 1.56, height: 0.78 });
  const rightArm = limb({ material: skin, x: 0.48, y: 1.42, height: 0.78 });
  leftArm.rotation.z = -1.08;
  rightArm.rotation.z = -1.18;
  const leftLeg = limb({ material: cloth, x: -0.2, y: 0.79, height: 0.82 });
  const rightLeg = limb({ material: cloth, x: 0.2, y: 0.79, height: 0.82 });
  const rifle = box(
    new THREE.Vector3(1.22, 0.12, 0.13),
    gunMetal,
    new THREE.Vector3(0.88, 1.36, 0),
  );
  const muzzle = new THREE.Object3D();
  muzzle.position.set(1.52, 1.36, 0);
  root.add(torso, belt, head, band, leftArm, rightArm, leftLeg, rightLeg, rifle, muzzle);
  root.scale.setScalar(0.88);
  return { root, leftArm, rightArm, leftLeg, rightLeg, muzzle };
}

function turretModel(): THREE.Group {
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 0.55, 10), gunMetal);
  base.position.y = 0.28;
  const housing = box(
    new THREE.Vector3(0.92, 0.62, 0.92),
    enemyGreen,
    new THREE.Vector3(0, 0.78, 0),
  );
  const barrel = box(
    new THREE.Vector3(1.45, 0.18, 0.2),
    gunMetal,
    new THREE.Vector3(-0.82, 0.86, 0),
  );
  root.add(base, housing, barrel);
  root.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return root;
}

function coreModel(): THREE.Group {
  const root = new THREE.Group();
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0x402f25,
    metalness: 0.75,
    roughness: 0.35,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0xff4b16,
    emissive: 0xff2300,
    emissiveIntensity: 2,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.28, 10, 24), ringMaterial);
  ring.rotation.y = Math.PI / 2;
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 1), glow);
  root.add(ring, orb);
  return root;
}

export function createPlayerModel(): HumanoidModel {
  return soldierModel(false);
}

export function createEnemyModel(kind: EnemyType): {
  readonly mesh: THREE.Object3D;
  readonly humanoid: HumanoidModel | null;
} {
  switch (kind) {
    case EnemyKind.runner:
    case EnemyKind.gunner:
    case EnemyKind.sniper: {
      const humanoid = soldierModel(true);
      return { mesh: humanoid.root, humanoid };
    }
    case EnemyKind.turret:
      return { mesh: turretModel(), humanoid: null };
    case EnemyKind.core:
      return { mesh: coreModel(), humanoid: null };
  }
}

export function createProjectile(enemyOwned: boolean, laser: boolean): THREE.Mesh {
  const color = enemyOwned ? 0xff6b2b : laser ? 0x59ecff : 0xf1ff83;
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const geometry = laser
    ? new THREE.CapsuleGeometry(0.09, 0.65, 3, 6)
    : new THREE.SphereGeometry(0.095, 6, 5);
  const mesh = new THREE.Mesh(geometry, material);
  if (laser) mesh.rotation.z = Math.PI / 2;
  return mesh;
}

export function createPickupModel(weapon: WeaponKind): THREE.Group {
  const colors: Record<WeaponKind, number> = {
    rifle: 0xf1ff83,
    rapid: 0xffd34d,
    spread: 0xff5a1f,
    laser: 0x59ecff,
  };
  const root = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({
    color: colors[weapon],
    emissive: colors[weapon],
    emissiveIntensity: 1.4,
  });
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 7, 16), glow);
  ring.rotation.x = Math.PI / 2;
  root.add(orb, ring);
  return root;
}

export function createSpark(color: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.13, 0.13),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
}
