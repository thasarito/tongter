import {
  parseDietary,
  serializeDietary,
  type DietaryOption,
  type DietarySelection,
} from "./dietary.ts";
import type { Guest } from "./types.ts";

/**
 * The RSVP form's wire contract, in one place.
 *
 * Field names and the rules for reading them used to live in two files — the
 * form component invented `attending:${id}` in JSX, and the server action
 * re-derived the same string when parsing. Any UI rework had to rediscover that
 * convention and match it exactly, with a silent "no answer" as the failure
 * mode. Now both sides import from here, so a new UI can be written against
 * `fields.attending(guest.id)` without knowing or caring what the string is.
 *
 * Deliberately free of React and of anything server-only, so it can be unit
 * tested and reused by whatever the next UI turns out to be.
 */

export const fields = {
  token: "token",
  lang: "lang",
  submittedBy: "submittedBy",
  message: "message",
  /** Radio group per guest: "yes" | "no". */
  attending: (guestId: string) => `attending:${guestId}`,
  /** Checkbox group per guest; one entry per selected option id. */
  dietary: (guestId: string) => `dietary:${guestId}`,
  /** Free-text box per guest, for anything not in the options. */
  dietaryOther: (guestId: string) => `dietaryOther:${guestId}`,
  /** Per-person note to the couple. */
  note: (guestId: string) => `note:${guestId}`,
} as const;

/** Longest value accepted in any free-text field. */
export const MAX_TEXT = 500;

/**
 * The subset of FormData this module needs.
 *
 * Narrowing to an interface means the parser can be exercised with a plain
 * object in tests, with no DOM and no server action.
 */
export interface FormValues {
  get(name: string): string | null;
  getAll(name: string): string[];
}

/** Adapts a real FormData, coercing File entries away. */
export function fromFormData(data: FormData): FormValues {
  const text = (value: FormDataEntryValue | null) =>
    typeof value === "string" ? value : null;
  return {
    get: (name) => text(data.get(name)),
    getAll: (name) =>
      data.getAll(name).flatMap((v) => (typeof v === "string" ? [v] : [])),
  };
}

/** Builds FormValues from a plain record — used by tests. */
export function fromRecord(
  record: Record<string, string | string[]>,
): FormValues {
  return {
    get: (name) => {
      const v = record[name];
      if (v === undefined) return null;
      return Array.isArray(v) ? (v[0] ?? null) : v;
    },
    getAll: (name) => {
      const v = record[name];
      if (v === undefined) return [];
      return Array.isArray(v) ? v : [v];
    },
  };
}

export interface RsvpAnswer {
  guestId: string;
  attending: boolean;
  dietary: DietarySelection;
  note: string;
}

export interface ParsedRsvp {
  token: string;
  lang: string;
  submittedBy: string;
  answers: RsvpAnswer[];
}

/** Dictionary keys under `rsvp`, so the UI resolves its own copy. */
export type RsvpErrorKey = "errorBody" | "needOneAnswer";

export type RsvpParseResult =
  | { ok: true; value: ParsedRsvp }
  | { ok: false; errorKey: RsvpErrorKey };

function clamp(value: string | null): string {
  return (value ?? "").trim().slice(0, MAX_TEXT);
}

/**
 * Reads and validates a submission.
 *
 * `guests` is the authoritative membership list, read from the sheet by the
 * caller — answers are collected by walking it, never by trusting whatever
 * guest ids the request happened to contain. A crafted POST therefore cannot
 * answer on behalf of somebody in a different group.
 *
 * **Partial submissions are valid.** The journey walks a group one person at a
 * time and lets anyone stop early, so a form covering only some of the group is
 * the normal case, not an error. Guests left blank are simply skipped: no row is
 * written for them, and their previous answer (if any) still stands. Only a
 * wholly empty form is rejected.
 */
export function parseRsvpForm(
  values: FormValues,
  guests: readonly Guest[],
  options: readonly DietaryOption[],
): RsvpParseResult {
  const token = clamp(values.get(fields.token));
  if (!token) return { ok: false, errorKey: "errorBody" };
  if (guests.length === 0) return { ok: false, errorKey: "errorBody" };

  const known = new Set(options.map((o) => o.id));
  const answers: RsvpAnswer[] = [];

  for (const guest of guests) {
    const raw = values.get(fields.attending(guest.guestId));
    // Blank means "not answered yet" — skip, do not decline on their behalf.
    if (raw !== "yes" && raw !== "no") continue;

    const selected = values
      .getAll(fields.dietary(guest.guestId))
      .map((v) => v.trim())
      .filter((v) => known.has(v));

    answers.push({
      guestId: guest.guestId,
      attending: raw === "yes",
      // De-duplicate: a checkbox group can legitimately repeat a value.
      dietary: {
        selected: [...new Set(selected)],
        other: clamp(values.get(fields.dietaryOther(guest.guestId))),
      },
      note: clamp(values.get(fields.note(guest.guestId))),
    });
  }

  if (answers.length === 0) return { ok: false, errorKey: "needOneAnswer" };

  return {
    ok: true,
    value: {
      token,
      lang: clamp(values.get(fields.lang)) || "th",
      submittedBy: clamp(values.get(fields.submittedBy)),
      answers,
    },
  };
}

/** Flattens answers into the rows the sheet stores. */
export function toSheetEntries(parsed: ParsedRsvp) {
  return parsed.answers.map((a) => ({
    guestId: a.guestId,
    attending: a.attending,
    dietary: serializeDietary(a.dietary),
    note: a.note,
  }));
}

/** Reads a stored cell back into a selection, for replaying the form. */
export function dietaryFromSheet(
  raw: string,
  options: readonly DietaryOption[],
): DietarySelection {
  return parseDietary(raw, options);
}
