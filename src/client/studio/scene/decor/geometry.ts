/** Visual proportions estimated from art-direction pages 3–5, not a survey.
 * All decor uses stage-local coordinates: +X screen-right, +Z toward the audience.
 * Helpers are renderer-independent and never modify sheet-backed objects. */
export type Vec3 = [number, number, number];
export interface StageDimensions { x: number; z: number; w: number; d: number; h: number; rotation: number }
export const DECOR_COLORS = { carpet: "#513a24", riser: "#65492d", fabric: "#f7f4ee", board: "#e8e6e2" } as const;
export const noDecorRaycast = () => {};

export function stageTiers(stage: Pick<StageDimensions, "w" | "d" | "h">) {
  const tread = Math.min(.23, stage.w * .12), edge = Math.min(.09, stage.d * .025);
  return [0, 1, 2].map(i => ({
    width: stage.d - i * edge * 2, depth: stage.w - i * tread,
    height: stage.h * (i + 1) / 3, front: stage.w / 2 - i * tread,
  }));
}
export function decorPosition(stage: StageDimensions, [u, v, depth]: Vec3): Vec3 {
  const angle = stage.rotation * Math.PI / 180, x = -depth, z = u;
  return [stage.x + x * Math.cos(angle) - z * Math.sin(angle), stage.h + .012 + v,
    stage.z + x * Math.sin(angle) + z * Math.cos(angle)];
}
export function decorTransform(stage: StageDimensions): { position: Vec3; rotation: Vec3; scale: Vec3 } {
  const widthScale = stage.d / 6.5;
  return { position: decorPosition(stage, [0, 0, 0]), rotation: [0, -Math.PI / 2 - stage.rotation * Math.PI / 180, 0],
    scale: [widthScale, Math.min(1.25, widthScale), stage.w / 2.55] };
}
export interface CurtainShape { width: number; height: number; lean?: number; pool?: number }
export function curtainPoint(u: number, v: number, { width, height, lean = 0, pool = .4 }: CurtainShape): Vec3 {
  const fold = Math.cos(u * Math.PI * 22 + .25 * Math.sin(v * 6));
  const pooling = Math.max(0, (v - .87) / .13);
  return [(u - .5) * width * (.65 + .35 * v) + lean * v * v,
    Math.max(.012, height * (1 - v) - pooling * .10) + pooling * .012 * (1 + fold),
    fold * .035 * (.65 + v) + pool * pooling * pooling];
}
export interface SwagShape { width: number; height: number; sag: number; band?: number; tilt?: number }
export function swagPoint(u: number, v: number, { width, height, sag, band = .24, tilt = 0 }: SwagShape): Vec3 {
  const hang = Math.sin(Math.PI * u), pleat = Math.sin(v * Math.PI * 8 + u * 2);
  return [(u - .5) * width,
    height + tilt * (u - .5) - sag * Math.pow(hang, .78) - band * v * (.12 + .88 * hang),
    .055 * pleat * hang + .12 * hang * hang + .06 * v];
}
export function roundClothPoint(u: number, v: number, radius = .56, height = .78): Vec3 {
  const angle = u * Math.PI * 2, fold = Math.cos(angle * 32);
  const r = radius + .10 * Math.pow(v, 5) + .018 * fold * (.3 + v);
  return [r * Math.cos(angle), height * (1 - v) + .012, r * Math.sin(angle)];
}
export interface FlowerClump { center: Vec3; radius: Vec3; count: number; seed: number; tone?: "ivory" | "blush" | "lime" }
export interface FlowerHead { position: Vec3; radius: number; tint: number; turn: number }
/** Seeded once per arrangement: no render-time randomness, bounded instance count. */
export function flowerHeads(clump: FlowerClump): FlowerHead[] {
  let state = clump.seed >>> 0;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const count = Number.isFinite(clump.count) ? Math.max(0, Math.min(500, Math.floor(clump.count))) : 0;
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2, y = random() * 2 - 1, r = Math.cbrt(.25 + .75 * random());
    const ring = Math.sqrt(1 - y * y), unit = [r * ring * Math.cos(angle), r * y, r * ring * Math.sin(angle)];
    return { position: clump.center.map((c, i) => c + clump.radius[i] * unit[i]) as Vec3,
      radius: .027 + random() * .042, tint: random(), turn: random() * Math.PI * 2 };
  });
}
