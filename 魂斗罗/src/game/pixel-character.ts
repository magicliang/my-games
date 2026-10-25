import * as THREE from "three";
import type { HumanoidModel, Pose } from "./types";

const SIZE = 48;
const PIXELS = 16;
const COLUMNS = 16;
const OUTLINE = 0x161a2b;
type Point = readonly [number, number];
type Frame = { enemy: boolean; pose: Pose; step: number; aim: number };

// Original pixel drawings. Coordinates share the character's foot anchor and gun pivots.
class Pixels {
  readonly colors = new Map<number, number>();
  dot(x: number, y: number, color: number): void {
    const px = Math.round(x) + 24;
    const py = Math.round(y) + 8;
    if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) this.colors.set(py * SIZE + px, color);
  }
  rect(x: number, y: number, width: number, height: number, color: number): void {
    for (let row = 0; row < height; row++)
      for (let col = 0; col < width; col++) this.dot(x + col, y + row, color);
  }
  line(a: Point, b: Point, color: number, width = 1): void {
    const distance = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    const radius = Math.floor(width / 2);
    for (let i = 0; i <= distance; i++) {
      const x = Math.round(a[0] + ((b[0] - a[0]) * i) / distance);
      const y = Math.round(a[1] + ((b[1] - a[1]) * i) / distance);
      this.rect(x - radius, y - radius, width, width, color);
    }
  }
  polygon(points: readonly Point[], color: number): void {
    const minY = Math.ceil(Math.min(...points.map((p) => p[1])));
    const maxY = Math.floor(Math.max(...points.map((p) => p[1])));
    for (let y = minY; y <= maxY; y++) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (!a || !b || a[1] > y === b[1] > y) continue;
        intersections.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const start = intersections[i];
        const end = intersections[i + 1];
        if (start === undefined || end === undefined) continue;
        for (let x = Math.ceil(start); x <= Math.floor(end); x++) this.dot(x, y, color);
      }
    }
  }
}

function draw(frame: Frame): Pixels {
  const p = new Pixels();
  const skin = 0xf4b27a;
  const light = 0xffd79a;
  const shade = 0xb96b49;
  const pants = frame.enemy ? 0x8c9560 : 0x3688d6;
  const darkPants = frame.enemy ? 0x465b3b : 0x234987;
  const highlight = frame.enemy ? 0xc3bb7b : 0x75b9ed;
  const boots = 0x293244;
  const band = frame.enemy ? 0x4d603c : 0xe7433d;
  const head = (x: number, y: number): void => {
    p.polygon(
      [
        [x, y],
        [x + 4, y],
        [x + 5, y - 3],
        [x + 3, y - 5],
        [x, y - 4],
      ],
      skin,
    );
    p.rect(x, y, 4, 2, frame.enemy ? darkPants : 0x543a33);
    p.line([x - 1, y - 1], [x + 4, y - 1], band, 2);
    if (!frame.enemy) p.line([x - 2, y - 1], [x - 5, y - 3], band);
    p.dot(x + 4, y - 2, OUTLINE);
    p.dot(x + 5, y - 3, light);
    p.line([x + 1, y - 4], [x + 3, y - 4], shade);
  };
  if (frame.pose === "prone" || frame.pose === "dead") {
    p.line([-11, 2], [-5, 3], darkPants, 4);
    p.line([-8, 1], [-2, 3], pants, 3);
    p.line([-13, 1], [-11, 2], boots, 2);
    p.line([-10, 0], [-8, 1], boots, 2);
    p.line([-3, 4], [5, 4], frame.enemy ? pants : skin, 5);
    p.line([-2, 6], [4, 6], frame.enemy ? highlight : light);
    p.rect(-4, 2, 2, 5, boots);
    head(6, 7);
    if (frame.pose === "dead") {
      p.line([3, 3], [11, 1], shade, 2);
      p.dot(10, 5, OUTLINE);
      return p;
    }
  } else if (frame.pose === "diving") {
    p.line([-4, -3], [4, -3], shade, 4);
    p.line([-2, 0], [3, 0], band);
    p.dot(5, 3, 0xa7e7e8);
    p.dot(7, 6, 0xa7e7e8);
    return p;
  } else if (frame.pose === "jumping") {
    const curled = new Pixels();
    curled.line([-4, 15], [2, 18], frame.enemy ? pants : skin, 5);
    curled.line([-4, 12], [4, 10], pants, 5);
    curled.line([4, 10], [5, 15], highlight, 3);
    curled.line([5, 15], [1, 15], boots, 2);
    curled.rect(-2, 19, 5, 5, skin);
    curled.line([-2, 23], [2, 23], band);
    curled.line([-3, 18], [-6, 13], shade, 2);
    curled.dot(2, 21, OUTLINE);
    for (const [index, color] of curled.colors) {
      let x = (index % SIZE) - 24;
      let y = Math.floor(index / SIZE) - 8 - 15;
      for (let turn = 0; turn < frame.step; turn++) [x, y] = [y, -x];
      p.dot(x, y + 15, color);
    }
  } else {
    const swimming = frame.pose === "swimming";
    const offset = swimming ? -7 : 0;
    if (!swimming) {
      const poses: readonly (readonly [Point, Point, Point, Point])[] = [
        [
          [-4, 7],
          [-5, 2],
          [3, 7],
          [4, 2],
        ],
        [
          [-4, 8],
          [-8, 2],
          [4, 8],
          [6, 2],
        ],
        [
          [-4, 7],
          [-2, 2],
          [5, 6],
          [8, 1],
        ],
        [
          [0, 7],
          [2, 2],
          [1, 6],
          [0, 1],
        ],
        [
          [4, 8],
          [6, 2],
          [-4, 8],
          [-8, 2],
        ],
        [
          [5, 6],
          [8, 1],
          [-4, 7],
          [-2, 2],
        ],
        [
          [1, 6],
          [0, 1],
          [0, 7],
          [2, 2],
        ],
      ];
      const legs = poses[frame.step] ?? poses[0];
      if (legs) {
        const [backKnee, backFoot, knee, foot] = legs;
        p.line([-2, 13], backKnee, darkPants, 4);
        p.line(backKnee, backFoot, darkPants, 3);
        p.line(backFoot, [backFoot[0] + 3, 1], boots, 3);
        p.line([1, 13], knee, pants, 4);
        p.line(knee, foot, pants, 3);
        p.line([2, 12], knee, highlight);
        p.line(foot, [foot[0] + 3, 1], boots, 3);
      }
      p.rect(-3, 11, 6, 4, pants);
    }
    p.polygon(
      [
        [-4, 15 + offset],
        [-6, 21 + offset],
        [-3, 23 + offset],
        [2, 23 + offset],
        [5, 20 + offset],
        [3, 15 + offset],
      ],
      frame.enemy ? pants : skin,
    );
    p.line([-4, 20 + offset], [-2, 16 + offset], frame.enemy ? darkPants : shade, 2);
    p.line([-2, 22 + offset], [2, 22 + offset], frame.enemy ? highlight : light, 2);
    p.line([0, 19 + offset], [3, 19 + offset], frame.enemy ? darkPants : shade);
    p.rect(-3, 14 + offset, 7, 2, boots);
    p.dot(1, 15 + offset, 0xe6c377);
    p.rect(0, 22 + offset, 3, 3, shade);
    head(0, 28 + offset);
    if (swimming) p.line([-6, 4], [6, 4], 0x8cbcc4);
  }
  const prone = frame.pose === "prone";
  const pivot: Point = [prone ? 8.8 : 0, prone ? 5.12 : frame.pose === "swimming" ? 16.8 : 19.2];
  const angle = (frame.aim * Math.PI) / 8;
  const local = (x: number, y = 0): Point => [
    pivot[0] + Math.cos(angle) * x - Math.sin(angle) * y,
    pivot[1] + Math.sin(angle) * x + Math.cos(angle) * y,
  ];
  const shoulder: Point = prone
    ? [4, 5]
    : frame.pose === "swimming"
      ? [-2, 14]
      : frame.pose === "jumping"
        ? [-2, 16]
        : [-3, 21];
  const grip = local(3, -1);
  const support = local(8, -1);
  p.line(shoulder, [grip[0] - 3, grip[1] - 3], shade, 3);
  p.line([grip[0] - 3, grip[1] - 3], grip, skin, 3);
  p.line([shoulder[0] + 4, shoulder[1]], [support[0] - 2, support[1] - 3], skin, 3);
  p.line([support[0] - 2, support[1] - 3], support, light, 2);
  p.line(local(-3), local(9), 0x283244, 3);
  p.line(local(9), local(14.4), 0x1b2130, 2);
  p.line(local(-2, 1), local(10, 1), 0x9aafba);
  p.line(local(2, -1), local(1, -3), 0x283244, 2);
  p.dot(grip[0], grip[1], skin);
  p.dot(support[0], support[1], light);
  return p;
}

const frameKey = (f: Frame): string => `${f.enemy}:${f.pose}:${f.step}:${f.aim}`;
let atlas:
  | { material: THREE.MeshBasicMaterial; geometries: Map<string, THREE.PlaneGeometry> }
  | undefined;
function getAtlas(): NonNullable<typeof atlas> {
  if (atlas) return atlas;
  const frames: Frame[] = [];
  for (const enemy of [false, true]) {
    for (const pose of ["standing", "jumping", "swimming", "prone", "diving", "dead"] as const) {
      const steps = pose === "standing" ? 7 : pose === "jumping" ? 4 : 1;
      const aims =
        pose === "standing" || pose === "jumping"
          ? [-4, -3, -2, -1, 0, 1, 2, 3, 4]
          : pose === "swimming"
            ? [0, 1, 2, 3, 4]
            : [0];
      for (let step = 0; step < steps; step++)
        for (const aim of aims) frames.push({ enemy, pose, step, aim });
    }
  }
  const width = COLUMNS * SIZE;
  const height = Math.ceil(frames.length / COLUMNS) * SIZE;
  const data = new Uint8Array(width * height * 4);
  const geometries = new Map<string, THREE.PlaneGeometry>();
  frames.forEach((frame, index) => {
    const picture = draw(frame);
    const colors = new Map<number, number>();
    for (const location of picture.colors.keys()) {
      const x = location % SIZE;
      const y = Math.floor(location / SIZE);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) colors.set(ny * SIZE + nx, OUTLINE);
      }
    }
    for (const [location, color] of picture.colors) colors.set(location, color);
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    for (const [location, color] of colors) {
      const x = column * SIZE + (location % SIZE);
      const y = row * SIZE + Math.floor(location / SIZE);
      const offset = (y * width + x) * 4;
      data.set([(color >> 16) & 255, (color >> 8) & 255, color & 255, 255], offset);
    }
    const geometry = new THREE.PlaneGeometry(SIZE / PIXELS, SIZE / PIXELS);
    geometry.translate(0, 1, 0.15);
    const uv = geometry.getAttribute("uv");
    for (let vertex = 0; vertex < uv.count; vertex++)
      uv.setXY(
        vertex,
        (column * SIZE + uv.getX(vertex) * SIZE) / width,
        (row * SIZE + uv.getY(vertex) * SIZE) / height,
      );
    geometries.set(frameKey(frame), geometry);
  });
  const texture = new THREE.DataTexture(data, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  atlas = { material, geometries };
  return atlas;
}

export function createPixelCharacter(enemy: boolean): HumanoidModel {
  const root = new THREE.Group();
  const { material, geometries } = getAtlas();
  const initial = geometries.get(frameKey({ enemy, pose: "standing", step: 0, aim: 0 }));
  if (!initial) throw new Error("Missing standing character frame");
  const body = new THREE.Mesh(initial, material);
  body.renderOrder = enemy ? 1 : 2;
  const gun = new THREE.Group();
  const muzzle = new THREE.Object3D();
  muzzle.position.x = 0.9;
  gun.add(muzzle);
  root.add(body, gun);
  const setPose = (pose: Pose, now: number, moving: boolean, angle: number): void => {
    const step =
      pose === "jumping"
        ? Math.floor(now * 10) % 4
        : pose === "standing" && moving
          ? 1 + (Math.floor(now * 11) % 6)
          : 0;
    let aim = Math.max(-4, Math.min(4, Math.round(angle / (Math.PI / 8))));
    if (pose === "prone" || pose === "diving" || pose === "dead") aim = 0;
    if (pose === "swimming") aim = Math.max(0, aim);
    const geometry = geometries.get(frameKey({ enemy, pose, step, aim }));
    if (geometry) body.geometry = geometry;
    gun.position.set(
      pose === "prone" ? 0.55 : 0,
      pose === "prone" ? 0.32 : pose === "swimming" ? 1.05 : 1.2,
      0.15,
    );
    gun.rotation.z = (aim * Math.PI) / 8;
    gun.visible = pose !== "dead" && pose !== "diving";
  };
  setPose("standing", 0, false, 0);
  return { root, body, gun, muzzle, setPose };
}
