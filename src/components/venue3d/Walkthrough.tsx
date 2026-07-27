"use client";

import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import WalkCamera from "./WalkCamera";
import VenueScene, { type Highlight } from "./VenueScene";
import { ENTRANCE } from "@/lib/venue";
import { EYE_HEIGHT } from "@/lib/walk-path";

export interface WalkthroughProps {
  highlight: Highlight;
  animate: boolean;
  replayKey: number;
  onArrive?: () => void;
}

/**
 * Canvas wrapper for the seat walk.
 *
 * Renders continuously only while the camera is moving, then drops to
 * on-demand so a phone left on this page is not spinning the GPU for the rest
 * of the reception.
 */
export default function Walkthrough({
  highlight,
  animate,
  replayKey,
  onArrive,
}: WalkthroughProps) {
  // Which replay the camera has finished. Deriving "still walking" from this
  // means a replay switches the render loop back on without an effect.
  const [arrivedKey, setArrivedKey] = useState<number | null>(null);
  const walking = arrivedKey !== replayKey;

  return (
    <Canvas
      // Capped device pixel ratio: retina phones would otherwise render this at
      // 3x for no visual gain on flat-shaded geometry.
      dpr={[1, 1.5]}
      frameloop={walking ? "always" : "demand"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      // A slightly wide lens at standing height, framed like a person's view.
      camera={{
        fov: 62,
        near: 0.1,
        far: 80,
        position: [ENTRANCE.x, EYE_HEIGHT, ENTRANCE.z],
      }}
      onCreated={({ scene }) => {
        scene.background = null;
      }}
    >
      <VenueScene highlight={highlight} />
      <WalkCamera
        focus={highlight.focus}
        animate={animate}
        replayKey={replayKey}
        onArrive={() => {
          setArrivedKey(replayKey);
          onArrive?.();
        }}
      />
    </Canvas>
  );
}
