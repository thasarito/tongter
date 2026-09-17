import { ShapeGeometry } from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

/** Outline geometry avoids browser-dependent rasterization of a viewBox-only SVG. */
export function wordmarkGeometry(data: ReturnType<SVGLoader["parse"]>) {
  const shapes = data.paths.flatMap(path => SVGLoader.createShapes(path));
  const geometry = new ShapeGeometry(shapes, 6);
  geometry.translate(-759 / 2, -276 / 2, 0);
  geometry.scale(1 / 759, -1 / 759, 1);
  geometry.computeBoundingBox();
  return geometry;
}
