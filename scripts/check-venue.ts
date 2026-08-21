/**
 * Sanity-checks the venue geometry against the seating plan.
 * Run: pnpm check:venue
 */
import {
  ALL_SEATS,
  DIMS,
  HALL,
  PROPS,
  TABLES,
  TOTAL_SEATS,
  getSeat,
  longTableLength,
  seatOutward,
} from "../src/lib/venue.ts";

const EXPECTED: Record<number, number> = {
  1: 24,
  2: 18,
  3: 24,
  4: 30,
  5: 24,
  6: 10,
  7: 10,
  8: 10,
  9: 10,
  10: 10,
};

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("\n--- seat counts ---");
check("total seats is 170", TOTAL_SEATS === 170, `got ${TOTAL_SEATS}`);
check("ALL_SEATS length matches", ALL_SEATS.length === 170, `got ${ALL_SEATS.length}`);
for (const [id, seats] of Object.entries(EXPECTED)) {
  const table = TABLES.find((t) => t.id === Number(id));
  check(`table ${id} has ${seats} seats`, table?.seats === seats, `got ${table?.seats}`);
}

console.log("\n--- seat lookup ---");
check("every seat is retrievable by (table, index)",
  ALL_SEATS.every((s) => getSeat(s.tableId, s.seatIndex) !== undefined));
check("unknown seat returns undefined", getSeat(4, 31) === undefined);
check("unknown table returns undefined", getSeat(11, 1) === undefined);

console.log("\n--- collisions ---");
// Chairs are ~0.5 m wide; anything closer than 0.45 m centre-to-centre would
// have guests physically overlapping.
const MIN_GAP = 0.45;
let worst = { gap: Infinity, a: "", b: "" };
for (let i = 0; i < ALL_SEATS.length; i++) {
  for (let j = i + 1; j < ALL_SEATS.length; j++) {
    const a = ALL_SEATS[i];
    const b = ALL_SEATS[j];
    const gap = Math.hypot(a.x - b.x, a.z - b.z);
    if (gap < worst.gap) {
      worst = {
        gap,
        a: `T${a.tableId}#${a.seatIndex}`,
        b: `T${b.tableId}#${b.seatIndex}`,
      };
    }
  }
}
check(`closest two seats are >= ${MIN_GAP} m apart`, worst.gap >= MIN_GAP,
  `${worst.gap.toFixed(2)} m between ${worst.a} and ${worst.b}`);

console.log("\n--- hall bounds ---");
const PAD = 0.4;
const outside = ALL_SEATS.filter(
  (s) =>
    s.x < HALL.minX + PAD ||
    s.x > HALL.maxX - PAD ||
    s.z < HALL.minZ + PAD ||
    s.z > HALL.maxZ - PAD,
);
check("all seats sit inside the hall walls", outside.length === 0,
  outside.length ? `${outside.length} outside, e.g. T${outside[0].tableId}#${outside[0].seatIndex}` : "");

for (const [name, p] of Object.entries(PROPS)) {
  const halfW = p.width / 2;
  const halfD = p.shape === "round" ? p.width / 2 : p.depth / 2;
  const okX = p.center.x - halfW >= HALL.minX && p.center.x + halfW <= HALL.maxX;
  const okZ = p.center.z - halfD >= HALL.minZ && p.center.z + halfD <= HALL.maxZ;
  check(`prop "${name}" is inside the hall`, okX && okZ);
  // Props must not sit on top of anyone.
  const clash = ALL_SEATS.find((s) =>
    p.shape === "round"
      ? Math.hypot(s.x - p.center.x, s.z - p.center.z) < halfW + DIMS.chairClearance
      : Math.abs(s.x - p.center.x) < halfW + DIMS.chairClearance &&
        Math.abs(s.z - p.center.z) < halfD + DIMS.chairClearance,
  );
  check(`prop "${name}" does not overlap a seat`, !clash,
    clash ? `hits T${clash.tableId}#${clash.seatIndex}` : "");
}

console.log("\n--- table footprints ---");
for (const t of TABLES) {
  if (t.shape !== "long") continue;
  const len = longTableLength(t);
  const west = t.center.x - len / 2;
  const east = t.center.x + len / 2;
  check(`table ${t.id} (${len.toFixed(2)} m) fits`, west > HALL.minX && east < HALL.maxX,
    `x ${west.toFixed(2)} .. ${east.toFixed(2)}`);
}

// Long tables that share a row must not overlap in x.
const rows = new Map<string, typeof TABLES[number][]>();
for (const t of TABLES) {
  if (t.shape !== "long") continue;
  const key = t.center.z.toFixed(2);
  rows.set(key, [...(rows.get(key) ?? []), t]);
}
for (const [z, tables] of rows) {
  if (tables.length < 2) continue;
  const sorted = [...tables].sort((a, b) => a.center.x - b.center.x);
  for (let i = 0; i < sorted.length - 1; i++) {
    const aEast = sorted[i].center.x + longTableLength(sorted[i]) / 2;
    const bWest = sorted[i + 1].center.x - longTableLength(sorted[i + 1]) / 2;
    check(`tables ${sorted[i].id}/${sorted[i + 1].id} (row z=${z}) do not overlap`,
      bWest > aEast, `gap ${(bWest - aEast).toFixed(2)} m`);
  }
}

console.log("\n--- chair orientation ---");
{
  // A chair faces (sin rotationY, cos rotationY). Stepping along that direction
  // must move toward the table centre; stepping along seatOutward must move away.
  let facingWrong = 0;
  let outwardWrong = 0;
  for (const seat of ALL_SEATS) {
    const table = TABLES.find((t) => t.id === seat.tableId)!;
    const distNow = Math.hypot(seat.x - table.center.x, seat.z - table.center.z);

    const fx = seat.x + Math.sin(seat.rotationY) * 0.1;
    const fz = seat.z + Math.cos(seat.rotationY) * 0.1;
    if (Math.hypot(fx - table.center.x, fz - table.center.z) >= distNow) facingWrong++;

    const out = seatOutward(seat);
    const ox = seat.x + out.x * 0.1;
    const oz = seat.z + out.z * 0.1;
    if (Math.hypot(ox - table.center.x, oz - table.center.z) <= distNow) outwardWrong++;
  }
  check("every chair faces its table", facingWrong === 0, `${facingWrong} facing away`);
  check("seatOutward points away from the table", outwardWrong === 0,
    `${outwardWrong} pointing inward`);
}

console.log("\n--- aisles ---");
// Guests must be able to walk between the back-to-back chair rows of adjacent
// long tables. Anything under ~0.7 m is not passable.
//
// Long tables only: a round table's ten chairs sit at seven different z values
// on one ring, so treating each as a "row" would compare seats that are simply
// neighbours around the same table. Round-table spacing is covered by the
// collision check above and the ring check below.
const MIN_AISLE = 0.7;
const longSeats = ALL_SEATS.filter(
  (s) => TABLES.find((t) => t.id === s.tableId)?.shape === "long",
);
const rowZs = [...new Set(longSeats.map((s) => Number(s.z.toFixed(3))))].sort((a, b) => a - b);
for (let i = 0; i < rowZs.length - 1; i++) {
  const gap = rowZs[i + 1] - rowZs[i] - 2 * DIMS.chairClearance;
  // The two sides of one table are separated by the table itself, not an aisle.
  const sameTable = longSeats.some(
    (a) =>
      Number(a.z.toFixed(3)) === rowZs[i] &&
      longSeats.some(
        (b) => b.tableId === a.tableId && Number(b.z.toFixed(3)) === rowZs[i + 1],
      ),
  );
  if (sameTable) continue;
  check(`aisle between chair rows z=${rowZs[i].toFixed(2)} and z=${rowZs[i + 1].toFixed(2)}`,
    gap >= MIN_AISLE, `${gap.toFixed(2)} m`);
}

// Adjacent round tables must not have overlapping chair rings.
const roundTables = TABLES.filter((t) => t.shape === "round");
for (let i = 0; i < roundTables.length; i++) {
  for (let j = i + 1; j < roundTables.length; j++) {
    const a = roundTables[i];
    const b = roundTables[j];
    const gap =
      Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z) -
      2 * DIMS.roundTableSeatRadius;
    // Only complain about tables that are actually near each other.
    if (gap > 3) continue;
    check(`round tables ${a.id}/${b.id} rings clear`, gap >= 0.4, `${gap.toFixed(2)} m`);
  }
}

console.log("\n--- layout summary ---");
for (const t of TABLES) {
  const size = t.shape === "long"
    ? `${longTableLength(t).toFixed(1)}m x ${DIMS.longTableDepth}m`
    : `d${DIMS.roundTableDiameter}m`;
  console.log(
    `  T${String(t.id).padEnd(2)} ${t.shape.padEnd(5)} ${String(t.seats).padStart(2)} seats  ` +
      `centre (${t.center.x.toFixed(2).padStart(6)}, ${t.center.z.toFixed(2).padStart(6)})  ${size}`,
  );
}

// ---------------------------------------------------------------------------
// ASCII plan view — eyeball this against docs/seat_plan.jpg.
// ---------------------------------------------------------------------------
console.log("\n--- plan view (north at top, same orientation as the JPEG) ---\n");
{
  const COLS = 96;
  const ROWS = 34;
  const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));

  const toCol = (x: number) =>
    Math.round(((x - HALL.minX) / (HALL.maxX - HALL.minX)) * (COLS - 1));
  const toRow = (z: number) =>
    Math.round(((z - HALL.minZ) / (HALL.maxZ - HALL.minZ)) * (ROWS - 1));

  const put = (r: number, c: number, ch: string) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && grid[r][c] === " ") grid[r][c] = ch;
  };

  const PROP_CHAR: Record<string, string> = {
    bar: "B", stage: "S", band: "N", cakeTable: "C",
  };
  for (const [name, p] of Object.entries(PROPS)) {
    const ch = PROP_CHAR[name] ?? "#";
    const halfD = p.shape === "round" ? p.width / 2 : p.depth / 2;
    for (let z = p.center.z - halfD; z <= p.center.z + halfD; z += 0.2) {
      for (let x = p.center.x - p.width / 2; x <= p.center.x + p.width / 2; x += 0.2) {
        if (p.shape === "round" &&
            Math.hypot(x - p.center.x, z - p.center.z) > p.width / 2) continue;
        put(toRow(z), toCol(x), ch);
      }
    }
  }

  for (const s of ALL_SEATS) put(toRow(s.z), toCol(s.x), "o");

  // Table numbers overwrite whatever is under them so they stay readable.
  for (const t of TABLES) {
    const label = String(t.id);
    const r = toRow(t.center.z);
    const c = toCol(t.center.x) - Math.floor(label.length / 2);
    for (let i = 0; i < label.length; i++) {
      if (r >= 0 && r < ROWS && c + i >= 0 && c + i < COLS) grid[r][c + i] = label[i];
    }
  }

  const border = "+" + "-".repeat(COLS) + "+";
  console.log(border);
  for (const row of grid) console.log("|" + row.join("") + "|");
  console.log(border);
  console.log("  o = seat   B = bar   S = stage   N = band   C = cake   digits = table");
  console.log("  entrance is bottom-centre\n");
}

console.log(
  failures === 0
    ? `All checks passed. ${TOTAL_SEATS} seats across ${TABLES.length} tables.\n`
    : `${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
