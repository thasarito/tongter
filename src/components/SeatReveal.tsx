"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import SeatMap2D from "./SeatMap2D";
import { t, type Lang } from "@/lib/i18n";
import type { SeatView } from "@/lib/views";

// three.js is ~600 kB — keep it out of the initial bundle and off the critical
// path for guests who only ever open the invitation.
const Walkthrough = dynamic(() => import("./venue3d/Walkthrough"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-cream" />,
});

export interface SeatRevealProps {
  view: SeatView;
  lang: Lang;
}

// --- Environment detection --------------------------------------------------
// Both of these are external state React does not own, so they are read with
// useSyncExternalStore rather than an effect that calls setState. The server
// snapshot is the conservative answer, which means SSR renders the plan view
// and hydration upgrades it to 3D.

const neverChanges = () => () => {};

let webglSupport: boolean | null = null;

/** Feature-detects WebGL once per page load and caches the answer. */
function detectWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    webglSupport = Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function useWebGL(): boolean {
  return useSyncExternalStore(neverChanges, detectWebGL, () => false);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

export default function SeatReveal({ view, lang }: SeatRevealProps) {
  const { celebrate, focus, group, token } = view;
  const copy = t(lang);
  const webgl = useWebGL();
  const reducedMotion = useReducedMotion();

  const [skipped, setSkipped] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  // Which replay the camera has finished. Comparing it against replayKey
  // derives "has arrived" without an effect, so starting a replay resets it
  // for free.
  const [arrivedKey, setArrivedKey] = useState<number | null>(null);

  const animate = !reducedMotion && !skipped;
  // Reduced motion means there is no walk to wait for.
  const arrived = reducedMotion || arrivedKey === replayKey;

  // Seat refs for the 3D scene and the plan view. The view model already
  // computed which seats belong to the group; this only reshapes them.
  const highlight = useMemo(
    () => ({
      group: view.highlight,
      focus: focus ? { tableId: focus.tableId, seatIndex: focus.seatIndex } : null,
    }),
    [view.highlight, focus],
  );

  const show3D = webgl && focus !== null;
  const isWalking = show3D && !arrived;

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-20">
      {celebrate && (
        <div className="mb-6 rounded-xl border border-gold/40 bg-gold-soft px-5 py-4 text-center">
          <p className="font-display text-xl text-ink">{copy.rsvp.successTitle}</p>
          <p className="mt-1 text-sm text-muted">{copy.rsvp.successBody}</p>
        </div>
      )}

      <div className="relative overflow-hidden rounded-2xl border border-line bg-cream">
        <div className="h-[52vh] min-h-[320px] w-full">
          {show3D ? (
            <Walkthrough
              highlight={highlight}
              animate={animate}
              replayKey={replayKey}
              onArrive={() => setArrivedKey(replayKey)}
            />
          ) : (
            // No WebGL, or nobody in the group is attending — the plan view
            // still answers "where do I sit?".
            <SeatMap2D
              className="h-full w-full p-3"
              highlight={highlight.group}
              focus={highlight.focus}
              showRoute
            />
          )}
        </div>

        {isWalking && (
          <p className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs tracking-wide text-muted">
            {copy.seat.walkingIn}
          </p>
        )}

        {focus && arrived && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-cream via-cream/90 to-transparent px-5 pb-5 pt-10 text-center">
            <p className="font-display text-2xl text-ink sm:text-3xl">
              {focus.name}
            </p>
            <p className="mt-1 text-sm text-muted">
              {copy.common.table} {focus.tableId} · {copy.common.seat}{" "}
              {focus.seatIndex}
            </p>
          </div>
        )}

        {show3D && (
          <div className="absolute right-4 top-4 flex gap-2">
            {isWalking ? (
              <button
                type="button"
                onClick={() => setSkipped(true)}
                className="rounded-full border border-line bg-paper/90 px-4 py-1.5 text-xs text-muted transition hover:text-ink"
              >
                {copy.seat.skip}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSkipped(false);
                  setReplayKey((k) => k + 1);
                }}
                className="rounded-full border border-line bg-paper/90 px-4 py-1.5 text-xs text-muted transition hover:text-ink"
              >
                {copy.seat.replay}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Group roster */}
      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          {copy.seat.groupSeats}
        </h2>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper">
          {group.map((guest) => (
            <li
              key={guest.guestId}
              className="flex items-center justify-between border-b border-line px-5 py-3.5 last:border-b-0"
            >
              <span
                className={
                  guest.attending === false ? "text-muted line-through" : "text-ink"
                }
              >
                {guest.name}
              </span>
              <span className="text-xs text-muted">
                {copy.common.table} {guest.tableId} · {copy.common.seat}{" "}
                {guest.seatIndex}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/*
        Rendered unconditionally, and server-side: it is plain SVG with no
        client state, so a guest with JavaScript blocked — or a phone that never
        finishes loading three.js — still gets a map showing exactly where they
        sit. The 3D canvas above is the enhancement, not the answer.
      */}
      <div className="mt-8">
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">
          {copy.seat.mapFallback}
        </h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper p-3">
          <SeatMap2D
            className="w-full"
            highlight={highlight.group}
            focus={highlight.focus}
            showRoute
          />
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link
          href={`/rsvp/${token}`}
          className="text-sm text-gold underline underline-offset-4 hover:text-ink"
        >
          {copy.rsvp.title}
        </Link>
      </div>
    </section>
  );
}
