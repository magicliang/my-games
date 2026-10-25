import * as THREE from "three";
import { SURFACES } from "./stage";

const rock = new THREE.MeshStandardMaterial({ color: 0x62573f, roughness: 1 });
const grass = new THREE.MeshStandardMaterial({ color: 0x7f9b45, roughness: 1 });
const leaf = new THREE.MeshStandardMaterial({ color: 0x295944, roughness: 1 });
const trunk = new THREE.MeshStandardMaterial({ color: 0x324d3c, roughness: 1 });
function block(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  scene.add(mesh);
}
export function createWorld(scene: THREE.Scene): void {
  scene.background = new THREE.Color(0x183e39);
  scene.fog = new THREE.Fog(0x183e39, 48, 100);
  scene.add(new THREE.HemisphereLight(0xe7f8e8, 0x3e4234, 2.8));
  const sun = new THREE.DirectionalLight(0xffefd6, 2.6);
  sun.position.set(-8, 18, 20);
  scene.add(sun);
  for (const surface of SURFACES) {
    const width = surface.end - surface.start;
    const center = (surface.start + surface.end) / 2;
    if (surface.kind === "water") {
      const water = new THREE.MeshStandardMaterial({
        color: 0x46b7ba,
        transparent: true,
        opacity: 0.6,
        roughness: 0.2,
      });
      block(scene, center, surface.y + 0.68, 0.5, width, 0.06, 1.4, water);
      block(scene, center, -3.7, -0.3, width, 2.6, 1, rock);
    } else {
      const height = surface.kind === "ground" ? 4 : 0.5;
      block(scene, center, surface.y - height / 2, -0.2, width, height, 1.2, rock);
      // The visible top is exactly the same Y as collision, including one-way ledges.
      block(scene, center, surface.y - 0.055, 0, width, 0.11, 1.25, grass);
    }
  }
  const treeGeometry = new THREE.IcosahedronGeometry(3, 1);
  const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.45, 10, 6);
  for (let i = 0; i < 52; i++) {
    const x = i * 3.2 - 5;
    const depth = -5 - (i % 3) * 3;
    const tree = new THREE.Mesh(treeGeometry, leaf);
    tree.position.set(x, 7 + Math.sin(i * 2) * 2, depth);
    tree.scale.set(1.35, 0.85, 0.65);
    const stem = new THREE.Mesh(trunkGeometry, trunk);
    stem.position.set(x, 2.8, depth);
    scene.add(tree, stem);
  }
  const fortress = new THREE.MeshStandardMaterial({ color: 0x49646a, metalness: 0.4 });
  block(scene, 148, 3.3, -1.25, 5.8, 6.6, 1.2, fortress);
  block(scene, 148, 6.35, -0.9, 7, 0.3, 1.7, rock);
  for (let y = 1; y < 6; y += 1.3) block(scene, 148, y, -0.55, 5.8, 0.12, 0.12, rock);
  // Bright cliff edges expose the final four-unit gap rather than disguising collision.
  block(scene, 121, -0.2, 0.45, 0.15, 0.4, 0.15, grass);
  block(scene, 125, -0.2, 0.45, 0.15, 0.4, 0.15, grass);
}
