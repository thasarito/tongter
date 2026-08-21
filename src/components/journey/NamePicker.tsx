"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { t, type Lang } from "@/shared/i18n";
import { searchGuests, type SearchableGuest } from "@/shared/search";

/**
 * Find yourself among the guests.
 *
 * Names drift past on staggered rows, as in the reference: each row is a track
 * of pills animated with a CSS transform and duplicated so the loop is
 * seamless. Rows alternate direction and run at different speeds, which is what
 * stops it reading as one sliding block.
 *
 * Drifting is lovely but useless for finding a specific person, so typing stops
 * everything and collapses to a plain grid of matches. That search is the same
 * Thai matcher the rest of the site uses, so "วิว" still finds "พี่วิว".
 */

const ROWS = 4;
/** Seconds for one full loop. Longer rows drift slower so speed looks even. */
const BASE_DURATION = 46;

export interface NamePickerGuest extends SearchableGuest {
  /** Display name in the chosen language. */
  name: string;
  /** First character, for the monogram badge. */
  initial: string;
  side: "bride" | "groom" | null;
}

function Pill({
  guest,
  onPick,
}: {
  guest: NamePickerGuest;
  onPick: (guestId: string) => void;
}) {
  const tint =
    guest.side === "groom"
      ? "bg-sky-soft text-sky-deep"
      : guest.side === "bride"
        ? "bg-blush-soft text-blush-deep"
        : "bg-gold-soft text-gold";

  return (
    <button
      type="button"
      onClick={() => onPick(guest.guestId)}
      className="flex shrink-0 items-center gap-3 rounded-full bg-paper py-2.5 pl-2.5 pr-6 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base ${tint}`}
      >
        {guest.initial}
      </span>
      <span className="whitespace-nowrap text-base text-ink">{guest.name}</span>
    </button>
  );
}

export default function NamePicker({
  lang,
  guests,
  searchable,
  onPick,
  onBack,
}: {
  lang: Lang;
  guests: NamePickerGuest[];
  /** The same list, typed for the Thai-aware matcher. */
  searchable: readonly NamePickerGuest[];
  onPick: (guestId: string) => void;
  onBack?: () => void;
}) {
  const copy = t(lang).journey;
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  // Keeps typing responsive while the match list re-renders.
  const deferredQuery = useDeferredValue(query);

  const byId = useMemo(
    () => new Map(guests.map((g) => [g.guestId, g])),
    [guests],
  );

  const rows = useMemo(() => {
    const buckets: NamePickerGuest[][] = Array.from({ length: ROWS }, () => []);
    guests.forEach((guest, i) => buckets[i % ROWS].push(guest));
    return buckets.filter((b) => b.length > 0);
  }, [guests]);

  const matches = useMemo(() => {
    const q = deferredQuery.trim();
    if (q.length < 1) return null;
    const allowed = new Set(guests.map((g) => g.guestId));
    // Only search within the side already chosen.
    return searchGuests(searchable.filter((g) => allowed.has(g.guestId)), q, 40)
      .map((m) => byId.get(m.guest.guestId))
      .filter((g): g is NamePickerGuest => Boolean(g));
  }, [deferredQuery, guests, searchable, byId]);

  return (
    <div className="bg-rose-field flex min-h-dvh flex-col px-0 py-12">
      <div className="px-6">
        <h1 className="font-display text-center text-3xl text-cream sm:text-4xl">
          {copy.findYourName}
        </h1>
        <div className="mx-auto mt-6 w-full max-w-sm">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.findYourName}
            className="w-full rounded-full border border-white/30 bg-white/15 px-5 py-3 text-base text-white outline-none backdrop-blur transition placeholder:text-white/60 focus:border-white/70"
          />
        </div>
      </div>

      <div className="mt-10 flex-1">
        {matches ? (
          matches.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-3 px-6">
              {matches.map((guest) => (
                <Pill key={guest.guestId} guest={guest} onPick={onPick} />
              ))}
            </div>
          ) : (
            <p className="px-6 text-center text-sm text-rose-mist">
              {copy.noMatch}
            </p>
          )
        ) : (
          <div
            className="pill-rows flex flex-col gap-3 overflow-hidden"
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {rows.map((row, i) => (
              <div
                key={i}
                className="pill-track"
                data-direction={i % 2 === 1 ? "right" : "left"}
                data-paused={paused}
                style={{
                  animationDuration: `${BASE_DURATION + i * 7}s`,
                }}
              >
                {/* Duplicated so translating by -50% lands on an identical frame. */}
                {[...row, ...row].map((guest, j) => (
                  <Pill
                    key={`${guest.guestId}-${j}`}
                    guest={guest}
                    onPick={onPick}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mx-auto mt-10 text-sm text-rose-mist underline underline-offset-4 transition hover:text-white"
        >
          {copy.back}
        </button>
      )}
    </div>
  );
}
