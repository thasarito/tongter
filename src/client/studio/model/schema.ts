import { z } from "zod";

export const kinds = ["table", "stage", "aisle", "runner", "band", "bar", "buffet", "dance"] as const;
const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const text = (max: number) => z.string().trim().max(max).default("");
const coordinate = (min: number, max: number) => z.number().finite().min(min).max(max);
const seat = z.number().int().min(1).max(1000).nullable().default(null);
export const itemSchema = z.object({
  id, kind: z.enum(kinds), shape: z.enum(["oval", "round", "rect"]), label: z.string().max(80),
  x: coordinate(-40, 40), z: coordinate(-30, 30), w: coordinate(.3, 20), d: coordinate(.3, 20),
  h: coordinate(.001, 5), rotation: coordinate(-360, 360), seats: z.number().int().min(0).max(16),
  locked: z.boolean().default(false), aisleWidth: coordinate(.4, 20).optional(),
  // Legacy derived cache only: guestList is authoritative.
  guests: z.array(z.string().max(160)).max(16).default([]),
}).superRefine((o, ctx) => {
  const error = (message: string) => ctx.addIssue({ code: "custom", message });
  if (o.kind === "table" && o.seats < 1) error("Tables need 1–16 seats.");
  if (["table", "bar", "buffet"].includes(o.kind) && o.h < .2) error("Furniture height must be at least 0.2 m.");
  if (o.shape === "round" && Math.abs(o.w - o.d) > 1e-6) error("Round tables require equal width and depth.");
  if (o.kind === "aisle" && (!o.aisleWidth || o.aisleWidth > Math.min(o.w, o.d))) error("Aisle width must fit inside its bounds.");
});
export const guestSchema = z.object({
  id, name: z.string().trim().min(1).max(160), host: text(80), group: text(160), status: text(100),
  rsvp: z.enum(["Pending", "Confirmed", "Maybe", "Declined"]).default("Pending"),
  reserve: z.boolean().default(false), important: z.boolean().default(false), vip: z.boolean().default(false),
  heart: text(20), star: text(20), notes: text(4000), dietary: text(500),
  tableId: z.string().max(100).default(""), seatNumber: seat,
  sourceTableId: text(100), sourceTableLabel: text(160), sourceSeatNumber: seat,
  unmappedTableId: text(100), unmappedTableLabel: text(160), unmappedSeatNumber: seat,
});
const layoutSchema = z.object({
  version: z.union([z.literal(2), z.literal(3)]), title: z.string().max(120).default("The Glass House"),
  units: z.literal("metres").default("metres"), items: z.array(itemSchema).max(200),
  guestList: z.array(guestSchema).max(5000).optional(),
  guestSource: z.object({ archive: text(1000), snapshot: text(1000), note: text(1000) }).default({ archive: "", snapshot: "", note: "" }),
});
export type StudioItem = z.output<typeof itemSchema>;
export type StudioGuest = z.output<typeof guestSchema>;
export interface StudioLayout {
  version: 3; title: string; units: "metres"; items: StudioItem[]; guestList: StudioGuest[];
  guestSource: { archive: string; snapshot: string; note: string };
}
export interface SeatTarget { tableId: string; seatNumber?: number | null }
export type ViewMode = "plan" | "model" | "inside";
export interface ViewOptions {
  roof: "cut" | "frame" | "full"; walls: "low" | "full"; chairs: boolean;
  furniture: boolean; guestNames: boolean; tableLabels: boolean; grid: boolean; snap: boolean; garden: boolean;
}
export const defaultOptions: ViewOptions = { roof: "cut", walls: "low", chairs: true, furniture: true, guestNames: true, tableLabels: true, grid: false, snap: true, garden: true };
export const clone = <T,>(value: T): T => structuredClone(value);
export const makeId = (prefix = "guest") => `${prefix}-${crypto.randomUUID()}`;
export const tableGuests = (s: StudioLayout, tableId: string) => s.guestList.filter(g => g.tableId === tableId).sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0));
export const occupant = (s: StudioLayout, t: SeatTarget) => s.guestList.find(g => g.tableId === t.tableId && g.seatNumber === t.seatNumber);

/** Accepts standalone v2/v3 JSON; strips unsupported fields, including tokens. */
export function normalizeLayout(input: unknown): StudioLayout {
  const raw = layoutSchema.parse(input);
  const guestList = raw.guestList ?? raw.items.flatMap(t => t.kind !== "table" ? [] : t.guests.flatMap((name, i) => name.trim() ? [guestSchema.parse({ id: `migrated-${t.id}-${i + 1}`, name, tableId: t.id, seatNumber: i + 1 })] : []));
  const itemIds = new Set<string>(), guestIds = new Set<string>();
  const tables = new Map<string, StudioItem>(), used = new Map<string, Set<number>>();
  for (const t of raw.items) {
    if (itemIds.has(t.id)) throw Error(`Duplicate object ID: ${t.id}`);
    itemIds.add(t.id);
    if (t.kind === "table") { tables.set(t.id, t); used.set(t.id, new Set()); }
  }
  for (const g of guestList) {
    if (guestIds.has(g.id)) throw Error(`Duplicate guest ID: ${g.id}`);
    guestIds.add(g.id);
    if (!g.tableId) { g.seatNumber = null; continue; }
    const t = tables.get(g.tableId);
    if (!t) throw Error(`Unknown current table ${g.tableId} for ${g.name}.`);
    if (g.reserve) throw Error(`${g.name} is on reserve. Activate the guest before seating.`);
    if (g.seatNumber !== null) {
      if (g.seatNumber > t.seats) throw Error(`${g.name}: seat ${g.seatNumber} exceeds Table ${t.label}'s capacity.`);
      const occupied = used.get(t.id)!;
      if (occupied.has(g.seatNumber)) throw Error(`Table ${t.label}, seat ${g.seatNumber} is assigned twice.`);
      occupied.add(g.seatNumber);
    }
  }
  // Reserve explicit seats before assigning any omitted seat numbers.
  for (const g of guestList) if (g.tableId && g.seatNumber === null) {
    const t = tables.get(g.tableId)!, occupied = used.get(t.id)!;
    const free = Array.from({ length: t.seats }, (_, i) => i + 1).find(n => !occupied.has(n));
    if (!free) throw Error(`Table ${t.label} is full. No assignments were changed.`);
    g.seatNumber = free; occupied.add(free);
  }
  const result: StudioLayout = { ...raw, version: 3, guestList };
  for (const t of result.items) t.guests = t.kind === "table" ? Array.from({ length: t.seats }, (_, i) => occupant(result, { tableId: t.id, seatNumber: i + 1 })?.name ?? "") : [];
  return result;
}
export function parseLayout(text: string): StudioLayout {
  if (text.length > 5_000_000) throw Error("The layout exceeds the 5 MB limit.");
  return normalizeLayout(JSON.parse(text.replace(/^\uFEFF/, "")));
}
