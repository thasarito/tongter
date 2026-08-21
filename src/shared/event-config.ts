import type { DietaryOption } from "./dietary.ts";

export const event = {
  bride: { th: "วริศรา", en: "Warissara" },
  groom: { th: "ธสฤษฏ์", en: "Thasarit" },
  startsAt: "2026-11-15T18:00:00+07:00",
  venue: {
    th: { name: "เดอะ กลาส เฮาส์ นายเลิศ ปาร์ค", address: "" },
    en: { name: "The Glass House, Nai Lert Park", address: "" },
  },
  mapUrl: "https://maps.app.goo.gl/5YVrLWsZ3ocuZgia8",
  dressCode: {
    th: { title: "การแต่งกาย", detail: "ชุดสุภาพ โทนสีครีม ชมพูอ่อน หรือฟ้าอ่อน" },
    en: {
      title: "Dress code",
      detail: "Semi-formal in cream, blush or soft blue",
    },
  },
} as const;

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

export const allowDietaryOther = true;
export const siteUrl = "https://warissara.thasarito.com";
