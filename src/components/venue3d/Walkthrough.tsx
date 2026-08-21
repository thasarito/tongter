"use client";

import { Canvas, invalidate } from "@react-three/fiber";
import { useCallback, useRef, useState } from "react";
import Gate from "./Gate";
import LookDebug, { type LookDebugCounters } from "./LookDebug";
import SeatedLook, { type DragDelta } from "./SeatedLook";
import WalkCamera from "./WalkCamera";
import VenueScene, { type Highlight } from "./VenueScene";
import { APPROACH } from "@/shared/venue";
import { EYE_HEIGHT } from "@/shared/walk-path";

export interface WalkthroughProps {
  highlight: Highlight;
  animate: boolean;
  replayKey: number;
  onArrive?: () => void;
  /** Shows the on-screen diagnostic readout (`?debug=1`). */
  debug?: boolean;
}

/**
 * Canvas wrapper for the seat walk.
 *
 * Renders continuously only while the camera is moving, then drops to
 * on-demand so a phone left on this page is not spinning the GPU for the rest
 * of the reception — the look-around re-invalidates as the guest drags.
 *
 * Pointer handling lives here, on the wrapper, and feeds a ref that SeatedLook
 * reads each frame. Keeping it in React props rather than listeners bolted onto
 * the WebGL element means nothing mutates a value a hook handed us.
 */
export default function Walkthrough({
  highlight,
  animate,
  replayKey,
  onArrive,
  debug = false,
}: WalkthroughProps) {
  // Which replay the camera has finished. Deriving "still walking" from this
  // means a replay switches the render loop back on without an effect.
  const [arrivedKey, setArrivedKey] = useState<number | null>(null);
  const walking = arrivedKey !== replayKey;
  // Doors start shut; the camera cues them once the guest has had a moment to
  // look at them. Keyed by replay so a rerun closes them again.
  const [gateOpenKey, setGateOpenKey] = useState<number | null>(null);
  const gateOpen = gateOpenKey === replayKey;

  // Pixels dragged since the last frame; SeatedLook drains this each tick.
  const drag = useRef({ dx: 0, dy: 0 });
  const pointer = useRef({ down: false, x: 0, y: 0 });

  /**
   * Touch events are a fallback for pointer events, not a second source.
   *
   * Every browser that fires pointer events also fires touch events for the
   * same gesture, so taking both would double every drag. The first pointer
   * event latches this and the touch handlers stand down.
   */
  const sawPointer = useRef(false);

  const counters = useRef<LookDebugCounters>({
    pointerDown: 0,
    pointerMove: 0,
    touchStart: 0,
    touchMove: 0,
    framesConsumed: 0,
    lastDx: 0,
    lastDy: 0,
    yawDeg: 0,
    pitchDeg: 0,
  });

  const consumeDrag = useCallback((): DragDelta => {
    const delta = { dx: drag.current.dx, dy: drag.current.dy };
    drag.current.dx = 0;
    drag.current.dy = 0;
    if (delta.dx !== 0 || delta.dy !== 0) {
      counters.current.framesConsumed += 1;
    }
    return delta;
  }, []);

  /** Shared by both input paths so they cannot drift apart. */
  const beginDrag = useCallback((x: number, y: number) => {
    pointer.current = { down: true, x, y };
  }, []);

  const moveDrag = useCallback((x: number, y: number) => {
    if (!pointer.current.down) return;
    const dx = x - pointer.current.x;
    const dy = y - pointer.current.y;
    pointer.current.x = x;
    pointer.current.y = y;
    drag.current.dx += dx;
    drag.current.dy += dy;
    counters.current.lastDx = dx;
    counters.current.lastDy = dy;
    // The loop is on demand once seated, so a drag has to ask for the frame
    // that will consume it — otherwise the deltas pile up unseen.
    invalidate();
  }, []);

  return (
    <div className="scene-shell relative h-full w-full">
      <Canvas
        // Capped device pixel ratio: retina phones would otherwise render this
        // at 3x for no visual gain on flat-shaded geometry.
        dpr={[1, 1.5]}
        frameloop={walking ? "always" : "demand"}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        // A slightly wide lens at standing height, framed like a person's view.
        // Starts outside the doors, looking in.
        camera={{
          fov: 62,
          near: 0.1,
          far: 90,
          position: [APPROACH.x, EYE_HEIGHT, APPROACH.z],
        }}
        onCreated={({ scene }) => {
          scene.background = null;
        }}
      >
        <VenueScene highlight={highlight} />
        <Gate open={gateOpen} />
        {/* Look-around only once the walk has finished, so it cannot fight the
            camera mid-journey. */}
        <SeatedLook
          active={!walking}
          consumeDrag={consumeDrag}
          onLook={(yawDeg, pitchDeg) => {
            counters.current.yawDeg = yawDeg;
            counters.current.pitchDeg = pitchDeg;
          }}
        />
        <WalkCamera
          focus={highlight.focus}
          animate={animate}
          replayKey={replayKey}
          onGateOpen={() => setGateOpenKey(replayKey)}
          onArrive={() => {
            setArrivedKey(replayKey);
            onArrive?.();
          }}
        />
      </Canvas>

      {/*
        Pointer handling lives on an overlay of our own rather than on the
        Canvas. r3f owns the div it renders and connects its own listeners to
        it; putting the drag on a plain element above the canvas takes the
        library out of the loop entirely, which is what finally made this work
        on iOS. Nothing in the scene is clickable, so intercepting everything
        costs nothing.

        No z-index: it must stay below the skip/replay buttons, which are later
        siblings in the parent and win on document order alone.
      */}
      <div
        className="absolute inset-0"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          sawPointer.current = true;
          counters.current.pointerDown += 1;
          if (walking) return;
          beginDrag(e.clientX, e.clientY);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          counters.current.pointerMove += 1;
          if (walking) return;
          moveDrag(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          pointer.current.down = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          pointer.current.down = false;
        }}
        // Fallback for anything that does not deliver pointer events here.
        onTouchStart={(e) => {
          counters.current.touchStart += 1;
          if (sawPointer.current || walking) return;
          const touch = e.touches[0];
          if (touch) beginDrag(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          counters.current.touchMove += 1;
          if (sawPointer.current || walking) return;
          const touch = e.touches[0];
          if (touch) moveDrag(touch.clientX, touch.clientY);
        }}
        onTouchEnd={() => {
          if (sawPointer.current) return;
          pointer.current.down = false;
        }}
      />
      {debug && <LookDebug counters={counters} active={!walking} />}
    </div>
  );
}
