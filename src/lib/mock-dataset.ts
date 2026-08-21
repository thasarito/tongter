import { TABLES, seatsForTable } from "./venue.ts";
import type { Group, Guest, RsvpRow } from "./types.ts";

/**
 * Generates a complete, realistic stand-in guest list covering all 170 seats.
 *
 * Shared by two consumers so they never drift: the app's MOCK_SHEET mode, and
 * the script that exports an import-ready spreadsheet. Fully deterministic —
 * the same seed produces the same list every run, so the demo links printed in
 * one place still work in the other.
 *
 * Imports use explicit .ts extensions because the export script runs under
 * `node --experimental-strip-types`, which does not resolve extensionless paths.
 */

/** Thai nicknames, paired with the romanisation a guest might type. */
const NAMES: [th: string, en: string][] = [
  ["วิว", "View"], ["แป้ง", "Paeng"], ["โบว์", "Bow"], ["กัน", "Gun"],
  ["นัท", "Nut"], ["ปอ", "Por"], ["เจน", "Jane"], ["บอส", "Boss"],
  ["มิ้น", "Mint"], ["ต้น", "Ton"], ["ฟ้า", "Fah"], ["แนน", "Nan"],
  ["โอ๊ต", "Oat"], ["ปุ๊ก", "Pook"], ["เบียร์", "Beer"], ["หญิง", "Ying"],
  ["ก้อย", "Koi"], ["เอ", "Ae"], ["นิว", "New"], ["พลอย", "Ploy"],
  ["ตูน", "Toon"], ["หมิว", "Miew"], ["จูน", "June"], ["แจ๊ค", "Jack"],
  ["อ้อม", "Aom"], ["ป่าน", "Parn"], ["เมย์", "May"], ["ไอซ์", "Ice"],
  ["ดิว", "Dew"], ["บีม", "Beam"], ["ตาล", "Tan"], ["หนึ่ง", "Neung"],
  ["ปาล์ม", "Palm"], ["กิ๊ฟ", "Gift"], ["เค", "Kay"], ["อาร์ม", "Arm"],
  ["น้ำ", "Nam"], ["ฝน", "Fon"], ["ขวัญ", "Kwan"], ["ต่าย", "Tai"],
];

/** Kinship prefixes, matching how the real seating plan labels people. */
const PREFIXES: [th: string, en: string][] = [
  ["พี่", ""], ["น้อง", ""], ["ป้า", ""], ["ลุง", ""], ["คุณ", ""], ["", ""],
];

/** Group flavours, so the demo list reads like a real wedding. */
const GROUP_KINDS: { th: string; en: string; size: [number, number] }[] = [
  { th: "ครอบครัว", en: "Family", size: [3, 5] },
  { th: "เพื่อนเจ้าสาว", en: "Bride's friends", size: [2, 4] },
  { th: "เพื่อนเจ้าบ่าว", en: "Groom's friends", size: [2, 4] },
  { th: "ที่ทำงาน", en: "Colleagues", size: [2, 5] },
  { th: "เพื่อนมหาลัย", en: "University friends", size: [2, 4] },
  { th: "ญาติ", en: "Relatives", size: [2, 4] },
];

/**
 * Values as they are stored: option ids from config.dietaryOptions, comma
 * separated, plus one free-text entry to exercise the fallback path. Ids are
 * duplicated here rather than imported so the fixture stays independent of the
 * couple's live config.
 */
const DIETARY_SAMPLES = [
  "", "", "", "",
  "vegetarian",
  "seafood-allergy",
  "no-beef",
  "halal, no-pork",
  "nut-allergy, แพ้กุ้งด้วย",
];

const MESSAGE_SAMPLES = [
  "ขอให้มีความสุขมาก ๆ นะคะ",
  "ยินดีด้วยครับ ขอให้รักกันนาน ๆ",
  "Congratulations! Wishing you both all the happiness.",
  "ขอให้ครองรักกันตลอดไปค่ะ",
];

/** Small xorshift PRNG so output is byte-identical on every run. */
function makeRng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function makeToken(rng: () => number, length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[Math.floor(rng() * TOKEN_ALPHABET.length)];
  }
  return out;
}

export interface MockDataset {
  guests: Guest[];
  groups: Group[];
  /** A handful of pre-existing responses, so the dashboard is not empty. */
  rsvps: RsvpRow[];
}

export interface MockOptions {
  seed?: number;
  /**
   * Fixed, readable tokens (demo001, demo002, ...) instead of random ones.
   * Used by the app's MOCK_SHEET mode so demo links are easy to type.
   */
  readableTokens?: boolean;
  /** Fraction of groups that already responded, 0–1. */
  respondedRatio?: number;
}

export function buildMockDataset(options: MockOptions = {}): MockDataset {
  const {
    seed = 20270116,
    readableTokens = false,
    respondedRatio = 0.35,
  } = options;

  const rng = makeRng(seed);
  const guests: Guest[] = [];
  const groups: Group[] = [];

  let groupIndex = 0;
  let seatsLeft = 0;
  let current: Group | null = null;
  let currentSide: "bride" | "groom" = "bride";
  let nameCursor = 0;

  for (const table of TABLES) {
    for (const seat of seatsForTable(table.id)) {
      if (seatsLeft === 0) {
        groupIndex += 1;
        const kind = GROUP_KINDS[Math.floor(rng() * GROUP_KINDS.length)];
        const [min, max] = kind.size;
        seatsLeft = min + Math.floor(rng() * (max - min + 1));

        // Odd tables lean to the bride's side, even to the groom's, which is
        // roughly how the real plan's pink/blue chips are distributed.
        currentSide = table.id % 2 === 1 ? "bride" : "groom";

        current = {
          groupId: `grp-${String(groupIndex).padStart(3, "0")}`,
          labelTh: `${kind.th} ${groupIndex}`,
          labelEn: `${kind.en} ${groupIndex}`,
          token: readableTokens
            ? `demo${String(groupIndex).padStart(3, "0")}`
            : makeToken(rng),
        };
        groups.push(current);
      }

      const [nameTh, nameEn] = NAMES[nameCursor % NAMES.length];
      const [prefixTh] = PREFIXES[Math.floor(rng() * PREFIXES.length)];
      nameCursor += 1;

      guests.push({
        guestId: `g${String(table.id).padStart(2, "0")}-${String(seat.seatIndex).padStart(2, "0")}`,
        nameTh: `${prefixTh}${nameTh}`,
        nameEn,
        groupId: current!.groupId,
        tableId: table.id,
        seatIndex: seat.seatIndex,
        side: currentSide,
        tags: rng() < 0.08 ? ["vip"] : [],
        // Personal invite token for /i/<token>. Readable in demo mode so the
        // links are easy to type by hand.
        token: readableTokens
          ? `me${String(guests.length + 1).padStart(3, "0")}`
          : makeToken(rng),
      });

      seatsLeft -= 1;
    }
  }

  // Pre-existing responses for a slice of groups.
  const rsvps: RsvpRow[] = [];
  const respondedCount = Math.floor(groups.length * respondedRatio);
  for (let i = 0; i < respondedCount; i++) {
    const group = groups[i];
    const members = guests.filter((g) => g.groupId === group.groupId);
    const submitter = members[0];
    const message =
      rng() < 0.5 ? MESSAGE_SAMPLES[Math.floor(rng() * MESSAGE_SAMPLES.length)] : "";
    // Deterministic timestamps so reruns are identical. Kept safely in the
    // past: a fixture row dated in the future used to outrank real submissions
    // back when the log was collapsed by timestamp rather than by position.
    const timestamp = new Date(Date.UTC(2026, 2, 1 + (i % 28), 9, i % 60, 0)).toISOString();
    // One person submits for the whole group, so these are per-submission.
    const lang = rng() > 0.85 ? "en" : "th";

    for (const member of members) {
      rsvps.push({
        timestamp,
        groupId: group.groupId,
        guestId: member.guestId,
        // Most say yes; a few decline, which is what the couple needs to see.
        attending: rng() > 0.15,
        dietary: DIETARY_SAMPLES[Math.floor(rng() * DIETARY_SAMPLES.length)],
        message,
        submittedBy: submitter.nameTh,
        lang,
      });
    }
  }

  return { guests, groups, rsvps };
}
