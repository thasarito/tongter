import { test } from "vitest";
import assert from "node:assert/strict";
import { pdfCameraPose } from "./pdf-camera";

const stage = { x: 10.94, z: .12, w: 2.55, d: 6.5, h: .45, rotation: 0 };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

// Project the real near-stage corners instead of merely testing camera constants.
function projectFront(mode: "stage" | "head-table" | "cake-table", aspect = 13 / 9) {
  const pose = pdfCameraPose(stage, mode, aspect);
  assert.ok(pose, "A stage must produce a PDF camera pose");
  const dx = pose.target[0] - pose.position[0];
  const pitch = Math.atan2(pose.target[1] - pose.position[1], dx);
  const distance = stage.x - stage.w / 2 - pose.position[0];
  const depth = distance * Math.cos(pitch) - pose.position[1] * Math.sin(pitch);
  const vertical = -distance * Math.sin(pitch) - pose.position[1] * Math.cos(pitch);
  const tangent = Math.tan(pose.fov * Math.PI / 360);
  return { pose, coverage: stage.d / (2 * depth * aspect * tangent), bottom: .5 - vertical / (2 * depth * tangent) };
}

test("PDF page 3 fills the frame with the centered stage instead of the entrance", () => {
  const { pose, coverage, bottom } = projectFront("stage");
  near(coverage, .96); near(bottom, .875);
  near(pose.position[2], stage.z); near(pose.target[2], stage.z);
  assert.equal(pose.page, 3);
  assert.ok(pose.position[0] > 5 && pose.position[0] < stage.x - stage.w / 2);
});

test("PDF pages 4 and 5 have their own closer framing", () => {
  const a = projectFront("stage"), b = projectFront("head-table"), c = projectFront("cake-table");
  near(b.coverage, 1.10); near(b.bottom, .95); assert.equal(b.pose.page, 4);
  near(c.coverage, 1.06); near(c.bottom, .935); assert.equal(c.pose.page, 5);
  assert.ok(b.pose.position[0] > a.pose.position[0]);
  assert.ok(c.pose.position[0] > a.pose.position[0]);
});

test("camera follows stage translation and rotation without mutating layout geometry", () => {
  const source = Object.freeze({ ...stage });
  const original = pdfCameraPose(source, "stage", 13 / 9)!;
  const shifted = pdfCameraPose({ ...source, x: source.x - 3, z: source.z + 2 }, "stage", 13 / 9)!;
  near(shifted.position[0], original.position[0] - 3);
  near(shifted.position[2], original.position[2] + 2);
  const rotated = pdfCameraPose({ ...source, rotation: 90 }, "stage", 13 / 9)!;
  near(rotated.position[0], source.x);
  near(rotated.position[2], source.z + original.position[0] - source.x);
  assert.deepEqual(source, stage);
});

test("portrait framing contains the full stage width", () => {
  const { coverage, bottom } = projectFront("head-table", 390 / 844);
  near(coverage, .9); near(bottom, .88);
});

test("missing stages and invalid viewports are handled without NaN poses", () => {
  assert.equal(pdfCameraPose(undefined, "stage", 13 / 9), null);
  assert.equal(pdfCameraPose(stage, "stage", 0), null);
  assert.equal(pdfCameraPose(stage, "stage", Number.NaN), null);
  const pose = pdfCameraPose({ ...stage, d: .3, w: .3 }, "stage", 13 / 9)!;
  assert.ok(pose && [...pose.position, ...pose.target, pose.fov].every(Number.isFinite));
});
