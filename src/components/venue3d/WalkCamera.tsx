"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  EYE_HEIGHT,
  INTRO,
  INTRO_MS,
  LOOK_AHEAD,
  LOOK_DROP,
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

/** Over the final stretch, the gaze turns from the path to the chair. */
const TURN_START = 0.82;

/**
 * Distance covered by fraction `t` of the walk, under a trapezoidal speed
 * profile: ramp up, hold, ramp down. Peak speed is only ~1.2x the average, so
 * it reads as a person walking rather than a camera easing.
 */
function distanceAt(t: number): number {
  // Integral of the velocity profile v(t): t/RAMP while ramping up, 1 while
  // cruising, (1-t)/RAMP while ramping down. Total distance is (1 - RAMP), so
  // each branch is normalised by that to land exactly on 1 at t = 1.
  const total = 1 - RAMP;
  if (t < RAMP) return (t * t) / (2 * RAMP) / total;
  if (t <= 1 - RAMP) return (RAMP / 2 + (t - RAMP)) / total;
  const remaining = 1 - t;
  return (1 - RAMP - (remaining * remaining) / (2 * RAMP)) / total;
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
  /** Fires once when the doors should begin to swing. */
  onGateOpen?: () => void;
  /** Bumping this restarts the walk. */
  replayKey: number;
}

export default function WalkCamera({
  focus,
  animate,
  onArrive,
  onGateOpen,
  replayKey,
}: WalkCameraProps) {
  const { camera, invalidate } = useThree();
  const elapsed = useRef(0);
  const arrived = useRef(false);
  const gateSignalled = useRef(false);

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
    gateSignalled.current = false;
    invalidate();
  }, [replayKey, invalidate]);

  useFrame((_state, delta) => {
    const scratch = scratchRef.current;
    if (!path || !scratch) return;

    /*
     * Once seated, the camera belongs to SeatedLook — hand it over and stop.
     *
     * Without this the walk never actually ends: `t` simply clamps at 1 and
     * this callback keeps re-aiming at the chair on every frame. Because both
     * components drive the same camera and this one is registered second, it
     * silently undid every drag the guest made. The look-around applied its
     * rotation and this overwrote it a moment later, so the numbers all looked
     * right while nothing on screen moved.
     */
    if (arrived.current) return;

    const finish = () => {
      if (arrived.current) return;
      arrived.current = true;
      onArrive?.();
    };

    if (!animate) {
      const end = path.curve.getPointAt(1);
      camera.position.set(end.x, EYE_HEIGHT, end.z);
      camera.lookAt(path.lookTarget);
      if (!gateSignalled.current) {
        gateSignalled.current = true;
        onGateOpen?.();
      }
      finish();
      return;
    }

    // Clamp delta so a backgrounded tab does not teleport on return.
    elapsed.current += Math.min(delta, 0.05) * 1000;

    if (elapsed.current >= INTRO.gateOpensAtMs && !gateSignalled.current) {
      gateSignalled.current = true;
      onGateOpen?.();
    }

    /*
     * --- Standing outside while the doors open -----------------------------
     *
     * Only a pause now. The route itself begins out here and comes in through
     * the doorway, so setting off is just the walk starting — one motion with
     * one gait, rather than a slide handed over to a walk.
     */
    if (elapsed.current < INTRO_MS) {
      const start = path.curve.getPointAt(0);
      camera.position.set(start.x, EYE_HEIGHT, start.z);

      path.curve.getTangentAt(0, scratch.tangent);
      scratch.tangent.y = 0;
      if (scratch.tangent.lengthSq() < 1e-6) scratch.tangent.set(0, 0, -1);
      scratch.tangent.normalize();

      scratch.lookAhead
        .copy(start)
        .addScaledVector(scratch.tangent, LOOK_AHEAD);
      scratch.lookAhead.y = EYE_HEIGHT - LOOK_DROP;
      camera.lookAt(scratch.lookAhead);
      return;
    }

    const t = Math.min((elapsed.current - INTRO_MS) / duration, 1);

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
    scratch.lookAhead.y = EYE_HEIGHT - LOOK_DROP;

    const turn = smoothstep(TURN_START, 1, t);
    scratch.lookAt.copy(scratch.lookAhead).lerp(path.lookTarget, turn);
    camera.lookAt(scratch.lookAt);

    if (t >= 1) finish();
  });

  return null;
}
