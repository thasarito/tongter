/**
 * The fields matching actually needs. Narrowing to this means the browser can
 * be handed a name list for the picker without also shipping seat assignments
 * or personal invite tokens.
 */
export interface SearchableGuest {
  guestId: string;
  nameTh: string;
  nameEn: string;
}

/**
 * Guest name search.
 *
 * The seating plan names people the way the couple talks about them, with Thai
 * kinship prefixes attached: พี่วิว, น้องกัน, ป้าโต, แฟนพี่วิว. Guests looking
 * themselves up will usually type just the nickname ("วิว"), so matching has to
 * see through those prefixes while still ranking a full exact match first.
 */

/** Kinship and relationship prefixes, longest first so stripping is greedy. */
const PREFIXES = [
  "แฟนพี่",
  "แฟนน้อง",
  "แฟนลุง",
  "แฟนป้า",
  "แฟนน้า",
  "แฟนอา",
  "ลูกพี่",
  "ลูกน้อง",
  "ลูกลุง",
  "ลูกป้า",
  "ยาย",
  "แฟน",
  "ลูก",
  "คุณ",
  "พี่",
  "น้อง",
  "ป้า",
  "ลุง",
  "น้า",
  "แม่",
  "พ่อ",
  "ตา",
  "อา",
];

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "").trim();
}

/** Removes one leading kinship prefix, e.g. "แฟนพี่วิว" → "วิว". */
function stripPrefix(value: string): string {
  for (const prefix of PREFIXES) {
    if (value.startsWith(prefix) && value.length > prefix.length) {
      return value.slice(prefix.length);
    }
  }
  return value;
}

function scoreOne(candidate: string, query: string): number {
  if (!candidate) return 0;
  const c = normalise(candidate);
  const q = normalise(query);
  if (!c || !q) return 0;

  if (c === q) return 100;

  const cBare = stripPrefix(c);
  const qBare = stripPrefix(q);
  if (cBare === qBare) return 90;

  if (c.startsWith(q)) return 70;
  if (cBare.startsWith(qBare)) return 60;
  if (c.includes(q)) return 40;
  if (cBare.includes(qBare)) return 30;

  return 0;
}

export interface GuestMatch<T extends SearchableGuest = SearchableGuest> {
  guest: T;
  score: number;
}

/**
 * Ranked matches for a query. Requires at least two characters so the whole
 * guest list can never be enumerated by submitting a single letter.
 */
export function searchGuests<T extends SearchableGuest>(
  guests: readonly T[],
  query: string,
  limit = 8,
): GuestMatch<T>[] {
  const q = query.trim();
  if (q.length < 2) return [];

  return guests
    .map((guest) => ({
      guest,
      score: Math.max(scoreOne(guest.nameTh, q), scoreOne(guest.nameEn, q)),
    }))
    .filter((m) => m.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.guest.nameTh || a.guest.nameEn).localeCompare(
          b.guest.nameTh || b.guest.nameEn,
          "th",
        ),
    )
    .slice(0, limit);
}
