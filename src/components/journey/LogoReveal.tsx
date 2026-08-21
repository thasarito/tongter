"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { event } from "@/lib/config";
import { formatEventDate, pick, type Lang } from "@/lib/i18n";

/**
 * The wedding logo, held on screen for a beat before the invitation.
 *
 * The couple is supplying a file. Until it lands — and if it ever fails to
 * load — this falls back to a typographic monogram rather than a broken image,
 * so the reveal is never empty. Drop the artwork at `public/logo.svg` (or
 * `.png` and change LOGO_SRC) and it takes over with no other change.
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
          <Image
            src={LOGO_SRC}
            alt={`${bride} & ${groom}`}
            width={260}
            height={260}
            priority
            onError={() => setUseFallback(true)}
            className="h-auto w-52 sm:w-64"
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
