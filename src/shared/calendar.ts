import { event, siteUrl } from "./event-config";
import { pick, t, type Lang } from "./i18n";

export const CALENDAR_FILENAME = "warissara-thasarit-wedding.ics";
export const CALENDAR_TIME_ZONE = "Asia/Bangkok";

interface CalendarDetails {
  title: string;
  description: string;
  location: string;
}

function detailsFor(lang: Lang): CalendarDetails {
  const copy = t(lang).saveDate;
  const venue = pick(lang, event.venue);
  return {
    title: copy.calendarTitle,
    description: `${copy.calendarDescription}\n${event.mapUrl}`,
    location: venue.name,
  };
}

function compactUtc(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function compactInTimeZone(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CALENDAR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    const byteLimit = chunks.length === 0 ? 75 : 74;
    if (current && currentBytes + characterBytes > byteLimit) {
      chunks.push(current);
      current = character;
      currentBytes = characterBytes;
    } else {
      current += character;
      currentBytes += characterBytes;
    }
  }

  chunks.push(current);
  return chunks
    .map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`))
    .join("\r\n");
}

export function googleCalendarUrl(lang: Lang): string {
  const details = detailsFor(lang);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: details.title,
    dates: `${compactUtc(event.startsAt)}/${compactUtc(event.endsAt)}`,
    details: details.description,
    location: details.location,
    ctz: CALENDAR_TIME_ZONE,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildWeddingCalendar(
  lang: Lang,
  now: Date = new Date(),
): string {
  const details = detailsFor(lang);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Warissara and Thasarit//Wedding//${lang.toUpperCase()}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(details.title)}`,
    `X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
    "BEGIN:VTIMEZONE",
    `TZID:${CALENDAR_TIME_ZONE}`,
    `X-LIC-LOCATION:${CALENDAR_TIME_ZONE}`,
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:ICT",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    "UID:20261115T180000-warissara-thasarit@warissara.thasarito.com",
    `DTSTAMP:${compactUtc(now.toISOString())}`,
    `DTSTART;TZID=${CALENDAR_TIME_ZONE}:${compactInTimeZone(event.startsAt)}`,
    `DTEND;TZID=${CALENDAR_TIME_ZONE}:${compactInTimeZone(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(details.title)}`,
    `DESCRIPTION:${escapeIcsText(details.description)}`,
    `LOCATION:${escapeIcsText(details.location)}`,
    `URL:${siteUrl}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
