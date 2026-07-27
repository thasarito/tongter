/**
 * Builds import-ready spreadsheets for the wedding guest list.
 *
 * Run: pnpm sheet
 *
 * Writes to out/sheet/:
 *   wedding-sheet-demo.xlsx   all 170 seats filled with realistic mock guests,
 *                             ~70 groups with tokens, and some responses already
 *                             recorded — import this to see the site working end
 *                             to end immediately
 *   wedding-sheet-blank.xlsx  the same three tabs, with table_id and seat_index
 *                             prefilled in plan reading order but names empty —
 *                             use this for the real guest list
 *   *.csv                     the same data, one file per tab
 *
 * To use: upload the .xlsx to Google Drive and open it with Google Sheets
 * (Drive converts it, keeping all three tabs), or import each CSV into its own
 * tab. Then copy the sheet ID out of the URL into GOOGLE_SHEET_ID.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { TABLES, seatsForTable } from "../src/lib/venue.ts";
import { buildMockDataset } from "../src/lib/mock-dataset.ts";
import {
  GROUP_HEADERS,
  GUEST_HEADERS,
  RSVP_HEADERS,
  SHEET_TABS,
} from "../src/lib/types.ts";

const OUT_DIR = "out/sheet";

type Row = (string | number)[];

interface TabData {
  name: string;
  headers: readonly string[];
  rows: Row[];
  widths: number[];
}

// --- Demo workbook ----------------------------------------------------------

const demo = buildMockDataset({ readableTokens: false });

const demoTabs: TabData[] = [
  {
    name: SHEET_TABS.guests,
    headers: GUEST_HEADERS,
    rows: demo.guests.map((g) => [
      g.guestId,
      g.nameTh,
      g.nameEn,
      g.groupId,
      g.tableId,
      g.seatIndex,
      g.side ?? "",
      g.tags.join(","),
    ]),
    widths: [12, 16, 14, 12, 10, 12, 10, 12],
  },
  {
    name: SHEET_TABS.groups,
    headers: GROUP_HEADERS,
    rows: demo.groups.map((g) => [g.groupId, g.labelTh, g.labelEn, g.token]),
    widths: [12, 22, 22, 14],
  },
  {
    name: SHEET_TABS.rsvp,
    headers: RSVP_HEADERS,
    rows: demo.rsvps.map((r) => [
      r.timestamp,
      r.groupId,
      r.guestId,
      r.attending ? "yes" : "no",
      r.dietary,
      r.message,
      r.submittedBy,
      r.lang,
    ]),
    widths: [26, 12, 12, 10, 20, 34, 16, 8],
  },
];

// --- Blank workbook ---------------------------------------------------------

const blankGuestRows: Row[] = [];
for (const table of TABLES) {
  for (const seat of seatsForTable(table.id)) {
    blankGuestRows.push([
      `g${String(table.id).padStart(2, "0")}-${String(seat.seatIndex).padStart(2, "0")}`,
      "",
      "",
      "",
      table.id,
      seat.seatIndex,
      "",
      "",
    ]);
  }
}

// A generous pool of pre-numbered groups with unique tokens. 170 guests will
// not need more than this, and unused rows can simply be deleted.
const BLANK_GROUP_COUNT = 90;
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

const blankTokens = new Set<string>();
while (blankTokens.size < BLANK_GROUP_COUNT) {
  const bytes = randomBytes(10);
  let token = "";
  for (const byte of bytes) token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  blankTokens.add(token);
}

const blankGroupRows: Row[] = [...blankTokens].map((token, i) => [
  `grp-${String(i + 1).padStart(3, "0")}`,
  "",
  "",
  token,
]);

const blankTabs: TabData[] = [
  { name: SHEET_TABS.guests, headers: GUEST_HEADERS, rows: blankGuestRows, widths: demoTabs[0].widths },
  { name: SHEET_TABS.groups, headers: GROUP_HEADERS, rows: blankGroupRows, widths: demoTabs[1].widths },
  { name: SHEET_TABS.rsvp, headers: RSVP_HEADERS, rows: [], widths: demoTabs[2].widths },
];

// --- Writers ----------------------------------------------------------------

async function writeWorkbook(file: string, tabs: TabData[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "wedding-rsvp";

  for (const tab of tabs) {
    const sheet = workbook.addWorksheet(tab.name);
    sheet.columns = tab.headers.map((h, i) => ({
      header: h,
      key: h,
      width: tab.widths[i] ?? 14,
    }));
    sheet.addRows(tab.rows);

    sheet.getRow(1).font = { bold: true };
    // Header stays visible while scrolling 170 rows.
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  await workbook.xlsx.writeFile(file);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file: string, tab: TabData) {
  // BOM so Excel and Google Sheets read the Thai columns as UTF-8.
  const body = [tab.headers as readonly (string | number)[], ...tab.rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");
  writeFileSync(file, "﻿" + body + "\n", "utf8");
}

mkdirSync(OUT_DIR, { recursive: true });

await writeWorkbook(`${OUT_DIR}/wedding-sheet-demo.xlsx`, demoTabs);
await writeWorkbook(`${OUT_DIR}/wedding-sheet-blank.xlsx`, blankTabs);

for (const tab of demoTabs) {
  writeCsv(`${OUT_DIR}/demo-${tab.name.toLowerCase()}.csv`, tab);
}
for (const tab of blankTabs) {
  writeCsv(`${OUT_DIR}/blank-${tab.name.toLowerCase()}.csv`, tab);
}

const respondedGroups = new Set(demo.rsvps.map((r) => r.groupId)).size;

console.log(`
Wrote to ${OUT_DIR}/

  wedding-sheet-demo.xlsx    ${demo.guests.length} guests · ${demo.groups.length} groups · ${demo.rsvps.length} RSVP rows (${respondedGroups} groups responded)
  wedding-sheet-blank.xlsx   ${blankGuestRows.length} empty seat rows with table_id + seat_index prefilled
  demo-*.csv / blank-*.csv   one file per tab

To get this into Google Sheets:
  1. Upload wedding-sheet-demo.xlsx to Google Drive
  2. Right click > Open with > Google Sheets (all three tabs come across)
  3. Copy the sheet ID from the URL into GOOGLE_SHEET_ID in .env
  4. Share the sheet with your service account's client_email as Editor

Seat order within a long table: 1..N/2 is the top row left to right, then
N/2+1..N is the bottom row left to right — the same order you read the chips in
docs/seat_plan.jpg. Round tables run 1..10 clockwise from the top.
`);
