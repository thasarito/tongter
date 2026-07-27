import Link from "next/link";
import Countdown from "@/components/Countdown";
import SiteHeader from "@/components/SiteHeader";
import { event } from "@/lib/config";
import { formatEventDate, formatEventTime, pick, t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export default async function Home() {
  const lang = await getLang();
  const copy = t(lang);
  const venue = pick(lang, event.venue);
  const dress = pick(lang, event.dressCode);

  return (
    <>
      <SiteHeader lang={lang} />

      <main className="flex-1">
        {/* Invitation */}
        <section className="mx-auto max-w-2xl px-6 pt-10 pb-16 text-center sm:pt-16">
          <p className="text-sm leading-relaxed text-muted">
            {copy.landing.invitationLine}
          </p>

          <h1 className="mt-8 font-display text-5xl leading-tight text-ink sm:text-7xl">
            {pick(lang, event.bride)}
            <span className="mx-3 text-gold">&amp;</span>
            {pick(lang, event.groom)}
          </h1>

          <div className="rule-gold mx-auto my-10 w-52" />

          <p className="font-display text-xl text-ink sm:text-2xl">
            {formatEventDate(event.startsAt, lang)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatEventTime(event.startsAt, lang)} · {venue.name}
          </p>

          <div className="mt-12">
            <Countdown target={event.startsAt} lang={lang} />
          </div>

          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/rsvp"
              className="w-full rounded-full bg-ink px-8 py-3 text-sm tracking-wide text-cream transition hover:bg-gold sm:w-auto"
            >
              {copy.landing.ctaRsvp}
            </Link>
            <Link
              href="/rsvp"
              className="w-full rounded-full border border-line px-8 py-3 text-sm tracking-wide text-ink transition hover:border-gold sm:w-auto"
            >
              {copy.landing.ctaFindSeat}
            </Link>
          </div>
        </section>

        {/* Details */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            <div className="bg-paper p-7">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
                {copy.landing.whenTitle}
              </h2>
              <p className="mt-3 font-display text-xl text-ink">
                {formatEventDate(event.startsAt, lang)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {formatEventTime(event.startsAt, lang)}
              </p>
            </div>

            <div className="bg-paper p-7">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
                {copy.landing.whereTitle}
              </h2>
              <p className="mt-3 font-display text-xl text-ink">{venue.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {venue.address}
              </p>
              <a
                href={event.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-gold underline underline-offset-4 hover:text-ink"
              >
                {copy.landing.directions}
              </a>
            </div>

            <div className="bg-paper p-7 sm:col-span-2">
              <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
                {dress.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink">
                {dress.detail}
              </p>
              <div className="mt-4 flex gap-2">
                <span className="h-6 w-6 rounded-full bg-cream ring-1 ring-line" />
                <span className="h-6 w-6 rounded-full bg-blush ring-1 ring-line" />
                <span className="h-6 w-6 rounded-full bg-sky ring-1 ring-line" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-6 pb-10 text-center text-xs text-muted">
        {pick(lang, event.bride)} {copy.common.and} {pick(lang, event.groom)}
      </footer>
    </>
  );
}
