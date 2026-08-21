"use client";

import { useMemo, useState } from "react";
import LangToggle from "@/components/LangToggle";
import { event } from "@/shared/event-config";
import { pick, t, type Lang } from "@/shared/i18n";

const CALENDAR_FILE = "/warissara-thasarit-wedding.ics";

function compactUtc(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function googleCalendarHref(lang: Lang): string {
  const copy = t(lang).saveDate;
  const venue = pick(lang, event.venue);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: copy.calendarTitle,
    dates: `${compactUtc(event.startsAt)}/${compactUtc(event.endsAt)}`,
    details: `${copy.calendarDescription}\n${event.mapUrl}`,
    location: venue.name,
    ctz: "Asia/Bangkok",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M6.75 3.75v3M17.25 3.75v3M4 9h16" strokeLinecap="round" />
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M8 13h3v3H8zM13 13h3v3h-3z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="m6.5 4.5 5.5 5.5-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlowerLineArt({ position }: { position: "top" | "bottom" }) {
  return (
    <svg
      aria-hidden="true"
      data-position={position}
      className={`save-date-flower pointer-events-none absolute ${
        position === "top"
          ? "-right-24 -top-20 w-[26rem] rotate-[-10deg] sm:-right-20 sm:-top-16"
          : "-bottom-28 -left-28 w-[28rem] rotate-[168deg] sm:-bottom-24 sm:-left-24"
      }`}
      viewBox="0 0 420 420"
      fill="none"
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path
          pathLength="1"
          d="M214 218c-43-55-86-104-146-119 21 54 62 94 128 119"
        />
        <path
          pathLength="1"
          d="M211 214c-20-69-16-124 18-174 25 55 21 113-18 174"
        />
        <path
          pathLength="1"
          d="M217 218c43-58 92-91 157-96-30 53-81 84-157 96"
        />
        <path
          pathLength="1"
          d="M212 222c-72-17-126-4-169 39 63 12 119-1 169-39"
        />
        <path
          pathLength="1"
          d="M217 223c68 1 119 25 151 73-62-1-113-25-151-73"
        />
        <path
          pathLength="1"
          d="M211 224c-42 44-61 94-51 151 49-32 68-82 51-151"
        />
        <path
          pathLength="1"
          d="M218 225c38 45 54 94 42 148-45-34-61-83-42-148"
        />
        <path pathLength="1" d="M206 212c9-8 21-7 29 1 8 9 7 22-2 30-9 7-22 6-29-3-7-9-6-20 2-28Z" />
        <path pathLength="1" d="M86 102c42 19 74 44 102 78M231 45c-5 43-8 83-3 122M365 128c-46 11-86 31-118 59" />
        <path pathLength="1" d="M49 262c48-9 92-8 135 5M363 298c-45-20-84-31-122-30" />
      </g>
    </svg>
  );
}

export default function SaveTheDatePage({ lang }: { lang: Lang }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const copy = t(lang).saveDate;
  const conjunction = t(lang).common.and;
  const location = pick(lang, event.saveTheDateVenue);
  const googleHref = useMemo(() => googleCalendarHref(lang), [lang]);

  return (
    <main className="save-date-stage flex min-h-dvh items-center justify-center sm:p-6">
      <section
        className="save-date-card relative isolate flex min-h-dvh w-full flex-col overflow-hidden text-[#f8f6ef] sm:h-[min(92dvh,56rem)] sm:min-h-0 sm:w-auto sm:aspect-[5/7] sm:rounded-[2rem]"
        aria-labelledby="save-date-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") setCalendarOpen(false);
        }}
      >
        <FlowerLineArt position="top" />
        <FlowerLineArt position="bottom" />

        <div className="save-date-language absolute right-5 top-5 z-30 sm:right-7 sm:top-7 [&_button]:border-white/35 [&_button]:bg-black/5 [&_button]:text-white/80 [&_button:hover]:border-white/70 [&_button:hover]:text-white">
          <LangToggle lang={lang} />
        </div>

        <div className="relative z-10 flex min-h-dvh flex-1 flex-col px-7 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(5rem,env(safe-area-inset-top))] text-center sm:min-h-0 sm:px-12 sm:pb-10 sm:pt-16">
          <div className="save-date-rise save-date-delay-1">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.42em] text-white/82 sm:text-xs">
              {copy.weddingOf}
            </p>
            <div className="mx-auto mt-5 flex w-24 items-center gap-2" aria-hidden="true">
              <span className="h-px flex-1 bg-white/35" />
              <span className="h-1 w-1 rotate-45 border border-white/55" />
              <span className="h-px flex-1 bg-white/35" />
            </div>
          </div>

          <div className="save-date-names my-auto flex min-h-[18rem] flex-col items-center justify-center py-10 sm:min-h-0 sm:py-6">
            <h1
              id="save-date-title"
              aria-label={`Warissara ${conjunction} Thasarit`}
              className="save-date-script text-center"
            >
              <span aria-hidden="true" className="block pr-8 sm:pr-12">
                Warissara
              </span>
              <span aria-hidden="true" className="-mt-3 block pl-10 sm:-mt-5 sm:pl-16">
                Thasarit
              </span>
            </h1>
          </div>

          <div className="save-date-rise save-date-delay-3 mx-auto w-full max-w-sm">
            <p className="text-[0.62rem] uppercase tracking-[0.34em] text-white/64 sm:text-[0.68rem]">
              {copy.saveTheDate}
            </p>
            <time
              dateTime={event.startsAt}
              className="mt-3 block font-display text-2xl font-medium tracking-[0.22em] text-white sm:text-[1.7rem]"
            >
              15 · 11 · 2026
            </time>
            <p className="mt-2 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-white/74 sm:text-xs">
              {location}
            </p>
            <p className="mx-auto mt-5 max-w-xs text-xs leading-6 text-white/67 sm:text-sm">
              {copy.invitationToFollow}
            </p>

            <div className="relative mt-6">
              <button
                type="button"
                aria-expanded={calendarOpen}
                aria-controls="calendar-options"
                onClick={() => setCalendarOpen((open) => !open)}
                className="save-date-calendar-button group flex w-full items-center justify-center gap-3 rounded-full px-6 py-3.5 text-sm font-medium tracking-wide shadow-[0_12px_35px_rgba(44,45,37,0.2)] transition duration-300 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/80"
              >
                <CalendarIcon />
                <span>{copy.addToCalendar}</span>
                <span
                  className={`transition-transform duration-300 ${calendarOpen ? "rotate-90" : ""}`}
                >
                  <ArrowIcon />
                </span>
              </button>

              <div
                id="calendar-options"
                aria-hidden={!calendarOpen}
                className={`save-date-options ${calendarOpen ? "is-open" : ""}`}
              >
                <div className="save-date-options-inner">
                  <div className="rounded-[1.35rem] border border-white/20 bg-[#6f725f]/95 p-3 text-left shadow-2xl backdrop-blur-xl">
                    <p className="px-3 pb-2 pt-1 text-[0.62rem] uppercase tracking-[0.2em] text-white/55">
                      {copy.chooseCalendar}
                    </p>
                    <a
                      href={googleHref}
                      target="_blank"
                      rel="noreferrer"
                      tabIndex={calendarOpen ? 0 : -1}
                      aria-label="Google Calendar"
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/80"
                    >
                      <span>
                        <span className="block font-medium">Google Calendar</span>
                        <span className="mt-0.5 block text-[0.68rem] text-white/55">
                          {copy.googleHint}
                        </span>
                      </span>
                      <ArrowIcon />
                    </a>
                    <div className="mx-3 h-px bg-white/12" />
                    <a
                      href={CALENDAR_FILE}
                      download
                      tabIndex={calendarOpen ? 0 : -1}
                      aria-label="Apple Calendar / Outlook"
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-sm text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/80"
                    >
                      <span>
                        <span className="block font-medium">Apple Calendar / Outlook</span>
                        <span className="mt-0.5 block text-[0.68rem] text-white/55">
                          {copy.fileHint}
                        </span>
                      </span>
                      <ArrowIcon />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
