"use client";

import { useEffect, useRef } from "react";

/**
 * On-screen readout for diagnosing the look-around, shown with `?debug=1`.
 *
 * The drag has failed on a real iPhone more than once while looking correct in
 * the source, and there is no browser here to inspect. This says plainly which
 * link in the chain is broken: whether the overlay sees pointer events at all,
 * whether touch events arrive instead, whether the walk has finished so the
 * controls are live, and whether the render loop is consuming the drag.
 *
 * Values are polled with rAF and written straight to the DOM — putting them in
 * React state would re-render on every pointer move and change the very timing
 * being measured.
 */
export interface LookDebugCounters {
  pointerDown: number;
  pointerMove: number;
  touchStart: number;
  touchMove: number;
  framesConsumed: number;
  lastDx: number;
  lastDy: number;
  yawDeg: number;
  pitchDeg: number;
}

export default function LookDebug({
  counters,
  active,
}: {
  counters: React.RefObject<LookDebugCounters>;
  /** Whether the walk has finished and the controls are live. */
  active: boolean;
}) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = counters.current;
      const node = ref.current;
      if (node && c) {
        node.textContent =
          `active (walk done): ${active}\n` +
          `pointerdown: ${c.pointerDown}   pointermove: ${c.pointerMove}\n` +
          `touchstart:  ${c.touchStart}   touchmove:   ${c.touchMove}\n` +
          `frames consumed: ${c.framesConsumed}\n` +
          `last delta: ${c.lastDx.toFixed(0)}, ${c.lastDy.toFixed(0)}\n` +
          `yaw: ${c.yawDeg.toFixed(1)}°   pitch: ${c.pitchDeg.toFixed(1)}°`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [counters, active]);

  return (
    <pre
      ref={ref}
      className="pointer-events-none absolute left-3 top-3 z-50 whitespace-pre rounded-lg bg-black/75 px-3 py-2 font-mono text-[11px] leading-tight text-lime-300"
    />
  );
}
