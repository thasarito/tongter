// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { wordmarkGeometry } from "./wordmark";

it("turns the actual wedding SVG into visible centered outlines without a raster texture", () => {
  const source = readFileSync("public/logo.svg", "utf8");
  const geometry = wordmarkGeometry(new SVGLoader().parse(source));
  expect(geometry.getAttribute("position").count).toBeGreaterThan(200);
  const box = geometry.boundingBox!;
  expect(box.max.x - box.min.x).toBeGreaterThan(.9);
  expect(box.max.y - box.min.y).toBeGreaterThan(.3);
  expect(Math.abs(box.max.x + box.min.x)).toBeLessThan(.06);
  expect(Math.abs(box.max.y + box.min.y)).toBeLessThan(.06);
  expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
  geometry.dispose();
});
