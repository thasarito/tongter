"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  SETTLE_MS,
  applyDrag,
  basePitchAt,
  ease,
  type LookOffset,
} from "@/shared/seated-look";

/**
 * Look around from your chair.
 *
 * Rotation only — the camera never moves — so a guest can turn and take the
 * room in without ever ending up inside a table or under the floor, and with no
 * collision handling to get wrong.
 *
 * Three beats: hold on the chair, lift the gaze to the horizon, then hand over.
 * All the geometry lives in lib/seated-look so it can be checked without a
 * browser; this file is only the clock, the input and the quaternion.
 */

export interface DragDelta {
  /** Pixels dragged horizontally since the last frame. */
  dx: number;
  dy: number;
}

export default function SeatedLook({
  active,
  consumeDrag,
  onLook,
}: {
  active: boolean;
  consumeDrag: () => DragDelta;
  /** Reports applied yaw and pitch in degrees, for the diagnostic readout. */
  onLook?: (yawDeg: number, pitchDeg: number) => void;
}) {
  const { camera, invalidate } = useThree();

  // One owned ref for all mutable state, including scratch maths objects.
  const stateRef = useRef<{
    baseYaw: number;
    arrivalPitch: number;
    sinceActive: number;
    offset: LookOffset;
    yaw: number;
    pitch: number;
    captured: boolean;
    euler: THREE.Euler;
  } | null>(null);
  stateRef.current ??= {
    baseYaw: 0,
    arrivalPitch: 0,
    sinceActive: 0,
    offset: { yaw: 0, pitch: 0 },
    yaw: 0,
    pitch: 0,
    captured: false,
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
  };

  // Capture where the walk left the camera. Yaw becomes the centre of the
  // range — "straight ahead" means facing your own table — while the arrival
  // pitch is kept only so the gaze can rise smoothly away from it.
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    if (!active) {
      s.captured = false;
      return;
    }
    if (s.captured) return;

    s.euler.setFromQuaternion(camera.quaternion);
    s.baseYaw = s.euler.y;
    s.arrivalPitch = s.euler.x;
    s.sinceActive = 0;
    s.offset = { yaw: 0, pitch: 0 };
    s.yaw = 0;
    // Start exactly where the walk left off, so the lift has nothing to snap.
    s.pitch = s.euler.x;
    s.captured = true;
    invalidate();
  }, [active, camera, invalidate]);

  useFrame((_state, delta) => {
    const s = stateRef.current;
    if (!active || !s?.captured) return;

    const step = Math.min(delta, 0.05);
    s.sinceActive += step * 1000;

    const { dx, dy } = consumeDrag();
    if (dx !== 0 || dy !== 0) s.offset = applyDrag(s.offset, dx, dy);

    const targetYaw = s.offset.yaw;
    const targetPitch = basePitchAt(s.sinceActive, s.arrivalPitch) + s.offset.pitch;

    s.yaw = ease(s.yaw, targetYaw, step);
    s.pitch = ease(s.pitch, targetPitch, step);

    s.euler.set(s.pitch, s.baseYaw + s.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(s.euler);
    onLook?.(THREE.MathUtils.radToDeg(s.yaw), THREE.MathUtils.radToDeg(s.pitch));

    // Keep rendering while the gaze is still rising or catching up.
    if (
      s.sinceActive < SETTLE_MS ||
      Math.abs(targetYaw - s.yaw) > 1e-4 ||
      Math.abs(targetPitch - s.pitch) > 1e-4
    ) {
      invalidate();
    }
  });

  return null;
}
