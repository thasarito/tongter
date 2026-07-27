/**
 * Creates the three tabs in an existing Google Sheet and fills in headers.
 *
 *   pnpm push:sheet            headers + blank seat scaffold (real guest list)
 *   pnpm push:sheet -- --demo  headers + full mock data (see the site working)
 *
 * Requires GOOGLE_SHEET_ID and credentials in .env, and the sheet shared with
 * the service account's client_email as Editor.
 *
 * Safe by default: refuses to run if any target tab already has data, unless
 * --force is passed. The RSVP tab is never overwritten without --force, because
 * that is where real guest responses accumulate.
 */
import { readFileSync } from "node:fs";
import { google } from "googleapis";
import { loadEnv, resolveCredentials } from "./script-env.ts";
import { TABLES, seatsForTable } from "../src/lib/venue.ts";
import { buildMockDataset } from "../src/lib/mock-dataset.ts";
import {
  GROUP_HEADERS,
  GUEST_HEADERS,
  RSVP_HEADERS,
  SHEET_TABS,
} from "../src/lib/types.ts";

const args = process.argv.slice(2);
const useDemo = args.includes("--demo");
const force = args.includes("--force");

loadEnv();

const sheetId = process.env.GOOGLE_SHEET_ID;
if (!sheetId) {
  console.error("GOOGLE_SHEET_ID is not set. Add it to .env first.");
  process.exit(1);
}

const credentials = resolveCredentials();
if (!credentials) {
  console.error(
    "No credentials. Set GOOGLE_APPLICATION_CREDENTIALS (path to the service\n" +
      "account JSON) or GOOGLE_CREDENTIALS_JSON (the JSON itself) in .env, or\n" +
      "place the key at secrets/google-service-account.json.",
  );
  process.exit(1);
}
if (credentials.note) console.log(`note: ${credentials.note}`);

const auth = new google.auth.GoogleAuth({
  ...(credentials.json
    ? { credentials: JSON.parse(credentials.json) }
    : { keyFile: credentials.keyFile }),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth: await auth.getClient() as never });

// --- Build the rows ---------------------------------------------------------

const dataset = buildMockDataset();

const guestRows = useDemo
  ? dataset.guests.map((g) => [
      g.guestId, g.nameTh, g.nameEn, g.groupId,
      g.tableId, g.seatIndex, g.side ?? "", g.tags.join(","),
    ])
  : TABLES.flatMap((table) =>
      seatsForTable(table.id).map((seat) => [
        `g${String(table.id).padStart(2, "0")}-${String(seat.seatIndex).padStart(2, "0")}`,
        "", "", "", table.id, seat.seatIndex, "", "",
      ]),
    );

const groupRows = useDemo
  ? dataset.groups.map((g) => [g.groupId, g.labelTh, g.labelEn, g.token])
  : dataset.groups.map((g) => [g.groupId, "", "", g.token]);

const rsvpRows = useDemo
  ? dataset.rsvps.map((r) => [
      r.timestamp, r.groupId, r.guestId, r.attending ? "yes" : "no",
      r.dietary, r.message, r.submittedBy, r.lang,
    ])
  : [];

const plan = [
  { name: SHEET_TABS.guests, headers: GUEST_HEADERS, rows: guestRows },
  { name: SHEET_TABS.groups, headers: GROUP_HEADERS, rows: groupRows },
  { name: SHEET_TABS.rsvp, headers: RSVP_HEADERS, rows: rsvpRows },
];

// --- Ensure tabs exist ------------------------------------------------------

let meta;
try {
  meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
} catch (err) {
  const status = (err as { code?: number }).code;
  if (status === 403) {
    const email = credentials.keyFile
      ? JSON.parse(readFileSync(credentials.keyFile, "utf8")).client_email
      : "the service account";
    console.error(
      `\nThe service account cannot open that spreadsheet (403).\n\n` +
        `Share the sheet with this address as Editor:\n\n    ${email}\n`,
    );
    process.exit(1);
  }
  if (status === 404) {
    console.error(`\nNo spreadsheet with id ${sheetId} (404).\n`);
    process.exit(1);
  }
  throw err;
}
const existing = new Map(
  (meta.data.sheets ?? []).map((s) => [s.properties?.title ?? "", s.properties]),
);

const toCreate = plan.filter((p) => !existing.has(p.name));
if (toCreate.length > 0) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: toCreate.map((p) => ({
        addSheet: { properties: { title: p.name } },
      })),
    },
  });
  console.log(`Created tabs: ${toCreate.map((p) => p.name).join(", ")}`);
}

// --- Guard against clobbering real data -------------------------------------

if (!force) {
  const check = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: sheetId,
    ranges: plan.map((p) => `${p.name}!A2:A`),
  });
  const occupied = (check.data.valueRanges ?? [])
    .map((range, i) => ({ name: plan[i].name, rows: range.values?.length ?? 0 }))
    .filter((r) => r.rows > 0);

  if (occupied.length > 0) {
    console.error(
      `\nRefusing to overwrite existing data:\n` +
        occupied.map((o) => `  ${o.name}: ${o.rows} row(s)`).join("\n") +
        `\n\nRe-run with --force if you really mean to replace it.\n`,
    );
    process.exit(1);
  }
}

// --- Write ------------------------------------------------------------------

for (const tab of plan) {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `${tab.name}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tab.name}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...tab.headers], ...tab.rows] },
  });
  console.log(`  ${tab.name}: ${tab.rows.length} row(s) written`);
}

// --- Format -----------------------------------------------------------------
// Cosmetic, but this sheet is edited by hand for months: frozen headers so the
// column names stay visible over 170 rows, a dropdown so `side` cannot drift
// into "Bride"/"เจ้าสาว", and a warning on the append-only RSVP tab.

// Re-read the metadata: any tab created above was not in the first fetch, so
// its sheetId would still be unknown here.
const afterCreate = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
const idOf = (title: string) =>
  (afterCreate.data.sheets ?? []).find((s) => s.properties?.title === title)
    ?.properties?.sheetId;

const widths: Record<string, number[]> = {
  [SHEET_TABS.guests]: [110, 150, 130, 110, 90, 110, 90, 120],
  [SHEET_TABS.groups]: [110, 200, 200, 130],
  [SHEET_TABS.rsvp]: [200, 110, 110, 90, 180, 300, 140, 70],
};

const requests: object[] = [];

for (const tab of plan) {
  const sheetId2 = idOf(tab.name);
  if (sheetId2 == null) continue;

  requests.push({
    updateSheetProperties: {
      properties: { sheetId: sheetId2, gridProperties: { frozenRowCount: 1 } },
      fields: "gridProperties.frozenRowCount",
    },
  });
  requests.push({
    repeatCell: {
      range: { sheetId: sheetId2, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true },
          backgroundColor: { red: 0.96, green: 0.94, blue: 0.9 },
        },
      },
      fields: "userEnteredFormat(textFormat,backgroundColor)",
    },
  });
  (widths[tab.name] ?? []).forEach((pixelSize, column) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sheetId2, dimension: "COLUMNS", startIndex: column, endIndex: column + 1 },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    });
  });
}

const guestsId = idOf(SHEET_TABS.guests);
if (guestsId != null) {
  requests.push({
    setDataValidation: {
      // Column G is `side`.
      range: { sheetId: guestsId, startRowIndex: 1, startColumnIndex: 6, endColumnIndex: 7 },
      rule: {
        condition: {
          type: "ONE_OF_LIST",
          values: [{ userEnteredValue: "bride" }, { userEnteredValue: "groom" }],
        },
        showCustomUi: true,
        strict: false,
      },
    },
  });
}

const rsvpId = idOf(SHEET_TABS.rsvp);
// Adding a second protection to the same sheet is an error, and one bad request
// fails the whole batch — so only add it when it is not already there. This
// keeps `push:sheet --force` safe to re-run.
const rsvpAlreadyProtected = (afterCreate.data.sheets ?? []).some(
  (s) => s.properties?.sheetId === rsvpId && (s.protectedRanges?.length ?? 0) > 0,
);
if (rsvpId != null && !rsvpAlreadyProtected) {
  requests.push({
    addProtectedRange: {
      protectedRange: {
        range: { sheetId: rsvpId },
        description:
          "Append-only log written by the RSVP site. Do not edit, sort or " +
          "delete rows — current answers are the last row per guest_id.",
        warningOnly: true,
      },
    },
  });
}

try {
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests } });
  console.log("  formatting: frozen headers, widths, side dropdown, RSVP tab protected");
} catch (err) {
  // Formatting is a nicety; never fail the whole push over it.
  console.log(`  (formatting skipped: ${err instanceof Error ? err.message : err})`);
}

console.log(`
Done — ${useDemo ? "demo data" : "blank scaffold"} pushed to
https://docs.google.com/spreadsheets/d/${sheetId}/edit
`);
