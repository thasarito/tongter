/**
 * Verifies the walking route for every one of the 170 seats.
 * Run: pnpm check:walk
 *
 * A walking camera is far less forgiving than a flying one: at eye level any
 * routing mistake means walking through a table. This routes all 170 seats and
 * samples each curve densely, asserting the walker never enters a blocked cell.
 */
import { buildWalkPath, isBlocked, walkDurationMs, GOAL_STANDOFF } from "../src/lib/walk-path.ts";
import { ALL_SEATS, HALL } from "../src/lib/venue.ts";

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
  if (duration < 3000 || duration > 16500) {
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
