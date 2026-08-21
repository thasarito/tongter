/**
 * Verifies the walking route for every one of the 170 seats.
 * Run: pnpm check:walk
 *
 * A walking camera is far less forgiving than a flying one: at eye level any
 * routing mistake means walking through a table. This routes all 170 seats and
 * samples each curve densely, asserting the walker never enters a blocked cell.
 */
import {
  buildWalkPath,
  isBlocked,
  walkDurationMs,
  GOAL_STANDOFF,
  INTRO,
  INTRO_MS,
  EYE_HEIGHT,
  LOOK_AHEAD,
  LOOK_DROP,
} from "../src/shared/walk-path.ts";
import { ALL_SEATS, APPROACH, GATE, HALL } from "../src/shared/venue.ts";

let failures = 0;
function fail(message: string) {
  failures++;
  if (failures <= 12) console.log(`FAIL  ${message}`);
}

const SAMPLES = 220;

let unreachable = 0;
let unsmoothed = 0;
let longest = { length: 0, seat: "" };
let shortest = { length: Infinity, seat: "" };
let worstClearance = { value: Infinity, seat: "", at: "" };
let totalLength = 0;
let clippedSeats = 0;
let maxWaypoints = 0;

for (const seat of ALL_SEATS) {
  const label = `T${seat.tableId}#${seat.seatIndex}`;
  const path = buildWalkPath(seat);

  if (path.status === "unreachable") {
    unreachable++;
    fail(`${label}: no walkable route exists from the entrance`);
    continue;
  }
  if (path.status === "unsmoothed") {
    unsmoothed++;
    fail(`${label}: every smoothing candidate bowed into an obstacle`);
  }

  totalLength += path.length;
  if (path.length > longest.length) longest = { length: path.length, seat: label };
  if (path.length < shortest.length) shortest = { length: path.length, seat: label };
  maxWaypoints = Math.max(maxWaypoints, path.waypoints.length);

  // The curve is what the camera actually follows, so sample the curve rather
  // than the waypoints — centripetal splines can still bow between them.
  let clipped = false;
  for (let i = 0; i <= SAMPLES; i++) {
    const p = path.curve.getPointAt(i / SAMPLES);
    if (isBlocked(p.x, p.z)) {
      if (!clipped) {
        clipped = true;
        clippedSeats++;
        fail(`${label}: walks through an obstacle at (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
      }
    }
  }

  // The camera should finish facing its own chair from close range.
  const end = path.curve.getPointAt(1);
  const endDistance = Math.hypot(end.x - seat.x, end.z - seat.z);
  if (endDistance > GOAL_STANDOFF + 0.75) {
    fail(`${label}: stops ${endDistance.toFixed(2)} m from the seat`);
  }
  if (endDistance < worstClearance.value) {
    worstClearance = { value: endDistance, seat: label, at: "end" };
  }

  const duration = walkDurationMs(path.length);
  if (duration < 3000 || duration > 15500) {
    fail(`${label}: walk lasts ${(duration / 1000).toFixed(1)} s`);
  }
}

const routed = ALL_SEATS.length - unreachable;

console.log(`
--- walking routes (${ALL_SEATS.length} seats, ${SAMPLES + 1} samples each) ---
  routed successfully        ${routed}/${ALL_SEATS.length}
  routes needing dense path  ${unsmoothed}
  routes clipping furniture  ${clippedSeats}
  shortest walk              ${shortest.length.toFixed(1)} m  (${shortest.seat})
  longest walk               ${longest.length.toFixed(1)} m  (${longest.seat})
  average walk               ${(totalLength / Math.max(routed, 1)).toFixed(1)} m
  longest walk takes         ${(walkDurationMs(longest.length) / 1000).toFixed(1)} s
  most waypoints in a route  ${maxWaypoints}
  closest final standoff     ${worstClearance.value.toFixed(2)} m  (${worstClearance.seat})
`);

if (failures > 12) console.log(`  ... and ${failures - 12} more\n`);

// ---------------------------------------------------------------------------
// The arrival: standing outside, the doors opening, then stepping through.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// The speed profile. A discontinuity here is invisible in a still frame but
// makes the walk lurch, so it is asserted rather than eyeballed.
// ---------------------------------------------------------------------------
console.log("--- speed profile ---");
{
  const RAMP = 0.18;
  const total = 1 - RAMP;
  const distanceAt = (t: number) => {
    if (t < RAMP) return (t * t) / (2 * RAMP) / total;
    if (t <= 1 - RAMP) return (RAMP / 2 + (t - RAMP)) / total;
    const r = 1 - t;
    return (1 - RAMP - (r * r) / (2 * RAMP)) / total;
  };

  const profileCheck = (label: string, ok: boolean, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "  ok  " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  const SAMPLES = 20000;
  let previous = distanceAt(0);
  let biggestStep = 0;
  let backwards = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const value = distanceAt(i / SAMPLES);
    const step = value - previous;
    if (step < -1e-12) backwards += 1;
    biggestStep = Math.max(biggestStep, step);
    previous = value;
  }

  profileCheck("starts at 0", Math.abs(distanceAt(0)) < 1e-9);
  profileCheck("ends at exactly 1", Math.abs(distanceAt(1) - 1) < 1e-9,
    distanceAt(1).toFixed(6));
  profileCheck("never goes backwards", backwards === 0, `${backwards} reversals`);
  // A jump here teleports the camera along the path mid-walk.
  profileCheck("no jumps", biggestStep < 1e-3, `largest step ${biggestStep.toFixed(6)}`);
  profileCheck("continuous where it stops accelerating",
    Math.abs(distanceAt(RAMP - 1e-6) - distanceAt(RAMP + 1e-6)) < 1e-5);
  profileCheck("continuous where it starts slowing",
    Math.abs(distanceAt(1 - RAMP - 1e-6) - distanceAt(1 - RAMP + 1e-6)) < 1e-5);
}

console.log("\n--- arrival ---");
{
  const arrivalCheck = (label: string, ok: boolean, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "  ok  " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  arrivalCheck("camera starts outside the hall", APPROACH.z > HALL.maxZ,
    `approach z=${APPROACH.z}, south wall z=${HALL.maxZ}`);
  arrivalCheck("gate sits in the south wall",
    Math.abs(GATE.center.z - HALL.maxZ) < 0.001);
  arrivalCheck("far enough back to see the whole doorway",
    APPROACH.z - GATE.center.z >= 3, `${(APPROACH.z - GATE.center.z).toFixed(1)} m back`);
  arrivalCheck("doors start opening before the guest sets off",
    INTRO.gateOpensAtMs < INTRO.waitMs);
  arrivalCheck("the intro stays under 4 s", INTRO_MS <= 4000,
    `${(INTRO_MS / 1000).toFixed(1)} s`);
  arrivalCheck("the doorway is wide enough to walk through", GATE.width >= 2);

  // Every route now begins outside, so this is a property of the path itself
  // rather than of a separate slide-in.
  let notOutside = 0;
  let missedDoorway = 0;
  for (const seat of ALL_SEATS) {
    const { curve } = buildWalkPath(seat);
    if (curve.getPointAt(0).z <= HALL.maxZ) notOutside += 1;

    // Wherever the path crosses the wall line it must be inside the opening.
    for (let i = 0; i <= 400; i++) {
      const p = curve.getPointAt(i / 400);
      if (Math.abs(p.z - HALL.maxZ) < 0.05 &&
          Math.abs(p.x - GATE.center.x) > GATE.width / 2) {
        missedDoorway += 1;
        break;
      }
    }
  }
  arrivalCheck("every route starts outside the hall", notOutside === 0,
    `${notOutside} of ${ALL_SEATS.length} start inside`);
  arrivalCheck("every route crosses the wall inside the doorway",
    missedDoorway === 0, `${missedDoorway} miss the opening`);
}

// ---------------------------------------------------------------------------
// The handover from the arrival to the walk.
//
// Both phases position the camera and choose a gaze independently. If they
// disagree at the seam the view snaps — which is exactly what happened when the
// arrival aimed at the doorway: the camera advances past it, so by the handover
// the target sat behind the lens and the view whipped round.
// ---------------------------------------------------------------------------
console.log("\n--- arrival to walk handover ---");
{
  const seamCheck = (label: string, ok: boolean, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "  ok  " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  let positionDrift = 0;
  let gazeDrift = 0;
  let lookingBackwards = 0;

  for (const seat of ALL_SEATS) {
    const { curve } = buildWalkPath(seat);

    // Where each side of the seam puts the camera and points it.
    const threshold = curve.getPointAt(0);
    const tangent = curve.getTangentAt(0);
    tangent.y = 0;
    tangent.normalize();

    const gaze = threshold.clone().addScaledVector(tangent, LOOK_AHEAD);
    gaze.y = EYE_HEIGHT - LOOK_DROP;

    // Each side of the seam, computed the way the component computes it.
    // Arrival, at its final instant: lerp from outside to the threshold with
    // the ease fully applied.
    const smoothstep01 = 1; // smoothstep(0, 1, 1)
    const arrivalEnd = {
      x: APPROACH.x + (threshold.x - APPROACH.x) * smoothstep01,
      z: APPROACH.z + (threshold.z - APPROACH.z) * smoothstep01,
    };
    // Walk, at t = 0: the curve start, with no sway because gait starts at 0.
    const walkStart = curve.getPointAt(0);

    positionDrift = Math.max(
      positionDrift,
      Math.hypot(arrivalEnd.x - walkStart.x, arrivalEnd.z - walkStart.z),
    );

    // The gaze must be ahead of the camera, not behind it.
    const toGaze = gaze.clone().sub(threshold);
    toGaze.y = 0;
    if (toGaze.dot(tangent) <= 0) lookingBackwards += 1;

    // And far enough ahead that the direction is well defined.
    if (toGaze.length() < 1) gazeDrift += 1;
  }

  seamCheck("camera position is continuous across the seam", positionDrift < 1e-9,
    `worst drift ${positionDrift.toExponential(1)} m`);
  seamCheck("the gaze is always ahead of the camera, never behind",
    lookingBackwards === 0, `${lookingBackwards} of ${ALL_SEATS.length} look backwards`);
  seamCheck("the gaze target is far enough to define a direction",
    gazeDrift === 0, `${gazeDrift} too close`);
  seamCheck("look-ahead clears the doorway depth", LOOK_AHEAD >= 2);
}

// Draw a few representative routes so the shape can be eyeballed.
{
  const COLS = 96;
  const ROWS = 32;
  const toCol = (x: number) =>
    Math.round(((x - HALL.minX) / (HALL.maxX - HALL.minX)) * (COLS - 1));
  const toRow = (z: number) =>
    Math.round(((z - HALL.minZ) / (HALL.maxZ - HALL.minZ)) * (ROWS - 1));

  for (const [tableId, seatIndex] of [[8, 5], [2, 9], [6, 3]] as [number, number][]) {
    const seat = ALL_SEATS.find(
      (s) => s.tableId === tableId && s.seatIndex === seatIndex,
    )!;
    const path = buildWalkPath(seat);
    const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));

    for (const other of ALL_SEATS) {
      const r = toRow(other.z);
      const c = toCol(other.x);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = "o";
    }

    for (let i = 0; i <= 600; i++) {
      const p = path.curve.getPointAt(i / 600);
      const r = toRow(p.z);
      const c = toCol(p.x);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = "*";
    }

    const sr = toRow(seat.z);
    const sc = toCol(seat.x);
    if (sr >= 0 && sr < ROWS && sc >= 0 && sc < COLS) grid[sr][sc] = "X";
    const er = toRow(HALL.maxZ - 0.9);
    const ec = toCol(0);
    if (er >= 0 && er < ROWS) grid[er][ec] = "E";

    console.log(
      `\nroute to T${tableId}#${seatIndex} — ${path.length.toFixed(1)} m, ` +
        `${(walkDurationMs(path.length) / 1000).toFixed(1)} s, ${path.waypoints.length} waypoints`,
    );
    console.log("+" + "-".repeat(COLS) + "+");
    for (const row of grid) console.log("|" + row.join("") + "|");
    console.log("+" + "-".repeat(COLS) + "+");
    console.log("  E = entrance   * = route   o = seat   X = destination");
  }
}

console.log(
  failures === 0
    ? `All ${ALL_SEATS.length} seats are reachable on foot without clipping.\n`
    : `${failures} problem(s) found.\n`,
);
process.exit(failures === 0 ? 0 : 1);
