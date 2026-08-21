"use client";

import { event } from "@/shared/event-config";
import { pick, t, type Lang } from "@/shared/i18n";
import type { Side } from "@/shared/types";

/**
 * Bride's side or groom's side.
 *
 * Its real job is to halve the name list: 170 names is a lot to drift past, ~85
 * is manageable. Anyone unsure can skip and see everyone.
 */
export default function SidePicker({
  lang,
  counts,
  onPick,
}: {
  lang: Lang;
  counts: Record<Side, number>;
  onPick: (side: Side | null) => void;
}) {
  const copy = t(lang).journey;

  const sides: { id: Side; name: string; tint: string }[] = [
    {
      id: "bride",
      name: pick(lang, event.bride),
      tint: "from-blush to-rose-soft",
    },
    {
      id: "groom",
      name: pick(lang, event.groom),
      tint: "from-sky to-sky-soft",
    },
  ];

  return (
    <div className="bg-rose-field flex min-h-dvh flex-col items-center justify-center px-6 py-14">
      <h1 className="font-display text-center text-3xl text-cream sm:text-4xl">
        {copy.whichSide}
      </h1>
      <p className="mt-3 text-center text-sm text-rose-mist">
        {copy.whichSideHint}
      </p>

      <div className="mt-10 grid w-full max-w-md gap-4 sm:grid-cols-2">
        {sides.map((side) => (
          <button
            key={side.id}
            type="button"
            onClick={() => onPick(side.id)}
            className="group rounded-3xl bg-paper/95 px-6 py-8 text-center shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
          >
            <span
              className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${side.tint} font-display text-2xl text-ink`}
            >
              {side.name.slice(0, 1)}
            </span>
            <span className="mt-4 block font-display text-2xl text-ink">
              {side.name}
            </span>
            <span className="mt-1 block text-xs text-muted">
              {copy.sideOf} · {counts[side.id]} {copy.guests}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onPick(null)}
        className="mt-8 text-sm text-rose-mist underline underline-offset-4 transition hover:text-white"
      >
        {copy.showEveryone}
      </button>
    </div>
  );
}
