/**
 * Verifies the Google Sheets connection end to end.
 * Run: pnpm check:sheets
 *
 * Checks, in order, so a failure points at exactly one cause:
 *   1. credentials load and the key is well formed
 *   2. the API issues a token for the service account
 *   3. the spreadsheet is reachable (i.e. it has actually been shared)
 *   4. the three tabs exist with the expected headers
 *   5. the rows parse, and any data problems are listed
 *   6. the service account can write (append + remove a probe row)
 */
import { readFileSync } from "node:fs";
import { google } from "googleapis";
import { loadEnv, resolveCredentials } from "./script-env.ts";
import { isValidSeat, TOTAL_SEATS } from "../src/lib/venue.ts";
import {
  GROUP_HEADERS,
  GUEST_HEADERS,
  RSVP_HEADERS,
  SHEET_TABS,
} from "../src/lib/types.ts";

loadEnv();

const skipWrite = process.argv.includes("--no-write");

function die(message: string, hint?: string): never {
  console.error(`\nFAIL  ${message}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

// --- 1. credentials ---------------------------------------------------------

const credentials = resolveCredentials();
if (!credentials) {
  die(
    "No credentials found.",
    "Set GOOGLE_APPLICATION_CREDENTIALS in .env, or place the service account\n" +
      "key at secrets/google-service-account.json.",
  );
}
if (credentials.note) console.log(`  note ${credentials.note}`);

const keyPath = credentials.keyFile;
const keyJson = credentials.json;

let clientEmail = "unknown";
try {
  const raw = keyJson ?? readFileSync(keyPath!, "utf8");
  const parsed = JSON.parse(raw);
  clientEmail = parsed.client_email ?? "unknown";
  if (!parsed.private_key) die("Credential file has no private_key.");
  console.log(`  ok   credentials load — ${clientEmail}`);
} catch (err) {
  die(
    `Could not read credentials: ${err instanceof Error ? err.message : err}`,
    keyPath ? `Looked for: ${keyPath}` : undefined,
  );
}

const sheetId = process.env.GOOGLE_SHEET_ID;
if (!sheetId) {
  die(
    "GOOGLE_SHEET_ID is not set.",
    "Copy it out of the sheet URL:\n" +
      "  https://docs.google.com/spreadsheets/d/<THIS PART>/edit",
  );
}

// --- 2. token ---------------------------------------------------------------

const auth = new google.auth.GoogleAuth({
  ...(keyJson ? { credentials: JSON.parse(keyJson) } : { keyFile: keyPath }),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth: (await auth.getClient()) as never });
console.log("  ok   authenticated with Google");

// --- 3. spreadsheet reachable ----------------------------------------------

let meta;
try {
  meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
} catch (err) {
  const status = (err as { code?: number }).code;
  if (status === 403) {
    die(
      "The service account cannot open that spreadsheet (403).",
      `Share the sheet with this address as Editor:\n\n    ${clientEmail}\n\n` +
        "Note: granting it a project IAM role does nothing — access to a sheet\n" +
        "comes only from sharing the sheet itself.",
    );
  }
  if (status === 404) {
    die("No spreadsheet with that ID (404).", `GOOGLE_SHEET_ID=${sheetId}`);
  }
  die(`Could not open the spreadsheet: ${err instanceof Error ? err.message : err}`);
}

console.log(`  ok   opened "${meta.data.properties?.title ?? "(untitled)"}"`);

// --- 4. tabs and headers ----------------------------------------------------

const present = new Set(
  (meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""),
);
const missing = Object.values(SHEET_TABS).filter((t) => !present.has(t));
if (missing.length > 0) {
  die(
    `Missing tab(s): ${missing.join(", ")}`,
    "Tabs must be named exactly Guests, Groups and RSVP.\n" +
      "`pnpm sheet` generates an importable workbook with all three.",
  );
}
console.log(`  ok   all three tabs present`);

const res = await sheets.spreadsheets.values.batchGet({
  spreadsheetId: sheetId,
  ranges: [
    `${SHEET_TABS.guests}!A1:Z`,
    `${SHEET_TABS.groups}!A1:Z`,
    `${SHEET_TABS.rsvp}!A1:Z`,
  ],
});
const [guestVals, groupVals, rsvpVals] = (res.data.valueRanges ?? []).map(
  (r) => (r.values as string[][] | undefined) ?? [],
);

const normalise = (h: string) => h.toLowerCase().replace(/[\s_-]/g, "");
let headerProblems = 0;
for (const [name, values, expected] of [
  [SHEET_TABS.guests, guestVals, GUEST_HEADERS],
  [SHEET_TABS.groups, groupVals, GROUP_HEADERS],
  [SHEET_TABS.rsvp, rsvpVals, RSVP_HEADERS],
] as const) {
  const found = new Set((values[0] ?? []).map(normalise));
  const absent = expected.filter((h) => !found.has(normalise(h)));
  if (absent.length > 0) {
    headerProblems++;
    console.log(`  WARN ${name}: missing column(s) ${absent.join(", ")}`);
  } else {
    console.log(`  ok   ${name}: headers correct`);
  }
}

// --- 5. data sanity ---------------------------------------------------------

const dataRows = (values: string[][]) =>
  values.slice(1).filter((r) => r.some((c) => c?.trim()));

const guestRows = dataRows(guestVals);
const groupRows = dataRows(groupVals);
const rsvpRows = dataRows(rsvpVals);

console.log(
  `\n  Guests ${guestRows.length}/${TOTAL_SEATS} · Groups ${groupRows.length} · RSVP rows ${rsvpRows.length}`,
);

if (guestRows.length > 0 && headerProblems === 0) {
  const headers = (guestVals[0] ?? []).map(normalise);
  const col = (name: string) => headers.indexOf(normalise(name));
  const tableCol = col("table_id");
  const seatCol = col("seat_index");
  const idCol = col("guest_id");
  const groupCol = col("group_id");

  const badSeats: string[] = [];
  const seatsSeen = new Map<string, string>();
  const idsSeen = new Set<string>();
  const duplicateIds: string[] = [];
  let missingGroup = 0;

  for (const [i, row] of guestRows.entries()) {
    const tableId = Number(row[tableCol]);
    const seatIndex = Number(row[seatCol]);
    const id = row[idCol] ?? "";
    const label = id || `row ${i + 2}`;

    if (!isValidSeat(tableId, seatIndex)) {
      badSeats.push(`${label} → T${row[tableCol]}#${row[seatCol]}`);
    } else {
      const key = `${tableId}:${seatIndex}`;
      if (seatsSeen.has(key)) badSeats.push(`${label} shares seat ${key} with ${seatsSeen.get(key)}`);
      else seatsSeen.set(key, label);
    }
    if (id) {
      if (idsSeen.has(id)) duplicateIds.push(id);
      idsSeen.add(id);
    }
    if (groupCol >= 0 && !row[groupCol]?.trim()) missingGroup++;
  }

  const groupIds = new Set(
    groupRows.map((r) => r[(groupVals[0] ?? []).map(normalise).indexOf("groupid")] ?? ""),
  );
  const orphans = guestRows.filter(
    (r) => groupCol >= 0 && r[groupCol]?.trim() && !groupIds.has(r[groupCol].trim()),
  ).length;

  const report = (label: string, count: number, sample: string[] = []) => {
    if (count === 0) console.log(`  ok   ${label}: none`);
    else console.log(`  WARN ${label}: ${count}${sample.length ? ` — e.g. ${sample.slice(0, 3).join("; ")}` : ""}`);
  };

  report("invalid or duplicated seats", badSeats.length, badSeats);
  report("duplicate guest_id", duplicateIds.length, duplicateIds);
  report("guests with no group_id", missingGroup);
  report("guests pointing at a missing group", orphans);

  if (guestRows.length < TOTAL_SEATS) {
    console.log(`  WARN ${TOTAL_SEATS - guestRows.length} seat(s) on the plan have no guest yet`);
  }
}

// --- 6. write access --------------------------------------------------------

if (skipWrite) {
  console.log("\n  --  write test skipped (--no-write)");
} else {
  const probe = `__probe_${meta.data.spreadsheetId?.slice(0, 6) ?? "x"}`;
  try {
    const append = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_TABS.rsvp}!A:H`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [["", "", probe, "", "", "connectivity probe — safe to delete", "", ""]],
      },
    });

    // Remove the probe again so the couple never sees it.
    const updated = append.data.updates?.updatedRange ?? "";
    const rowNumber = Number(/![A-Z]+(\d+)/.exec(updated)?.[1]);
    const sheetMeta = (meta.data.sheets ?? []).find(
      (s) => s.properties?.title === SHEET_TABS.rsvp,
    );

    if (Number.isFinite(rowNumber) && sheetMeta?.properties?.sheetId != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetMeta.properties.sheetId,
                  dimension: "ROWS",
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber,
                },
              },
            },
          ],
        },
      });
      console.log("  ok   write access confirmed (probe row appended and removed)");
    } else {
      console.log(
        `  WARN wrote a probe row but could not identify it to clean up — ` +
          `delete the RSVP row containing "${probe}" by hand`,
      );
    }
  } catch (err) {
    const status = (err as { code?: number }).code;
    if (status === 403) {
      die(
        "The service account can read but not write (403).",
        `The sheet is shared with ${clientEmail} as Viewer or Commenter.\n` +
          "Change it to Editor — the site has to append RSVP rows.",
      );
    }
    die(`Write test failed: ${err instanceof Error ? err.message : err}`);
  }
}

console.log("\nGoogle Sheets connection is working.\n");
