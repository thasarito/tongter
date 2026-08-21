/**
 * Venue geometry — the single source of truth for where every seat is.
 *
 * The layout is fixed and never changes, so it lives in code rather than in the
 * Google Sheet. The Sheet only says *who* sits at (tableId, seatIndex); this
 * file says *where* that is, in metres, for both the 2D map and the 3D scene.
 *
 * Traced from `seatingplan.jpg`, the venue's own dimensioned floor plan, by
 * calibrating against its 28 m width marker. Everything structural — hall size,
 * the three arched alcoves, the stage, the band, the bar and the central aisle —
 * comes from that drawing.
 *
 * The one thing not taken literally is north–south row spacing. The drawing
 * packs the long-table rows about 2.65 m apart, which leaves too little room
 * between facing chair backs for the walking camera to pass. Rows are set to
 * 2.9 m instead: within the drawing's tolerance, and walkable. Table order,
 * sizes and east–west positions are all as drawn.
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

export type PropShape = "rect" | "round";

export interface PropDef {
  center: Vec2;
  shape: PropShape;
  /** Rect: east–west size. Round: diameter (depth is ignored). */
  width: number;
  depth: number;
  height: number;
  label: { th: string; en: string };
}

// ---------------------------------------------------------------------------
// Hall
// ---------------------------------------------------------------------------

/**
 * Explicit bounds rather than width/depth about the origin: the alcoves push
 * the seating north, so a symmetric room would leave a dead strip at the back
 * and clip the round tables at the front.
 *
 * 28 m wide, as marked on the plan. The depth spans the alcove recess, the main
 * hall, and the foyer inside the entrance.
 */
export const HALL = {
  minX: -14,
  maxX: 14,
  minZ: -11.4,
  maxZ: 5.6,
  wallHeight: 4.6,
} as const;

export const HALL_WIDTH = HALL.maxX - HALL.minX;
export const HALL_DEPTH = HALL.maxZ - HALL.minZ;
export const HALL_CENTER: Vec2 = {
  x: (HALL.minX + HALL.maxX) / 2,
  z: (HALL.minZ + HALL.maxZ) / 2,
};

/** Where the walk starts: just inside the doorway on the south wall. */
export const ENTRANCE: Vec2 = { x: 0, z: 5.2 };

/**
 * The doorway itself, set into the south wall and centred as drawn.
 *
 * Shared so the wall opening, the doors and the camera's approach all agree on
 * where the threshold is.
 */
export const GATE = {
  center: { x: 0, z: 5.6 },
  width: 2.6,
  height: 2.9,
} as const;

/**
 * Where the walk begins — outside, far enough back to take in the whole
 * doorway but no further: every extra metre here is added to all 170 routes.
 * At 3.2 m the 2.9 m doorway still sits comfortably inside a 62° lens.
 */
export const APPROACH: Vec2 = { x: 0, z: 8.8 };

/** How far the ground extends beyond the south wall, so outside is not a void. */
export const OUTSIDE_DEPTH = 14;

/**
 * The three arched recesses along the north wall, 6 m / 7.2 m / 6 m as marked.
 * Rendered as curved wall segments rather than modelled cavities — the shape
 * reads from inside the room without the polygon cost.
 */
export const ALCOVES = [
  { center: -9.35, width: 6.2, label: { th: "", en: "" } },
  { center: 0, width: 7.5, label: { th: "", en: "" } },
  { center: 9.4, width: 6.1, label: { th: "วงดนตรี", en: "Band" } },
] as const;

/** Depth of the alcove recess, north of the main wall line. */
export const ALCOVE_DEPTH = 3.6;

/** The main north wall line; alcoves cut back from here. */
export const NORTH_WALL_Z = -7.6;

/**
 * The carpeted aisle: in from the entrance, then east toward the stage. Drawn
 * on the floor and kept clear of furniture, so the walk uses it naturally.
 */
export const AISLE = {
  spine: { minX: -0.7, maxX: 0.7, minZ: -2.8, maxZ: HALL.maxZ },
  toStage: { minX: 0, maxX: 9.7, minZ: -2.8, maxZ: -1.4 },
} as const;

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
  /**
   * Round tables seat ten. At 1.5 m across with chairs on a 1.0 m radius the
   * ring is 2 m wide, which is what lets three of them sit in the 7.5 m middle
   * alcove without their chairs colliding.
   */
  roundTableDiameter: 1.5,
  roundTableSeatRadius: 1.0,
  tableHeight: 0.75,
  chairSeatHeight: 0.45,
} as const;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** North–south row centres for the long tables, 2.9 m apart. */
const ROW_Z = {
  /** Tables 4 and 5, nearest the alcoves. */
  north: -5.0,
  /** Table 3. */
  middle: -2.1,
  /** Tables 1 and 2, nearest the entrance. */
  south: 0.8,
} as const;

/** Round tables sit inside the alcove recess. */
const ROUND_Z = {
  front: -8.1,
  back: -9.9,
} as const;

export const TABLES: readonly TableDef[] = [
  // Long tables. Sizes and left-to-right order exactly as drawn.
  { id: 1, shape: "long", seats: 24, center: { x: -5.1, z: ROW_Z.south } },
  { id: 2, shape: "long", seats: 18, center: { x: 5.3, z: ROW_Z.south } },
  { id: 3, shape: "long", seats: 24, center: { x: -5.1, z: ROW_Z.middle } },
  { id: 4, shape: "long", seats: 30, center: { x: -6.25, z: ROW_Z.north } },
  { id: 5, shape: "long", seats: 24, center: { x: 4.2, z: ROW_Z.north } },
  // Round tables: three in the middle alcove (one set back), two in the left.
  { id: 6, shape: "round", seats: 10, center: { x: -2.6, z: ROUND_Z.front } },
  { id: 7, shape: "round", seats: 10, center: { x: 2.6, z: ROUND_Z.front } },
  { id: 8, shape: "round", seats: 10, center: { x: -10.9, z: -8.8 } },
  { id: 9, shape: "round", seats: 10, center: { x: -7.8, z: -8.8 } },
  { id: 10, shape: "round", seats: 10, center: { x: 0, z: ROUND_Z.back } },
] as const;

/** Non-seating features, drawn in both the 2D map and the 3D scene. */
export const PROPS: Record<string, PropDef> = {
  /** West wall, between the entrance and the tables, as drawn. */
  bar: {
    center: { x: -11.5, z: 1.5 },
    shape: "rect",
    width: 1.2,
    depth: 3.5,
    height: 1.1,
    label: { th: "บาร์", en: "Bar" },
  },
  /** The round feature drawn beside the bar. */
  cakeTable: {
    center: { x: -11.3, z: -1.2 },
    shape: "round",
    width: 1.2,
    depth: 1.2,
    height: 0.75,
    label: { th: "เค้ก", en: "Cake" },
  },
  /** East side, 3.6 x 7.2 m and 0.40 m high, as marked. Carries the B&G table. */
  stage: {
    center: { x: 11.5, z: -2.1 },
    shape: "rect",
    width: 3.6,
    depth: 7.2,
    height: 0.4,
    label: { th: "เวที", en: "Stage" },
  },
  /** The right-hand alcove. */
  band: {
    center: { x: 9.4, z: -9.2 },
    shape: "rect",
    width: 5,
    depth: 2.6,
    height: 0.2,
    label: { th: "วงดนตรี", en: "Band" },
  },
} as const;

/** The couple's table, standing on the stage. */
export const BG_TABLE = {
  center: { x: 11.5, z: -2.1 },
  width: 0.9,
  depth: 2.2,
  /** Sits on top of the stage platform. */
  baseHeight: PROPS.stage.height,
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
 *                 This mirrors the two-row grid drawn in the plan.
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
 * open side a guest walks in from, and where the walking camera settles.
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

export function getSeat(tableId: number, seatIndex: number): Seat | undefined {
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

/** True when a point lies on the carpeted aisle. */
export function isOnAisle(x: number, z: number): boolean {
  const inSpine =
    x >= AISLE.spine.minX &&
    x <= AISLE.spine.maxX &&
    z >= AISLE.spine.minZ &&
    z <= AISLE.spine.maxZ;
  const inBranch =
    x >= AISLE.toStage.minX &&
    x <= AISLE.toStage.maxX &&
    z >= AISLE.toStage.minZ &&
    z <= AISLE.toStage.maxZ;
  return inSpine || inBranch;
}
