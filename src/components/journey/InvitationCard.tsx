"use client";

import Countdown from "@/components/Countdown";
import { event } from "@/shared/event-config";
import { formatEventDate, formatEventTime, pick, t, type Lang } from "@/shared/i18n";

/**
 * The invitation itself: who, when, where, what to wear.
 *
 * Every guest passes through here before the RSVP flow, so it is the one place
 * guaranteed to carry the details. On warm paper rather than rose, so stepping
 * out of the envelope reads as arriving somewhere.
 */
export default function InvitationCard({
  lang,
  onContinue,
}: {
  lang: Lang;
  onContinue: () => void;
}) {
  const copy = t(lang);
  const venue = pick(lang, event.venue);
  const dress = pick(lang, event.dressCode);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 py-14">
      <div className="w-full max-w-md text-center">
        <p className="text-xs leading-relaxed tracking-[0.15em] text-muted">
          {copy.landing.invitationLine}
        </p>

        <h1 className="mt-7 font-display text-5xl leading-tight text-ink sm:text-6xl">
          {pick(lang, event.bride)}
          <span className="mx-3 text-rose">&amp;</span>
          {pick(lang, event.groom)}
        </h1>

        <div className="rule-gold mx-auto my-8 w-40" />

        <p className="font-display text-2xl text-ink">
          {formatEventDate(event.startsAt, lang)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {formatEventTime(event.startsAt, lang)}
        </p>

        <p className="mt-7 font-display text-xl text-ink">{venue.name}</p>
        {venue.address && (
          <p className="mt-1 text-sm leading-relaxed text-muted">{venue.address}</p>
        )}
        <a
          href={event.mapUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-rose underline underline-offset-4 transition hover:text-ink"
        >
          {copy.landing.directions}
        </a>

        <div className="mt-9 rounded-2xl border border-line bg-paper px-6 py-5">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            {dress.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">{dress.detail}</p>
          <div className="mt-3 flex justify-center gap-2">
            <span className="h-5 w-5 rounded-full bg-cream ring-1 ring-line" />
            <span className="h-5 w-5 rounded-full bg-rose-soft ring-1 ring-line" />
            <span className="h-5 w-5 rounded-full bg-sky ring-1 ring-line" />
          </div>
        </div>

        <div className="mt-9">
          <Countdown target={event.startsAt} lang={lang} />
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-10 w-full rounded-full bg-rose px-8 py-3.5 text-sm tracking-wide text-white transition hover:bg-rose-deep"
        >
          {copy.landing.ctaRsvp}
        </button>
      </div>
    </div>
  );
}
