"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  EYE_HEIGHT,
  buildWalkPath,
  walkDurationMs,
} from "@/lib/walk-path";
import { getSeat } from "@/lib/venue";

/**
 * Walks the camera from the entrance to a guest's seat.
 *
 * First person at eye height, following the route from lib/walk-path. Three
 * details do the work of selling it as walking rather than gliding:
 *
 *  - a trapezoidal speed profile, so it sets off and comes to rest rather than
 *    snapping to full speed
 *  - a small vertical bob and lateral sway locked to distance travelled, not to
 *    time, so the gait stays consistent no matter the frame rate
 *  - the gaze follows the path ahead, then turns to the chair on arrival
 */

/** Stride length in metres; the head rises and falls once per step. */
const STEP_LENGTH = 0.72;
const BOB_AMPLITUDE = 0.018;
const SWAY_AMPLITUDE = 0.02;

/** Fraction of the walk spent accelerating, and again decelerating. */
const RAMP = 0.18;

/** How far ahead the gaze rests while walking, in metres. */
const LOOK_AHEAD = 2.4;

/** Over the final stretch, the gaze turns from the path to the chair. */
const TURN_START = 0.82;

/**
 * Distance covered by fraction `t` of the walk, under a trapezoidal speed
 * profile: ramp up, hold, ramp down. Peak speed is only ~1.2x the average, so
 * it reads as a person walking rather than a camera easing.
 */
function distanceAt(t: number): number {
  const total = 1 - RAMP;
  if (t < RAMP) return t * t / (2 * RAMP) / total;
  if (t <= 1 - RAMP) return (RAMP / 2 + (t - RAMP)) / total;
  const remaining = 1 - t;
  return (RAMP / 2 + (1 - 2 * RAMP) + (RAMP - remaining * remaining / (2 * RAMP))) / total;
}

/** Instantaneous speed as a fraction of peak, used to damp the bob at the ends. */
function speedAt(t: number): number {
  if (t < RAMP) return t / RAMP;
  if (t <= 1 - RAMP) return 1;
  return Math.max((1 - t) / RAMP, 0);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface WalkCameraProps {
  focus: { tableId: number; seatIndex: number } | null;
  /** False places the camera at the chair immediately (skip, reduced motion). */
  animate: boolean;
  onArrive?: () => void;
  /** Bumping this restarts the walk. */
  replayKey: number;
}

export default function WalkCamera({
  focus,
  animate,
  onArrive,
  replayKey,
}: WalkCameraProps) {
  const { camera, invalidate } = useThree();
  const elapsed = useRef(0);
  const arrived = useRef(false);

  const seat = focus ? getSeat(focus.tableId, focus.seatIndex) : undefined;
  const path = useMemo(() => (seat ? buildWalkPath(seat) : null), [seat]);
  const duration = path ? walkDurationMs(path.length) : 0;

  // Scratch vectors, reused every frame so the walk allocates nothing.
  // A ref rather than useMemo: these are mutated on every frame, and a memo is
  // meant to hold values that are not written to.
  const scratchRef = useRef<{
    position: THREE.Vector3;
    tangent: THREE.Vector3;
    right: THREE.Vector3;
    lookAhead: THREE.Vector3;
    lookAt: THREE.Vector3;
    up: THREE.Vector3;
  } | null>(null);
  scratchRef.current ??= {
    position: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    right: new THREE.Vector3(),
    lookAhead: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
  };

  useEffect(() => {
    elapsed.current = 0;
    arrived.current = false;
    invalidate();
  }, [replayKey, invalidate]);

  useFrame((_state, delta) => {
    const scratch = scratchRef.current;
    if (!path || !scratch) return;

    const finish = () => {
      if (arrived.current) return;
      arrived.current = true;
      onArrive?.();
    };

    if (!animate) {
      const end = path.curve.getPointAt(1);
      camera.position.set(end.x, EYE_HEIGHT, end.z);
      camera.lookAt(path.lookTarget);
      finish();
      return;
    }

    // Clamp delta so a backgrounded tab does not teleport on return.
    elapsed.current += Math.min(delta, 0.05) * 1000;
    const t = Math.min(elapsed.current / duration, 1);

    const travelled = distanceAt(t);
    path.curve.getPointAt(THREE.MathUtils.clamp(travelled, 0, 1), scratch.position);
    path.curve.getTangentAt(THREE.MathUtils.clamp(travelled, 0, 1), scratch.tangent);
    scratch.tangent.y = 0;
    if (scratch.tangent.lengthSq() < 1e-6) scratch.tangent.set(0, 0, -1);
    scratch.tangent.normalize();

    // Bob is a function of ground distance, so the gait does not speed up or
    // slow down with the frame rate.
    const metres = travelled * path.length;
    const phase = (metres / STEP_LENGTH) * Math.PI * 2;
    const gait = speedAt(t);

    scratch.right.crossVectors(scratch.tangent, scratch.up).normalize();

    camera.position.set(
      scratch.position.x + scratch.right.x * Math.sin(phase / 2) * SWAY_AMPLITUDE * gait,
      EYE_HEIGHT + Math.sin(phase) * BOB_AMPLITUDE * gait,
      scratch.position.z + scratch.right.z * Math.sin(phase / 2) * SWAY_AMPLITUDE * gait,
    );

    // Look along the path, then turn to the chair over the final stretch.
    scratch.lookAhead
      .copy(scratch.position)
      .addScaledVector(scratch.tangent, LOOK_AHEAD);
    scratch.lookAhead.y = EYE_HEIGHT - 0.1;

    const turn = smoothstep(TURN_START, 1, t);
    scratch.lookAt.copy(scratch.lookAhead).lerp(path.lookTarget, turn);
    camera.lookAt(scratch.lookAt);

    if (t >= 1) finish();
  });

  return null;
}
