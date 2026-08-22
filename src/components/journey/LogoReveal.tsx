"use client";

import { useEffect, useState } from "react";
import { event } from "@/shared/event-config";
import { formatEventDate, pick, type Lang } from "@/shared/i18n";

/**
 * The supplied outlined wedding logo, held on screen for a beat before the
 * invitation. A typographic fallback keeps the reveal meaningful if the public
 * SVG cannot be loaded.
 */

const LOGO_SRC = "/logo.svg";
const HOLD_MS = 2200;

export default function LogoReveal({
  lang,
  onDone,
}: {
  lang: Lang;
  onDone: () => void;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // A frame's delay so the fade-in actually plays rather than starting done.
    const raf = requestAnimationFrame(() => setShown(true));
    const id = setTimeout(onDone, HOLD_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(id);
    };
  }, [onDone]);

  const bride = pick(lang, event.bride);
  const groom = pick(lang, event.groom);

  return (
    <button
      type="button"
      onClick={onDone}
      className="bg-rose-field flex min-h-dvh w-full flex-col items-center justify-center px-8 focus:outline-none"
    >
      <div
        className={`flex flex-col items-center transition-all duration-1000 ease-out ${
          shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        {!useFallback ? (
          <img
            src={LOGO_SRC}
            alt={`${bride} & ${groom}`}
            width="760"
            height="275"
            onError={() => setUseFallback(true)}
            className="h-auto w-[min(82vw,28rem)] brightness-0 invert opacity-95 sm:w-[30rem]"
          />
        ) : (
          <div className="text-center text-cream">
            <p className="font-display text-5xl leading-tight sm:text-6xl">
              {bride}
            </p>
            <p className="font-display my-2 text-3xl text-gold">&amp;</p>
            <p className="font-display text-5xl leading-tight sm:text-6xl">
              {groom}
            </p>
          </div>
        )}

        <div className="mt-8 h-px w-24 bg-gold/70" />
        <p className="mt-5 text-sm tracking-[0.25em] text-rose-mist">
          {formatEventDate(event.startsAt, lang)}
        </p>
      </div>
    </button>
  );
}
