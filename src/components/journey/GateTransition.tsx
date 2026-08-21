"use client";

import { event } from "@/shared/event-config";
import { pick, type Lang } from "@/shared/i18n";

/**
 * Two doors that swing shut over the whole screen when the RSVP is sent.
 *
 * It covers the navigation to the seat page. Submitting writes to a Google
 * Sheet and then loads a new route, which is a second or so of nothing —
 * closing the doors turns that dead time into part of the story, and whatever
 * flicker the page change causes happens behind them.
 *
 * Deliberately CSS rather than 3D: it has to be on screen the instant the
 * button is pressed, long before three.js could load on the next page.
 */
export default function GateTransition({
  closing,
  lang,
}: {
  closing: boolean;
  lang: Lang;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-50 overflow-hidden ${
        closing ? "" : "invisible"
      }`}
    >
      {/* Left leaf */}
      <div
        className="absolute inset-y-0 left-0 w-1/2 bg-rose-deep transition-transform duration-[900ms] ease-in-out"
        style={{ transform: closing ? "translateX(0)" : "translateX(-101%)" }}
      >
        <div className="absolute inset-y-0 right-0 w-1 bg-gold/70" />
      </div>

      {/* Right leaf */}
      <div
        className="absolute inset-y-0 right-0 w-1/2 bg-rose-deep transition-transform duration-[900ms] ease-in-out"
        style={{ transform: closing ? "translateX(0)" : "translateX(101%)" }}
      >
        <div className="absolute inset-y-0 left-0 w-1 bg-gold/70" />
      </div>

      {/* The seal lands once the leaves have met. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
        style={{
          opacity: closing ? 1 : 0,
          transform: `translate(-50%, -50%) scale(${closing ? 1 : 0.6})`,
          transitionDelay: closing ? "700ms" : "0ms",
        }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-gold shadow-xl">
          <span className="font-display text-lg text-rose-dark">
            {pick(lang, event.bride).slice(0, 1)}
            &amp;
            {pick(lang, event.groom).slice(0, 1)}
          </span>
        </div>
      </div>
    </div>
  );
}
