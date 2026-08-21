"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

/**
 * The opening beat: a rose envelope that a guest taps to break the seal.
 *
 * Built from CSS gradients and transforms rather than images — it has to be the
 * very first thing on screen, so it cannot wait on a download. The flap folds
 * back on a 3D rotation, the card slides up behind it, and the whole thing
 * hands over to the next stage once the animation settles.
 */

const FLAP_MS = 900;
const LIFT_MS = 700;

export default function Envelope({
  lang,
  onOpened,
}: {
  lang: Lang;
  onOpened: () => void;
}) {
  const copy = t(lang).journey;
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!opening) return;
    const id = setTimeout(onOpened, FLAP_MS + LIFT_MS);
    return () => clearTimeout(id);
  }, [opening, onOpened]);

  return (
    <div className="bg-rose-field flex min-h-dvh flex-col items-center justify-center px-6">
      <button
        type="button"
        onClick={() => setOpening(true)}
        disabled={opening}
        aria-label={copy.openInvitation}
        className="group relative block w-full max-w-sm [perspective:1200px] focus:outline-none"
      >
        {/* Envelope body */}
        <div
          className={`relative aspect-[7/5] w-full rounded-lg bg-rose-deep shadow-2xl transition-transform duration-700 ${
            opening ? "translate-y-6 scale-95" : "group-hover:-translate-y-1"
          }`}
        >
          {/* The card, rising out as the flap opens */}
          <div
            className={`absolute inset-x-[8%] bottom-[10%] rounded-md bg-cream shadow-lg transition-all ease-out ${
              opening ? "h-[86%] opacity-100" : "h-[70%] opacity-0"
            }`}
            style={{ transitionDuration: `${LIFT_MS}ms`, transitionDelay: opening ? `${FLAP_MS - 200}ms` : "0ms" }}
          />

          {/* Lower body, drawn over the card so it appears to sit inside */}
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <div
              className="absolute inset-x-0 bottom-0 h-[62%] bg-rose"
              style={{ clipPath: "polygon(0 22%, 50% 0, 100% 22%, 100% 100%, 0 100%)" }}
            />
            <div
              className="absolute inset-y-0 left-0 w-1/2 bg-rose-deep/40"
              style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
            />
            <div
              className="absolute inset-y-0 right-0 w-1/2 bg-rose-deep/40"
              style={{ clipPath: "polygon(100% 0, 0 50%, 100% 100%)" }}
            />
          </div>

          {/* Flap, hinged along the top edge */}
          <div
            className="absolute inset-x-0 top-0 h-[58%] origin-top transition-transform ease-in-out"
            style={{
              transitionDuration: `${FLAP_MS}ms`,
              transform: opening ? "rotateX(-172deg)" : "rotateX(0deg)",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              className="h-full w-full bg-rose"
              style={{
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                backfaceVisibility: "hidden",
              }}
            />
          </div>

          {/* Wax seal, at the point of the flap */}
          <div
            className={`absolute left-1/2 top-[52%] z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-lg transition-all duration-300 ${
              opening ? "scale-0 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <span className="font-display absolute inset-0 grid place-items-center text-lg text-rose-dark">
              W&amp;T
            </span>
          </div>
        </div>
      </button>

      <p
        className={`mt-10 text-sm tracking-[0.2em] text-rose-mist transition-opacity duration-500 ${
          opening ? "opacity-0" : "opacity-100"
        }`}
      >
        {copy.tapToOpen}
      </p>
    </div>
  );
}
