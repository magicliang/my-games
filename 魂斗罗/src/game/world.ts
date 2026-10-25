import * as THREE from "three";

type BoxSpec = {
  readonly size: THREE.Vector3;
  readonly position: THREE.Vector3;
  readonly material: THREE.Material;
  readonly rotationZ?: number;
};

type TreeSpec = {
  readonly x: number;
  readonly z: number;
  readonly scale: number;
};

const earth = new THREE.MeshStandardMaterial({ color: 0x3d3820, roughness: 1 });
const grass = new THREE.MeshStandardMaterial({ color: 0x285432, roughness: 1 });
const rock = new THREE.MeshStandardMaterial({ color: 0x4e5546, roughness: 0.95 });
const timber = new THREE.MeshStandardMaterial({ color: 0x6e4122, roughness: 1 });
const leaf = new THREE.MeshStandardMaterial({ color: 0x1f5b31, roughness: 0.95 });
const fortress = new THREE.MeshStandardMaterial({
  color: 0x454842,
  metalness: 0.45,
  roughness: 0.7,
});

function addBox(scene: THREE.Scene, spec: BoxSpec): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(spec.size.x, spec.size.y, spec.size.z),
    spec.material,
  );
  mesh.position.copy(spec.position);
  mesh.rotation.z = spec.rotationZ ?? 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addGround(scene: THREE.Scene, start: number, length: number): void {
  addBox(scene, {
    size: new THREE.Vector3(length, 1, 12),
    position: new THREE.Vector3(start + length / 2, -0.52, 0),
    material: earth,
  });
  addBox(scene, {
    size: new THREE.Vector3(length, 0.14, 12),
    position: new THREE.Vector3(start + length / 2, 0.02, 0),
    material: grass,
  });
}

function addWater(scene: THREE.Scene, start: number, length: number): void {
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x174f55,
    transparent: true,
    opacity: 0.82,
    roughness: 0.2,
    metalness: 0.1,
  });
  addBox(scene, {
    size: new THREE.Vector3(length, 0.12, 12),
    position: new THREE.Vector3(start + length / 2, -0.52, 0),
    material: waterMaterial,
  });
  addBox(scene, {
    size: new THREE.Vector3(length, 0.2, 12),
    position: new THREE.Vector3(start + length / 2, -0.86, 0),
    material: rock,
  });
}

function addBridge(scene: THREE.Scene, start: number, length: number): void {
  for (let x = start + 0.7; x < start + length; x += 1.45) {
    addBox(scene, {
      size: new THREE.Vector3(1.22, 0.22, 3.2),
      position: new THREE.Vector3(x, 0.08, 0),
      material: timber,
    });
  }
}

function seeded(index: number): number {
  return Math.abs(Math.sin(index * 127.17) * 43758.5453) % 1;
}

function addTree(scene: THREE.Scene, spec: TreeSpec): void {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25 * spec.scale, 0.38 * spec.scale, 4.2 * spec.scale, 7),
    timber,
  );
  trunk.position.set(spec.x, 1.8 * spec.scale, spec.z);
  trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 * spec.scale, 1), leaf);
  crown.position.set(spec.x, 4.1 * spec.scale, spec.z);
  crown.scale.y = 1.25;
  crown.castShadow = true;
  scene.add(trunk, crown);
}

function addScenery(scene: THREE.Scene): void {
  for (let index = 0; index < 58; index += 1) {
    const x = seeded(index) * 154 - 3;
    const side = index % 2 === 0 ? -1 : 1;
    const distance = 7.4 + seeded(index + 80) * 7;
    const z = side < 0 ? -distance : 17 + seeded(index + 80) * 5;
    addTree(scene, { x, z, scale: 0.7 + seeded(index + 30) * 0.8 });
  }
  for (let index = 0; index < 32; index += 1) {
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + seeded(index) * 0.45), leaf);
    bush.position.set(seeded(index + 90) * 138, 0.35, (seeded(index + 130) - 0.5) * 10);
    bush.scale.y = 0.65;
    bush.castShadow = true;
    scene.add(bush);
  }
}

function addFortress(scene: THREE.Scene): void {
  addBox(scene, {
    size: new THREE.Vector3(4.2, 8, 11),
    position: new THREE.Vector3(150.5, 4, 0),
    material: fortress,
  });
  addBox(scene, {
    size: new THREE.Vector3(2.5, 1.3, 12),
    position: new THREE.Vector3(146.9, 7.25, 0),
    material: fortress,
  });
  for (const z of [-4.5, -2.25, 2.25, 4.5]) {
    addBox(scene, {
      size: new THREE.Vector3(0.45, 7.2, 0.55),
      position: new THREE.Vector3(147.9, 3.6, z),
      material: rock,
    });
  }
}

export function createWorld(scene: THREE.Scene): void {
  scene.background = new THREE.Color(0x72906c);
  scene.fog = new THREE.Fog(0x526954, 26, 76);
  const hemisphere = new THREE.HemisphereLight(0xc9dfbb, 0x24331f, 2.25);
  const sun = new THREE.DirectionalLight(0xffefd0, 3.3);
  sun.position.set(-12, 24, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -12;
  scene.add(hemisphere, sun);

  addGround(scene, -8, 40);
  addWater(scene, 32, 14);
  addBridge(scene, 32, 14);
  addGround(scene, 46, 34);
  addWater(scene, 80, 13);
  addBridge(scene, 80, 13);
  addGround(scene, 93, 62);

  addBox(scene, {
    size: new THREE.Vector3(18, 1.2, 8),
    position: new THREE.Vector3(63, 0.58, 0),
    material: rock,
  });
  addBox(scene, {
    size: new THREE.Vector3(4.5, 1.2, 8),
    position: new THREE.Vector3(53.75, 0.58, 0),
    material: rock,
    rotationZ: 0.27,
  });
  addBox(scene, {
    size: new THREE.Vector3(4.5, 1.2, 8),
    position: new THREE.Vector3(72.25, 0.58, 0),
    material: rock,
    rotationZ: -0.27,
  });
  addFortress(scene);
  addScenery(scene);
}

export function groundHeightAt(x: number, z: number): number {
  const onBridge = Math.abs(z) <= 1.7;
  if (x >= 32 && x <= 46) return onBridge ? 0.19 : -0.72;
  if (x >= 80 && x <= 93) return onBridge ? 0.19 : -0.72;
  if (x >= 52 && x < 56) return (x - 52) * 0.3;
  if (x >= 56 && x <= 70) return 1.2;
  if (x > 70 && x <= 74) return (74 - x) * 0.3;
  return 0.1;
}
