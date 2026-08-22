/**
 * Bilingual copy. Thai is the default; English is a toggle for the handful of
 * international guests.
 *
 * Deliberately a plain typed dictionary rather than a i18n library — there are
 * two languages and one page of copy, and `Dict` typing means a missing English
 * string is a compile error rather than a blank space on the invitation.
 */

export const LANGS = ["th", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "th";
export const LANG_COOKIE = "lang";

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

const th = {
  common: {
    and: "และ",
    rsvp: "ตอบรับคำเชิญ",
    back: "ย้อนกลับ",
    loading: "กำลังโหลด...",
    table: "โต๊ะ",
    seat: "ที่นั่ง",
    switchTo: "English",
    langName: "ไทย",
  },
  landing: {
    invitationLine: "ขอเรียนเชิญร่วมเป็นเกียรติในงานมงคลสมรส",
    ctaRsvp: "ตอบรับคำเชิญ",
    ctaFindSeat: "ดูที่นั่งของฉัน",
    whenTitle: "วันและเวลา",
    whereTitle: "สถานที่",
    directions: "ดูแผนที่",
    countdownTitle: "เหลืออีก",
    days: "วัน",
    hours: "ชั่วโมง",
    minutes: "นาที",
    seconds: "วินาที",
    dayHasArrived: "ถึงวันงานแล้ว",
  },
  saveDate: {
    weddingOf: "THE WEDDING OF",
    saveTheDate: "โปรดบันทึกวันสำคัญของเรา",
    invitationToFollow: "การ์ดเชิญอย่างเป็นทางการและแบบตอบรับจะตามมาเร็ว ๆ นี้",
    addToCalendar: "เพิ่มลงปฏิทิน",
    chooseCalendar: "เลือกปฏิทินที่คุณใช้",
    googleHint: "เปิดและบันทึกใน Google",
    fileHint: "ดาวน์โหลดไฟล์ปฏิทิน",
    calendarTitle: "งานแต่งงานของวริศราและธสฤษฏ์",
    calendarDescription:
      "ร่วมฉลองวันสำคัญของวริศราและธสฤษฏ์ การ์ดเชิญอย่างเป็นทางการและแบบตอบรับจะตามมาเร็ว ๆ นี้",
  },
  search: {
    title: "ค้นหาชื่อของคุณ",
    subtitle: "พิมพ์ชื่อหรือชื่อเล่นของคุณ เพื่อดูที่นั่งและตอบรับคำเชิญ",
    placeholder: "เช่น วิว, พี่แป้ง",
    minChars: "กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร",
    noResults: "ไม่พบชื่อนี้ในรายชื่อแขก",
    noResultsHint: "ลองพิมพ์เฉพาะชื่อเล่น หรือติดต่อเจ้าภาพได้เลย",
    resultsTitle: "พบรายชื่อ",
    inGroup: "ในกลุ่ม",
  },
  rsvp: {
    title: "ตอบรับคำเชิญ",
    groupIntro: "กรุณาตอบรับแทนทุกคนในกลุ่มของคุณ",
    attending: "เข้าร่วมงาน",
    notAttending: "ไม่สามารถเข้าร่วมได้",
    dietaryLabel: "ข้อจำกัดด้านอาหาร",
    dietaryOther: "อื่น ๆ",
    dietaryPlaceholder: "ระบุเพิ่มเติม เช่น แพ้กุ้ง",
    dietaryNone: "ไม่มี",
    messageLabel: "คำอวยพรถึงบ่าวสาว",
    messagePlaceholder: "เขียนคำอวยพร (ไม่บังคับ)",
    submittedByLabel: "ผู้ตอบรับ",
    submit: "ส่งคำตอบ",
    submitting: "กำลังส่ง...",
    alreadyRespondedTitle: "คุณตอบรับแล้ว",
    alreadyRespondedBody: "สามารถแก้ไขคำตอบได้ตลอดเวลา",
    successTitle: "ขอบคุณสำหรับการตอบรับ",
    successBody: "เราบันทึกคำตอบของคุณเรียบร้อยแล้ว",
    viewSeat: "ดูที่นั่งของคุณ",
    errorTitle: "ส่งคำตอบไม่สำเร็จ",
    errorBody: "กรุณาลองใหม่อีกครั้ง หากยังไม่สำเร็จ กรุณาติดต่อเจ้าภาพ",
    needOneAnswer: "กรุณาเลือกคำตอบให้ครบทุกคน",
  },
  journey: {
    tapToOpen: "แตะเพื่อเปิดการ์ด",
    openInvitation: "เปิดการ์ดเชิญ",
    whichSide: "คุณเป็นแขกของฝ่ายไหน",
    whichSideHint: "เลือกเพื่อให้หาชื่อได้ง่ายขึ้น",
    sideOf: "ฝ่าย",
    guests: "ท่าน",
    showEveryone: "ดูรายชื่อทั้งหมด",
    findYourName: "หาชื่อของคุณ",
    searchPlaceholder: "พิมพ์ชื่อหรือชื่อเล่น",
    noMatch: "ไม่พบชื่อนี้ ลองพิมพ์เฉพาะชื่อเล่นดูนะคะ",
    back: "ย้อนกลับ",
    notYou: "ไม่ใช่คุณ?",
    continueAs: "ดำเนินการต่อในชื่อ",
    whichOneAreYou: "คุณคือท่านใด",
    yourTurn: "ตอบรับสำหรับคุณ",
    alsoInGroup: "อีกท่านในกลุ่มของคุณ",
    personOf: "คนที่",
    saveAndNext: "บันทึกและถัดไป",
    finishHere: "เสร็จสิ้น",
    skipPerson: "ข้ามท่านนี้",
    allDone: "เรียบร้อยแล้ว",
    seeYourSeat: "ไปดูที่นั่งของคุณ",
  },
  seat: {
    title: "ที่นั่งของคุณ",
    yourTable: "โต๊ะของคุณ",
    yourSeat: "ที่นั่งที่",
    groupSeats: "ที่นั่งของกลุ่มคุณ",
    replay: "ดูอีกครั้ง",
    skip: "ข้าม",
    mapFallback: "แผนผังที่นั่ง",
    walkingIn: "กำลังพาคุณไปยังที่นั่ง...",
    dragToLook: "ลากเพื่อมองรอบ ๆ",
    scrollForDetails: "เลื่อนลงเพื่อดูรายละเอียด",
  },
  errors: {
    notFoundTitle: "ไม่พบลิงก์นี้",
    notFoundBody: "ลิงก์อาจไม่ถูกต้องหรือหมดอายุ กรุณาค้นหาชื่อของคุณแทน",
    searchInstead: "ค้นหาชื่อของคุณ",
    unconfiguredTitle: "ยังไม่ได้เชื่อมต่อข้อมูล",
    unconfiguredBody: "ระบบยังไม่ได้เชื่อมต่อกับ Google Sheet",
    staleNotice: "ข้อมูลอาจไม่เป็นปัจจุบัน กำลังพยายามเชื่อมต่อใหม่",
  },
};

/** English must mirror the Thai shape exactly; TypeScript enforces it below. */
const en = {
  common: {
    and: "and",
    rsvp: "RSVP",
    back: "Back",
    loading: "Loading...",
    table: "Table",
    seat: "Seat",
    switchTo: "ไทย",
    langName: "English",
  },
  landing: {
    invitationLine: "Together with our families, we invite you to celebrate our wedding",
    ctaRsvp: "RSVP",
    ctaFindSeat: "Find my seat",
    whenTitle: "When",
    whereTitle: "Where",
    directions: "Get directions",
    countdownTitle: "Counting down",
    days: "days",
    hours: "hours",
    minutes: "minutes",
    seconds: "seconds",
    dayHasArrived: "Today is the day",
  },
  saveDate: {
    weddingOf: "THE WEDDING OF",
    saveTheDate: "PLEASE SAVE THE DATE",
    invitationToFollow: "Formal invitation and RSVP to follow.",
    addToCalendar: "Add to calendar",
    chooseCalendar: "Choose your calendar",
    googleHint: "Open and save with Google",
    fileHint: "Download a calendar file",
    calendarTitle: "Warissara & Thasarit's Wedding",
    calendarDescription:
      "Celebrate Warissara and Thasarit's wedding with us. Formal invitation and RSVP to follow.",
  },
  search: {
    title: "Find your name",
    subtitle: "Type your name or nickname to see your seat and RSVP",
    placeholder: "e.g. View, Paeng",
    minChars: "Please type at least 2 characters",
    noResults: "We could not find that name on the guest list",
    noResultsHint: "Try just your nickname, or contact the couple",
    resultsTitle: "Matches",
    inGroup: "in",
  },
  rsvp: {
    title: "RSVP",
    groupIntro: "Please respond for everyone in your group",
    attending: "Attending",
    notAttending: "Cannot attend",
    dietaryLabel: "Dietary requirements",
    dietaryOther: "Something else",
    dietaryPlaceholder: "Anything else, e.g. shellfish allergy",
    dietaryNone: "None",
    messageLabel: "A message for the couple",
    messagePlaceholder: "Write your wishes (optional)",
    submittedByLabel: "Your name",
    submit: "Send response",
    submitting: "Sending...",
    alreadyRespondedTitle: "You have already responded",
    alreadyRespondedBody: "You can change your answers at any time",
    successTitle: "Thank you for responding",
    successBody: "Your answers have been saved",
    viewSeat: "See your seat",
    errorTitle: "Could not send your response",
    errorBody: "Please try again. If it keeps failing, contact the couple",
    needOneAnswer: "Please answer for everyone in the group",
  },
  journey: {
    tapToOpen: "Tap to open",
    openInvitation: "Open the invitation",
    whichSide: "Whose guest are you?",
    whichSideHint: "Just so we can narrow the list down",
    sideOf: "side",
    guests: "guests",
    showEveryone: "Show everyone",
    findYourName: "Find your name",
    searchPlaceholder: "Type a name or nickname",
    noMatch: "No match — try just the nickname",
    back: "Back",
    notYou: "Not you?",
    continueAs: "Continue as",
    whichOneAreYou: "Which one are you?",
    yourTurn: "Your RSVP",
    alsoInGroup: "Also in your group",
    personOf: "Person",
    saveAndNext: "Save and continue",
    finishHere: "Finish here",
    skipPerson: "Skip this person",
    allDone: "All done",
    seeYourSeat: "See your seat",
  },
  seat: {
    title: "Your seat",
    yourTable: "Your table",
    yourSeat: "Seat number",
    groupSeats: "Your group's seats",
    replay: "Play again",
    skip: "Skip",
    mapFallback: "Seating plan",
    walkingIn: "Taking you to your seat...",
    dragToLook: "Drag to look around",
    scrollForDetails: "Scroll for details",
  },
  errors: {
    notFoundTitle: "Link not found",
    notFoundBody: "This link may be incorrect or expired. Try searching for your name instead",
    searchInstead: "Find your name",
    unconfiguredTitle: "Guest list not connected",
    unconfiguredBody: "The site is not connected to the Google Sheet yet",
    staleNotice: "This data may be out of date. Reconnecting",
  },
};

export type Dict = typeof th;

// Key parity, checked in both directions: assigning en→th catches a string
// missing from English, and th→en catches one missing from Thai. Neither
// dictionary is `as const`, so the values widen to `string` and only the shape
// is compared.
const _enCoversTh: Dict = en;
const _thCoversEn: typeof en = th;
void _enCoversTh;
void _thCoversEn;

const DICTS: Record<Lang, Dict> = { th, en };

export function t(lang: Lang): Dict {
  return DICTS[lang];
}

/**
 * Picks the right side of a `{ th, en }` pair.
 *
 * Two type parameters rather than one: config values are declared `as const`,
 * so the Thai and English branches have different literal types and a single
 * `T` would force them to be identical.
 */
export function pick<TTh, TEn>(lang: Lang, value: { th: TTh; en: TEn }): TTh | TEn {
  return lang === "en" ? value.en : value.th;
}

const DATE_LOCALE: Record<Lang, string> = { th: "th-TH", en: "en-GB" };

export function formatEventDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export function formatEventTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}
