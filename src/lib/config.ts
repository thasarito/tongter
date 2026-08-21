import type { DietaryOption } from "./dietary.ts";

/**
 * Event details and runtime configuration.
 *
 * Everything under `event` is placeholder copy — replace it with the real
 * details before launch. Each field is bilingual; see src/lib/i18n.
 */

export const event = {
  // TODO(couple): the groom's Thai spelling is confirmed; the bride's is still
  // a transliteration of "Warissara" and needs checking.
  bride: { th: "วริศรา", en: "Warissara" },
  groom: { th: "ธสฤษฏ์", en: "Thasarit" },

  /** ISO 8601 with timezone. Drives the countdown and the calendar link. */
  startsAt: "2026-11-15T18:00:00+07:00",

  /** An empty address hides the line; the map link carries the directions. */
  venue: {
    th: { name: "เดอะ กลาส เฮาส์ นายเลิศ ปาร์ค", address: "" },
    en: { name: "The Glass House, Nai Lert Park", address: "" },
  },

  /** Google Maps share link, shown as a "get directions" button. */
  mapUrl: "https://maps.app.goo.gl/5YVrLWsZ3ocuZgia8",

  dressCode: {
    th: { title: "การแต่งกาย", detail: "ชุดสุภาพ โทนสีครีม ชมพูอ่อน หรือฟ้าอ่อน" },
    en: {
      title: "Dress code",
      detail: "Semi-formal in cream, blush or soft blue",
    },
  },
} as const;

/**
 * Dietary requirements offered on the RSVP form, as a multi-select.
 *
 * TODO(couple): replace this placeholder list with the real options.
 *
 * `id` is what gets written to the sheet's `dietary` column, so treat ids as
 * permanent: renaming one orphans every answer already given against it.
 * Removing an option is safe — existing answers survive as free text rather
 * than vanishing. Set this to `[]` to fall back to a plain free-text box.
 */
export const dietaryOptions: readonly DietaryOption[] = [
  { id: "vegetarian", label: { th: "มังสวิรัติ", en: "Vegetarian" } },
  { id: "vegan", label: { th: "วีแกน", en: "Vegan" } },
  { id: "halal", label: { th: "ฮาลาล", en: "Halal" } },
  { id: "no-beef", label: { th: "ไม่ทานเนื้อวัว", en: "No beef" } },
  { id: "no-pork", label: { th: "ไม่ทานหมู", en: "No pork" } },
  { id: "seafood-allergy", label: { th: "แพ้อาหารทะเล", en: "Seafood allergy" } },
  { id: "nut-allergy", label: { th: "แพ้ถั่ว", en: "Nut allergy" } },
  { id: "dairy-allergy", label: { th: "แพ้นม", en: "Dairy allergy" } },
] as const;

/** Whether the form also offers a free-text box alongside the checkboxes. */
export const allowDietaryOther = true;

/** Public base URL, used for QR codes and social share metadata. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://warissara.thasarito.com";

/**
 * Server-only environment. Read lazily so that a missing variable surfaces as a
 * clear error at request time rather than crashing the whole container at boot.
 */
export function serverEnv() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const adminPassphrase = process.env.ADMIN_PASSPHRASE;

  return { sheetId, credentialsPath, credentialsJson, adminPassphrase };
}
