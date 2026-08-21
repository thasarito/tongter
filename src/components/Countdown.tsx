"use client";

import { useEffect, useState } from "react";
import { t, type Lang } from "@/shared/i18n";

function parts(msRemaining: number) {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export default function Countdown({ target, lang }: { target: string; lang: Lang }) {
  const copy = t(lang).landing;
  // Starts null so server and client render the same markup; the real value
  // lands after mount, which avoids a hydration mismatch on a ticking clock.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const targetMs = new Date(target).getTime();
    const tick = () => setRemaining(targetMs - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining === null) {
    return <div className="h-20" aria-hidden />;
  }

  if (remaining <= 0) {
    return (
      <p className="font-display text-2xl text-gold">{copy.dayHasArrived}</p>
    );
  }

  const { days, hours, minutes, seconds } = parts(remaining);
  const cells = [
    { value: days, label: copy.days },
    { value: hours, label: copy.hours },
    { value: minutes, label: copy.minutes },
    { value: seconds, label: copy.seconds },
  ];

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted">
        {copy.countdownTitle}
      </p>
      <div className="mt-3 flex justify-center gap-5 sm:gap-8">
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-14">
            <div className="font-display text-3xl text-ink sm:text-4xl tabular-nums">
              {String(cell.value).padStart(2, "0")}
            </div>
            <div className="mt-1 text-[0.7rem] text-muted">{cell.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
