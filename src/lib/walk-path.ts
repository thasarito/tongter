import * as THREE from "three";
import {
  ALL_SEATS,
  DIMS,
  ENTRANCE,
  HALL,
  PROPS,
  TABLES,
  longTableLength,
  seatOutward,
  type Seat,
  type Vec2,
} from "./venue.ts";

/**
 * Walking route from the entrance to a guest's seat.
 *
 * The camera walks at eye level rather than flying over the room, so it cannot
 * simply take a straight line — at 1.6 m it would pass through tables and
 * chairs. This builds an occupancy grid of the hall, runs A* from the door to
 * the space just behind the target chair, then straightens the result so the
 * walk reads as deliberate rather than as a staircase of grid steps.
 *
 * Pure and dependency-light on purpose: scripts/check-walk.ts routes all 170
 * seats through this without a browser or a WebGL context.
 */

/** Grid resolution. The tightest usable gaps are ~0.4 m, so this gives 2-3 cells. */
const CELL = 0.15;

/**
 * Extra clearance used when *planning*, on top of what is used when verifying.
 *
 * Without it A* happily threads gaps that are free by a few millimetres, and
 * the smoothed curve then bows across the obstacle — and even when it does not,
 * a route that shaves a chair by 3 mm makes for a walk that looks like it is
 * scraping the furniture. Planning against inflated obstacles and verifying
 * against the real ones leaves the spline room to breathe.
 */
const PLAN_MARGIN = 0.05;

/** How much space the walker needs around its centre. */
const BODY = 0.2;

/**
 * Tables and props get more room than chairs.
 *
 * Chairs are soft obstacles — real guests squeeze past them, and the 0.8 m
 * aisles between facing chair rows are the only way across the room, so they
 * have to stay passable. Tables are rigid. Keeping them further away also
 * closes the 0.61 m slot between tables 4 and 5, which A* would otherwise
 * thread: it is technically wide enough for a body but makes for an ugly,
 * scraping walk when routing around is barely longer.
 */
const TABLE_CLEARANCE = 0.3;

/** Chairs are treated as discs of this radius before clearance. */
const CHAIR_RADIUS = 0.21;

/** Keeps the walker off the walls. */
const WALL_MARGIN = 0.35;

/** Where the walk stops: just behind the chair, facing it. */
export const GOAL_STANDOFF = 0.8;

export const EYE_HEIGHT = 1.6;

/** Height of the seat the camera looks at on arrival. */
export const SEAT_LOOK_HEIGHT = 0.95;

const COLS = Math.ceil((HALL.maxX - HALL.minX) / CELL) + 1;
const ROWS = Math.ceil((HALL.maxZ - HALL.minZ) / CELL) + 1;

function colOf(x: number): number {
  return Math.round((x - HALL.minX) / CELL);
}
function rowOf(z: number): number {
  return Math.round((z - HALL.minZ) / CELL);
}
function xOf(col: number): number {
  return HALL.minX + col * CELL;
}
function zOf(row: number): number {
  return HALL.minZ + row * CELL;
}

/** Shortest distance from a point to an axis-aligned rectangle, 0 if inside. */
function distanceToRect(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  halfWidth: number,
  halfDepth: number,
): number {
  const dx = Math.max(Math.abs(px - cx) - halfWidth, 0);
  const dz = Math.max(Math.abs(pz - cz) - halfDepth, 0);
  return Math.hypot(dx, dz);
}

/**
 * True when a walker centred here would collide with something.
 *
 * `margin` inflates every obstacle. Planning passes PLAN_MARGIN; verification
 * passes 0, so a route is checked against the real furniture, not the padded
 * version it was planned around.
 *
 * Exported so the checker can assert that generated routes stay clear.
 */
export function isBlocked(x: number, z: number, margin = 0): boolean {
  const wall = WALL_MARGIN + margin;
  if (
    x < HALL.minX + wall ||
    x > HALL.maxX - wall ||
    z < HALL.minZ + wall ||
    z > HALL.maxZ - wall
  ) {
    return true;
  }

  const tableClearance = TABLE_CLEARANCE + margin;

  for (const table of TABLES) {
    if (table.shape === "round") {
      const r = DIMS.roundTableDiameter / 2 + tableClearance;
      if (Math.hypot(x - table.center.x, z - table.center.z) < r) return true;
    } else {
      const d = distanceToRect(
        x,
        z,
        table.center.x,
        table.center.z,
        longTableLength(table) / 2,
        DIMS.longTableDepth / 2,
      );
      if (d < tableClearance) return true;
    }
  }

  for (const prop of Object.values(PROPS)) {
    const d = distanceToRect(
      x,
      z,
      prop.center.x,
      prop.center.z,
      prop.width / 2,
      prop.depth / 2,
    );
    if (d < tableClearance) return true;
  }

  const chairClearance = CHAIR_RADIUS + BODY + margin;
  for (const seat of ALL_SEATS) {
    if (Math.hypot(x - seat.x, z - seat.z) < chairClearance) return true;
  }

  return false;
}

// The grid never changes, so build it once per process.
let grid: Uint8Array | null = null;

function occupancy(): Uint8Array {
  if (grid) return grid;
  const g = new Uint8Array(COLS * ROWS);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      g[row * COLS + col] = isBlocked(xOf(col), zOf(row), PLAN_MARGIN) ? 1 : 0;
    }
  }
  grid = g;
  return g;
}

function isFreeCell(col: number, row: number): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  return occupancy()[row * COLS + col] === 0;
}

/** Nearest walkable cell to a point, searched in expanding rings. */
function nearestFree(x: number, z: number): { col: number; row: number } | null {
  const startCol = colOf(x);
  const startRow = rowOf(z);
  if (isFreeCell(startCol, startRow)) return { col: startCol, row: startRow };

  for (let radius = 1; radius < 40; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        // Only the ring's perimeter is new at this radius.
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue;
        const col = startCol + dc;
        const row = startRow + dr;
        if (isFreeCell(col, row)) return { col, row };
      }
    }
  }
  return null;
}

/** Minimal binary heap; the grid is small enough that this is ample. */
class MinHeap {
  private items: { key: number; priority: number }[] = [];

  push(key: number, priority: number) {
    this.items.push({ key, priority });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) smallest = left;
        if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top.key;
  }

  get size(): number {
    return this.items.length;
  }
}

const SQRT2 = Math.SQRT2;

/** A* over the occupancy grid. Returns cell indices, or null if unreachable. */
function findRoute(
  start: { col: number; row: number },
  goal: { col: number; row: number },
): { col: number; row: number }[] | null {
  const startKey = start.row * COLS + start.col;
  const goalKey = goal.row * COLS + goal.col;

  const cameFrom = new Int32Array(COLS * ROWS).fill(-1);
  const cost = new Float32Array(COLS * ROWS).fill(Infinity);
  const closed = new Uint8Array(COLS * ROWS);

  const heuristic = (col: number, row: number) => {
    // Octile distance, matching the 8-way movement cost.
    const dx = Math.abs(col - goal.col);
    const dz = Math.abs(row - goal.row);
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
  };

  cost[startKey] = 0;
  const open = new MinHeap();
  open.push(startKey, heuristic(start.col, start.row));

  while (open.size > 0) {
    const current = open.pop()!;
    if (current === goalKey) break;
    if (closed[current]) continue;
    closed[current] = 1;

    const col = current % COLS;
    const row = (current - col) / COLS;

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (!isFreeCell(nc, nr)) continue;

        // No cutting diagonally past a corner: both orthogonal neighbours must
        // be clear, otherwise the walker clips a table edge.
        if (dc !== 0 && dr !== 0) {
          if (!isFreeCell(col + dc, row) || !isFreeCell(col, row + dr)) continue;
        }

        const step = dc !== 0 && dr !== 0 ? SQRT2 : 1;
        const next = nr * COLS + nc;
        const tentative = cost[current] + step;
        if (tentative < cost[next]) {
          cost[next] = tentative;
          cameFrom[next] = current;
          open.push(next, tentative + heuristic(nc, nr));
        }
      }
    }
  }

  if (cameFrom[goalKey] === -1 && goalKey !== startKey) return null;

  const path: { col: number; row: number }[] = [];
  let node = goalKey;
  while (node !== -1) {
    const col = node % COLS;
    path.push({ col, row: (node - col) / COLS });
    if (node === startKey) break;
    node = cameFrom[node];
  }
  return path.reverse();
}

/** True when a straight line between two points stays walkable throughout. */
function hasLineOfSight(a: Vec2, b: Vec2): boolean {
  const distance = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.ceil(distance / (CELL * 0.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isBlocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, PLAN_MARGIN)) return false;
  }
  return true;
}

/**
 * String-pulling: drop any waypoint that can be skipped without leaving the
 * walkable area. Turns A*'s staircase into a few long, natural legs.
 */
function straighten(points: Vec2[]): Vec2[] {
  if (points.length <= 2) return points;
  const out: Vec2[] = [points[0]];
  let anchor = 0;

  while (anchor < points.length - 1) {
    let furthest = anchor + 1;
    for (let i = points.length - 1; i > anchor; i--) {
      if (hasLineOfSight(points[anchor], points[i])) {
        furthest = i;
        break;
      }
    }
    out.push(points[furthest]);
    anchor = furthest;
  }

  return out;
}

export interface WalkPath {
  /** Smooth curve through the route, at eye height. */
  curve: THREE.CatmullRomCurve3;
  /** Straightened waypoints, for debugging and verification. */
  waypoints: Vec2[];
  /** Ground distance in metres. */
  length: number;
  /** What the camera looks at once it arrives. */
  lookTarget: THREE.Vector3;
  /**
   * "ok"           — routed and the smoothed curve verified clear
   * "unsmoothed"   — routed, but every smoothing candidate bowed into an
   *                  obstacle; the densest one is used
   * "unreachable"  — no route at all; the camera moves directly
   */
  status: "ok" | "unsmoothed" | "unreachable";
}

/** Comfortable indoor walking speed, in metres per second. */
const WALK_SPEED = 1.35;
const MIN_DURATION_MS = 5000;
const MAX_DURATION_MS = 16000;

export function walkDurationMs(length: number): number {
  return Math.min(
    MAX_DURATION_MS,
    Math.max(MIN_DURATION_MS, (length / WALK_SPEED) * 1000),
  );
}

/** Keeps every nth point, always including the last. */
function decimate(points: Vec2[], stride: number): Vec2[] {
  if (points.length <= 2) return points;
  const out = points.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== points[points.length - 1]) {
    out.push(points[points.length - 1]);
  }
  return out;
}

function toCurve(waypoints: Vec2[]): THREE.CatmullRomCurve3 {
  const points = waypoints.map((p) => new THREE.Vector3(p.x, EYE_HEIGHT, p.z));
  // A curve needs at least two distinct points.
  if (points.length === 1) {
    points.push(points[0].clone().add(new THREE.Vector3(0, 0, -0.1)));
  }
  return new THREE.CatmullRomCurve3(
    points,
    false,
    // Centripetal avoids the overshoot "catmullrom" produces at the sharp
    // corners a corridor route is full of — overshoot here means walking
    // through a chair.
    "centripetal",
    0.5,
  );
}

/** Samples the curve itself, since a spline can bow away from its waypoints. */
function curveIsClear(curve: THREE.CatmullRomCurve3, samples = 200): boolean {
  for (let i = 0; i <= samples; i++) {
    const p = curve.getPointAt(i / samples);
    if (isBlocked(p.x, p.z)) return false;
  }
  return true;
}

function pathLength(waypoints: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += Math.hypot(
      waypoints[i].x - waypoints[i - 1].x,
      waypoints[i].z - waypoints[i - 1].z,
    );
  }
  return total;
}

export function buildWalkPath(seat: Seat): WalkPath {
  const out = seatOutward(seat);
  const goalPoint = {
    x: seat.x + out.x * GOAL_STANDOFF,
    z: seat.z + out.z * GOAL_STANDOFF,
  };

  const start = nearestFree(ENTRANCE.x, ENTRANCE.z);
  const goal = nearestFree(goalPoint.x, goalPoint.z);
  const lookTarget = new THREE.Vector3(seat.x, SEAT_LOOK_HEIGHT, seat.z);

  const route = start && goal ? findRoute(start, goal) : null;

  if (!route || route.length === 0) {
    // Should not happen for any seat on this plan, but a guest must still get
    // *something* rather than a frozen camera.
    const waypoints = [{ x: ENTRANCE.x, z: ENTRANCE.z }, goalPoint];
    return {
      curve: toCurve(waypoints),
      waypoints,
      length: pathLength(waypoints),
      lookTarget,
      status: "unreachable",
    };
  }

  const raw = route.map((c) => ({ x: xOf(c.col), z: zOf(c.row) }));

  const anchor = (points: Vec2[]): Vec2[] => {
    const copy = [...points];
    // Anchor the ends to the true positions rather than cell centres.
    copy[0] = { x: ENTRANCE.x, z: ENTRANCE.z };
    if (hasLineOfSight(copy[copy.length - 1], goalPoint)) {
      copy[copy.length - 1] = goalPoint;
    }
    return copy;
  };

  /*
   * Straightening makes the nicest walk — a few long legs instead of a
   * staircase — but the smoothed curve through widely-spaced waypoints can bow
   * into a table on a tight corner. So try the aggressive version first and
   * fall back to progressively denser waypoints, which hug the A* route that is
   * clear by construction. Each candidate is verified before it is accepted.
   */
  const candidates = [
    anchor(straighten(raw)),
    anchor(decimate(raw, 5)),
    anchor(decimate(raw, 2)),
    anchor(raw),
  ];

  for (const waypoints of candidates) {
    const curve = toCurve(waypoints);
    if (curveIsClear(curve)) {
      return {
        curve,
        waypoints,
        length: pathLength(waypoints),
        lookTarget,
        status: "ok",
      };
    }
  }

  // Densest candidate still bows somewhere; take it and let the checker shout.
  const waypoints = anchor(raw);
  return {
    curve: toCurve(waypoints),
    waypoints,
    length: pathLength(waypoints),
    lookTarget,
    status: "unsmoothed",
  };
}
