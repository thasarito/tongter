import type { DecorationMode, StudioItem } from "../model/schema";

type StageGeometry = Pick<StudioItem, "x" | "z" | "w" | "d" | "h" | "rotation">;
export interface PdfCameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  page: number;
}

// Visual estimates from art-direction pages 3–5, not surveyed lens metadata.
// Width is the near-stage edge as a fraction of the frame; bottom is its
// baseline measured down the image. Pages 4–5 intentionally crop the corners.
const shots = {
  stage: { page: 3, width: .96, bottom: .875 },
  "head-table": { page: 4, width: 1.10, bottom: .95 },
  "cake-table": { page: 5, width: 1.06, bottom: .935 },
} as const;

/** Front-on perspective in the stage's local -X direction. No layout writes. */
export function pdfCameraPose(stage: StageGeometry | undefined, mode: DecorationMode, aspect: number): PdfCameraPose | null {
  if (!stage || !Number.isFinite(aspect) || aspect <= 0) return null;
  const shot = shots[mode], fov = 68, tangent = Math.tan(fov * Math.PI / 360);
  const eye = Math.max(1.2, stage.h + 1.22);
  const coverage = aspect < 1 ? .9 : shot.width;
  const bottom = aspect < 1 ? .88 : shot.bottom;
  // Solve perspective depth and upward pitch from the two screen-space anchors.
  // The lower bound keeps unusually small/custom stages finite and viewable.
  const depth = Math.max(stage.d / (2 * coverage * aspect * tangent), eye * 1.05);
  const verticalRatio = (2 * bottom - 1) * tangent;
  const standOff = Math.sqrt(depth * depth * (1 + verticalRatio * verticalRatio) - eye * eye);
  const pitch = Math.atan(verticalRatio) - Math.atan2(eye, standOff);
  const distance = stage.w / 2 + standOff, rotation = stage.rotation * Math.PI / 180;
  return {
    position: [stage.x - Math.cos(rotation) * distance, eye, stage.z - Math.sin(rotation) * distance],
    target: [stage.x, eye + Math.tan(pitch) * distance, stage.z],
    fov, page: shot.page,
  };
}
