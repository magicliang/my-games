import type { GameRuntime } from "./runtime";
import { SURFACES, type Surface } from "./stage";

export function surfacesAt(runtime: GameRuntime, x: number): Surface[] {
  const surfaces = SURFACES.filter((s) => x >= s.start && x <= s.end);
  for (const bridge of runtime.bridges) {
    if (!bridge.destroyed && x >= bridge.start && x <= bridge.end) {
      surfaces.push({ id: bridge.id, start: bridge.start, end: bridge.end, y: 0, kind: "bridge" });
    }
  }
  return surfaces;
}

export function landingSurface(
  runtime: GameRuntime,
  x: number,
  previousY: number,
  nextY: number,
  dropThrough: boolean,
): Surface | undefined {
  return surfacesAt(runtime, x)
    .filter(
      (surface) =>
        !(dropThrough && surface.kind === "platform") &&
        previousY >= surface.y - 0.001 &&
        nextY <= surface.y,
    )
    .sort((a, b) => b.y - a.y)[0];
}

export function floorAt(runtime: GameRuntime, x: number): Surface | undefined {
  return surfacesAt(runtime, x)
    .filter((s) => s.kind !== "platform")
    .sort((a, b) => b.y - a.y)[0];
}
