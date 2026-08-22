import { event } from "@/shared/event-config";
import {
  formatEventDate,
  formatEventTime,
  pick,
  type Lang,
} from "@/shared/i18n";

const CALENDAR_FILENAME = "warissara-thasarit-wedding.ics";

const COPY = {
  th: {
    eyebrow: "APPLE CALENDAR",
    title: "เพิ่มลง Apple Calendar",
    body:
      "iPhone จะมองลิงก์ปฏิทินบนเว็บไซต์เป็นปฏิทินแบบติดตาม จึงต้องดาวน์โหลดไฟล์งานก่อน แล้วเปิดไฟล์เพื่อเพิ่มเป็นกิจกรรมครั้งเดียว",
    download: "ดาวน์โหลดไฟล์ปฏิทิน",
    steps:
      "หลังดาวน์โหลด ให้แตะปุ่มดาวน์โหลดของ Safari เปิดไฟล์ .ics แล้วเลือกเพิ่มกิจกรรมทั้งหมด",
    back: "กลับไปหน้า Save the Date",
  },
  en: {
    eyebrow: "APPLE CALENDAR",
    title: "Add to Apple Calendar",
    body:
      "iPhone treats calendar web links as subscription feeds. Download the event file first, then open it to add this one event.",
    download: "Download calendar file",
    steps:
      "After downloading, open Safari Downloads, tap the .ics file, then choose Add All.",
    back: "Back to Save the Date",
  },
} as const;

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M7 3.75v3M17 3.75v3M4.25 9h15.5" strokeLinecap="round" />
      <rect x="4.25" y="5.5" width="15.5" height="14.25" rx="2.5" />
      <path d="M8 13h3v3H8zM13 13h3v3h-3z" />
    </svg>
  );
}

export default function AppleCalendarPage({ lang }: { lang: Lang }) {
  const copy = COPY[lang];
  const venue = pick(lang, event.venue);
  const downloadHref = `/api/calendar/download?lang=${lang}`;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-6 py-[max(3rem,env(safe-area-inset-top))] text-ink">
      <section className="w-full max-w-md rounded-[2rem] border border-line bg-paper px-7 py-9 text-center shadow-[0_24px_70px_rgba(47,42,38,0.1)] sm:px-10 sm:py-11">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-soft text-rose-deep">
          <CalendarIcon />
        </div>

        <p className="mt-7 text-[0.65rem] font-medium tracking-[0.28em] text-muted">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight">
          {copy.title}
        </h1>
        <p className="mt-5 text-sm leading-7 text-muted">{copy.body}</p>

        <div className="mt-7 rounded-2xl border border-line bg-cream/70 px-5 py-5">
          <p className="font-display text-xl">
            {formatEventDate(event.startsAt, lang)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatEventTime(event.startsAt, lang)}
          </p>
          <p className="mt-3 text-sm font-medium">{venue.name}</p>
        </div>

        <a
          href={downloadHref}
          download={CALENDAR_FILENAME}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-3.5 text-sm font-medium tracking-wide text-white transition hover:bg-rose-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose"
        >
          <CalendarIcon />
          <span>{copy.download}</span>
        </a>

        <p className="mt-4 text-xs leading-6 text-muted">{copy.steps}</p>
        <a
          href="/"
          className="mt-7 inline-block text-sm text-muted underline underline-offset-4 transition hover:text-ink"
        >
          {copy.back}
        </a>
      </section>
    </main>
  );
}
