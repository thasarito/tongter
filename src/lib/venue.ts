/**
 * Venue geometry — the single source of truth for where every seat is.
 *
 * The layout is fixed and never changes, so it lives in code rather than in the
 * Google Sheet. The Sheet only says *who* sits at (tableId, seatIndex); this
 * file says *where* that is, in metres, for both the 2D map and the 3D scene.
 *
 * Table positions come from docs/seat_plan.jpg. East–west placement is traced
 * directly: screenshot pixels map to world metres via PX_TO_M about the image
 * centre. North–south placement is *not* traced — the screenshot is a schematic
 * that packs its rows tighter than real furniture allows (tracing it puts the
 * chairs of tables 3 and 4 only 0.40 m apart, back to back). Instead each table
 * is assigned to a named row whose spacing accounts for real chairs and a
 * walkable aisle. Row order and left-to-right arrangement match the plan, so
 * the layout still reads as the same room.
 */

export type TableShape = "long" | "round";

export interface Vec2 {
  x: number;
  z: number;
}

export interface TableDef {
  id: number;
  shape: TableShape;
  /** Total seats; long tables are always an even number, split across two sides. */
  seats: number;
  center: Vec2;
}

export interface Seat {
  tableId: number;
  /** 1-based, matching the seat_index column in the Guests sheet. */
  seatIndex: number;
  x: number;
  z: number;
  /** Y rotation in radians so a chair/avatar faces the table centre. */
  rotationY: number;
}

// ---------------------------------------------------------------------------
// Scale and hall
// ---------------------------------------------------------------------------

/** Screenshot pixels → metres. A 15-per-side long table lands at ~9.75 m. */
const PX_TO_M = 0.0125;

/** Horizontal centre of docs/seat_plan.jpg, used as the world origin for x. */
const IMG_CENTER_X = 818;

/** Traced east–west position of a table, from its pixel x in the screenshot. */
function xFromPixels(px: number): number {
  return (px - IMG_CENTER_X) * PX_TO_M;
}

/**
 * North–south row positions, in metres.
 *
 * Spacing is derived, not traced. Two long tables back to back need
 * 2 x (seat offset + chair depth) plus an aisle: 2 x (0.78 + 0.25) + 0.85 aisle
 * ≈ 2.9 m between row centres. Round tables need 2 x (seat radius + chair depth)
 * plus an aisle ≈ 4.0 m.
 */
const ROW_Z = {
  /** Round tables against the north wall: 8, 9, 10. */
  roundBack: -8.3,
  /** Round tables in front of them: 6, 7. */
  roundFront: -4.3,
  /** Long tables 4 and 5. */
  longNorth: -0.9,
  /** Long table 3. */
  longMiddle: 2.0,
  /** Long tables 1 and 2, nearest the entrance. */
  longSouth: 4.9,
} as const;

/**
 * Explicit bounds rather than width/depth about the origin: the seating is
 * pushed north, so a symmetric room would leave a large dead strip at the back
 * and clip the round tables at the front.
 */
export const HALL = {
  minX: -11,
  maxX: 11,
  minZ: -11,
  maxZ: 8.5,
  wallHeight: 4.2,
} as const;

export const HALL_WIDTH = HALL.maxX - HALL.minX;
export const HALL_DEPTH = HALL.maxZ - HALL.minZ;
export const HALL_CENTER: Vec2 = {
  x: (HALL.minX + HALL.maxX) / 2,
  z: (HALL.minZ + HALL.maxZ) / 2,
};

/** Where the flythrough camera starts: the doorway at the south edge. */
export const ENTRANCE: Vec2 = { x: 0, z: 7.6 };

// ---------------------------------------------------------------------------
// Furniture dimensions
// ---------------------------------------------------------------------------

export const DIMS = {
  /** Spacing between adjacent seats along a long table. */
  seatPitch: 0.65,
  /** Long table top width (north–south). */
  longTableDepth: 0.9,
  /** Distance from a long table's centre line out to its chair row. */
  longTableSeatOffset: 0.78,
  /** Half-depth of a chair, used for clearance checks. */
  chairClearance: 0.25,
  /** Round table top diameter. */
  roundTableDiameter: 1.8,
  /** Distance from a round table's centre out to its chairs. */
  roundTableSeatRadius: 1.35,
  tableHeight: 0.75,
  chairSeatHeight: 0.45,
} as const;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const TABLES: readonly TableDef[] = [
  // Long tables, south half of the room.
  { id: 1, shape: "long", seats: 24, center: { x: xFromPixels(538), z: ROW_Z.longSouth } },
  { id: 2, shape: "long", seats: 18, center: { x: xFromPixels(1317), z: ROW_Z.longSouth } },
  { id: 3, shape: "long", seats: 24, center: { x: xFromPixels(538), z: ROW_Z.longMiddle } },
  { id: 4, shape: "long", seats: 30, center: { x: xFromPixels(476), z: ROW_Z.longNorth } },
  { id: 5, shape: "long", seats: 24, center: { x: xFromPixels(1251), z: ROW_Z.longNorth } },
  // Round tables, north half.
  { id: 6, shape: "round", seats: 10, center: { x: xFromPixels(813), z: ROW_Z.roundFront } },
  { id: 7, shape: "round", seats: 10, center: { x: xFromPixels(1207), z: ROW_Z.roundFront } },
  { id: 8, shape: "round", seats: 10, center: { x: xFromPixels(157), z: ROW_Z.roundBack } },
  { id: 9, shape: "round", seats: 10, center: { x: xFromPixels(470), z: ROW_Z.roundBack } },
  { id: 10, shape: "round", seats: 10, center: { x: xFromPixels(1010), z: ROW_Z.roundBack } },
] as const;

/** Non-seating props, drawn in both the 2D map and the 3D scene. */
export const PROPS = {
  /** West wall beside the entrance, matching the Bar block in the plan. */
  bar: { center: { x: -9.5, z: 4.9 }, width: 1.2, depth: 3.5, height: 1.1 },
  /** North-east corner, where the plan's banquet/stage block is cut off. */
  stage: { center: { x: 9.0, z: -6.5 }, width: 2.4, depth: 4.0, height: 0.4 },
} as const;

export const TOTAL_SEATS = TABLES.reduce((sum, t) => sum + t.seats, 0);

// ---------------------------------------------------------------------------
// Seat placement
// ---------------------------------------------------------------------------

/**
 * Seat numbering, which the Guests sheet must match:
 *
 *  - Long tables: 1 … N/2 is the north row, left→right (west→east).
 *                 N/2+1 … N is the south row, left→right.
 *                 This mirrors the two-row grid drawn in the screenshot.
 *  - Round tables: 1 … 10 clockwise from the top (north) position.
 */
export function seatsForTable(tableId: number): Seat[] {
  const table = TABLES.find((t) => t.id === tableId);
  if (!table) return [];

  if (table.shape === "long") {
    const perSide = table.seats / 2;
    const spanStart = table.center.x - ((perSide - 1) * DIMS.seatPitch) / 2;

    return Array.from({ length: table.seats }, (_, i) => {
      const isNorthRow = i < perSide;
      const column = isNorthRow ? i : i - perSide;
      return {
        tableId,
        seatIndex: i + 1,
        x: spanStart + column * DIMS.seatPitch,
        z:
          table.center.z +
          (isNorthRow ? -DIMS.longTableSeatOffset : DIMS.longTableSeatOffset),
        // Convention: at rotationY = 0 a chair's back is at -Z and it faces +Z.
        // A north-row chair sits north of its table, so it faces south (+Z).
        rotationY: isNorthRow ? 0 : Math.PI,
      };
    });
  }

  return Array.from({ length: table.seats }, (_, i) => {
    // -PI/2 puts seat 1 at the top; increasing angle sweeps clockwise in a
    // screen-style coordinate frame where +x is east and +z is south.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / table.seats;
    return {
      tableId,
      seatIndex: i + 1,
      x: table.center.x + Math.cos(angle) * DIMS.roundTableSeatRadius,
      z: table.center.z + Math.sin(angle) * DIMS.roundTableSeatRadius,
      // Face inward. Solving (sin r, cos r) = -(cos angle, sin angle) for r,
      // using the same convention as the long tables, gives -angle - PI/2.
      rotationY: -angle - Math.PI / 2,
    };
  });
}

/**
 * Unit vector pointing from the table out through the back of a chair — the
 * open side a guest walks in from, and where the flythrough camera settles.
 *
 * Derived from rotationY so it stays correct for both table shapes: a chair
 * faces (sin r, cos r), so outward is the negation.
 */
export function seatOutward(seat: Seat): Vec2 {
  return { x: -Math.sin(seat.rotationY), z: -Math.cos(seat.rotationY) };
}

export const ALL_SEATS: readonly Seat[] = TABLES.flatMap((t) =>
  seatsForTable(t.id),
);

const SEAT_LOOKUP = new Map<string, Seat>(
  ALL_SEATS.map((s) => [seatKey(s.tableId, s.seatIndex), s]),
);

export function seatKey(tableId: number, seatIndex: number): string {
  return `${tableId}:${seatIndex}`;
}

export function getSeat(
  tableId: number,
  seatIndex: number,
): Seat | undefined {
  return SEAT_LOOKUP.get(seatKey(tableId, seatIndex));
}

export function getTable(tableId: number): TableDef | undefined {
  return TABLES.find((t) => t.id === tableId);
}

/** Rendered length of a long table top (east–west). */
export function longTableLength(table: TableDef): number {
  return (table.seats / 2) * DIMS.seatPitch + 0.3;
}

/**
 * True when (tableId, seatIndex) is a real seat. Used to validate sheet rows so
 * a typo in the Guests tab surfaces as a warning instead of a missing chair.
 */
export function isValidSeat(tableId: number, seatIndex: number): boolean {
  return SEAT_LOOKUP.has(seatKey(tableId, seatIndex));
}
