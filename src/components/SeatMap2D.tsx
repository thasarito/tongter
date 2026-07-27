import { buildWalkPath } from "@/lib/walk-path";
import {
  ALL_SEATS,
  DIMS,
  HALL,
  HALL_DEPTH,
  HALL_WIDTH,
  PROPS,
  TABLES,
  longTableLength,
  seatKey,
  type TableDef,
} from "@/lib/venue";

export interface SeatOccupant {
  name: string;
  side?: "bride" | "groom" | string;
}

export interface SeatMap2DProps {
  /** Seats belonging to the viewer's group, drawn filled. */
  highlight?: readonly { tableId: number; seatIndex: number }[];
  /** The single seat to call out, drawn with a ring and label. */
  focus?: { tableId: number; seatIndex: number } | null;
  /** Optional names, keyed by `seatKey(tableId, seatIndex)`. */
  occupants?: ReadonlyMap<string, SeatOccupant>;
  /** Show the table number in the middle of every table. */
  showTableNumbers?: boolean;
  /** Draw the walking route from the entrance, as taken by the 3D camera. */
  showRoute?: boolean;
  className?: string;
}

// World metres map straight onto SVG units: +x is east, +z is south, which is
// the same orientation as the printed plan.
const PAD = 0.8;

function TableTop({ table }: { table: TableDef }) {
  if (table.shape === "round") {
    return (
      <circle
        cx={table.center.x}
        cy={table.center.z}
        r={DIMS.roundTableDiameter / 2}
        className="fill-white stroke-line"
        strokeWidth={0.05}
      />
    );
  }
  const length = longTableLength(table);
  return (
    <rect
      x={table.center.x - length / 2}
      y={table.center.z - DIMS.longTableDepth / 2}
      width={length}
      height={DIMS.longTableDepth}
      rx={0.1}
      className="fill-white stroke-line"
      strokeWidth={0.05}
    />
  );
}

/**
 * Plan view of the hall, rendered as plain SVG.
 *
 * Used in three places: the geometry debug page, the seat card, and as the
 * fallback when WebGL is unavailable — so it must render without any client
 * JavaScript. Keep it a server component.
 */
export default function SeatMap2D({
  highlight = [],
  focus = null,
  occupants,
  showTableNumbers = true,
  showRoute = false,
  className,
}: SeatMap2DProps) {
  const highlighted = new Set(highlight.map((s) => seatKey(s.tableId, s.seatIndex)));
  const focusKey = focus ? seatKey(focus.tableId, focus.seatIndex) : null;
  const focusSeat = focusKey
    ? ALL_SEATS.find((s) => seatKey(s.tableId, s.seatIndex) === focusKey)
    : null;

  // Sampled from the same curve the 3D camera follows, so the printed map and
  // the walkthrough always agree.
  const routePoints =
    showRoute && focusSeat
      ? (() => {
          const { curve } = buildWalkPath(focusSeat);
          return Array.from({ length: 90 }, (_, i) => curve.getPointAt(i / 89));
        })()
      : null;

  return (
    <svg
      viewBox={`${HALL.minX - PAD} ${HALL.minZ - PAD} ${HALL_WIDTH + PAD * 2} ${HALL_DEPTH + PAD * 2}`}
      className={className}
      role="img"
      aria-label="แผนผังที่นั่ง · Seating plan"
    >
      {/* Floor and walls */}
      <rect
        x={HALL.minX}
        y={HALL.minZ}
        width={HALL_WIDTH}
        height={HALL_DEPTH}
        rx={0.3}
        className="fill-cream stroke-line"
        strokeWidth={0.08}
      />

      {/* Props */}
      {Object.entries(PROPS).map(([name, p]) => (
        <g key={name}>
          <rect
            x={p.center.x - p.width / 2}
            y={p.center.z - p.depth / 2}
            width={p.width}
            height={p.depth}
            rx={0.12}
            className="fill-gold-soft stroke-gold"
            strokeWidth={0.04}
          />
          <text
            x={p.center.x}
            y={p.center.z}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted"
            style={{ fontSize: 0.42 }}
            transform={`rotate(-90 ${p.center.x} ${p.center.z})`}
          >
            {name === "bar" ? "Bar" : "Stage"}
          </text>
        </g>
      ))}

      {/* Entrance marker on the south wall */}
      <g>
        <rect
          x={-1.2}
          y={HALL.maxZ - 0.1}
          width={2.4}
          height={0.2}
          className="fill-gold"
        />
        <text
          x={0}
          y={HALL.maxZ - 0.5}
          textAnchor="middle"
          className="fill-muted"
          style={{ fontSize: 0.4 }}
        >
          ทางเข้า · Entrance
        </text>
      </g>

      {TABLES.map((table) => (
        <TableTop key={table.id} table={table} />
      ))}

      {/* Seats */}
      {ALL_SEATS.map((seat) => {
        const key = seatKey(seat.tableId, seat.seatIndex);
        const occupant = occupants?.get(key);
        const isFocus = key === focusKey;
        const isGroup = highlighted.has(key);

        let className = "fill-white stroke-line";
        if (isFocus) className = "fill-gold stroke-gold";
        else if (isGroup) className = "fill-blush stroke-blush-deep";
        else if (occupant?.side === "bride") className = "fill-blush-soft stroke-blush";
        else if (occupant?.side === "groom") className = "fill-sky-soft stroke-sky";

        return (
          <circle
            key={key}
            cx={seat.x}
            cy={seat.z}
            r={0.24}
            className={className}
            strokeWidth={0.045}
          >
            {occupant ? <title>{`${occupant.name} · T${seat.tableId} #${seat.seatIndex}`}</title> : null}
          </circle>
        );
      })}

      {/* Table numbers sit above the seats so they stay legible. */}
      {showTableNumbers &&
        TABLES.map((table) => (
          <text
            key={`label-${table.id}`}
            x={table.center.x}
            y={table.center.z}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted"
            style={{ fontSize: 0.5, fontWeight: 500 }}
          >
            {table.id}
          </text>
        ))}

      {routePoints && (
        <polyline
          points={routePoints.map((p) => `${p.x},${p.z}`).join(" ")}
          className="fill-none stroke-gold"
          strokeWidth={0.09}
          strokeDasharray="0.35 0.28"
          strokeLinecap="round"
          opacity={0.75}
        />
      )}

      {/* Focus ring, drawn last so nothing overlaps it. */}
      {focusSeat && (
        <circle
          cx={focusSeat.x}
          cy={focusSeat.z}
          r={0.5}
          className="fill-none stroke-gold"
          strokeWidth={0.08}
        />
      )}
    </svg>
  );
}
