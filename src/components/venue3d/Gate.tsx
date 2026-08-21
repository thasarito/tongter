"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { GATE as DOORWAY } from "@/shared/venue";

/**
 * A pair of doors at the entrance that swing open as the walk begins.
 *
 * It gives the walk a beginning: without it the camera simply starts moving
 * inside a room. The doors are hinged at their outer edges and rotate away from
 * the guest, so the view opens outward into the hall.
 *
 * `open` is read every frame and eased toward, rather than driven by a timer,
 * so a replay or a skip is picked up immediately.
 */

const GATE = {
  width: DOORWAY.width,
  height: DOORWAY.height,
  thickness: 0.08,
  /** How far each door swings, in radians. */
  swing: Math.PI * 0.62,
  /** Larger is slower; this is the exponential-approach rate. */
  ease: 2.6,
};

export default function Gate({ open }: { open: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const progress = useRef(0);

  useFrame((_state, delta) => {
    const target = open ? 1 : 0;
    // Frame-rate independent exponential approach.
    progress.current +=
      (target - progress.current) * (1 - Math.exp(-GATE.ease * Math.min(delta, 0.05)));

    const angle = progress.current * GATE.swing;
    if (left.current) left.current.rotation.y = angle;
    if (right.current) right.current.rotation.y = -angle;
  });

  const halfWidth = GATE.width / 2;

  return (
    <group position={[DOORWAY.center.x, 0, DOORWAY.center.z]}>
      {/* Frame */}
      <mesh position={[-halfWidth - 0.12, GATE.height / 2, 0]}>
        <boxGeometry args={[0.22, GATE.height + 0.25, 0.3]} />
        <meshStandardMaterial color="#f2ece1" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[halfWidth + 0.12, GATE.height / 2, 0]}>
        <boxGeometry args={[0.22, GATE.height + 0.25, 0.3]} />
        <meshStandardMaterial color="#f2ece1" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0, GATE.height + 0.15, 0]}>
        <boxGeometry args={[GATE.width + 0.68, 0.28, 0.3]} />
        <meshStandardMaterial color="#f2ece1" roughness={0.55} metalness={0.2} />
      </mesh>

      {/*
        Glazed leaves in slim frames, matching the pavilion. Solid panels read
        as a garden shed against a glass building.
      */}
      {[
        { ref: left, hinge: -halfWidth, sign: 1 },
        { ref: right, hinge: halfWidth, sign: -1 },
      ].map(({ ref, hinge, sign }, i) => (
        <group key={i} ref={ref} position={[hinge, 0, 0]}>
          <mesh position={[(sign * halfWidth) / 2, GATE.height / 2, 0]}>
            <boxGeometry args={[halfWidth, GATE.height, GATE.thickness]} />
            <meshStandardMaterial
              color="#cfe2e6"
              transparent
              opacity={0.3}
              roughness={0.08}
              metalness={0.15}
              depthWrite={false}
            />
          </mesh>
          {/* Frame: stiles top, bottom and along the meeting edge. */}
          <mesh position={[(sign * halfWidth) / 2, 0.05, 0]}>
            <boxGeometry args={[halfWidth, 0.1, 0.1]} />
            <meshStandardMaterial color="#f2ece1" roughness={0.55} metalness={0.2} />
          </mesh>
          <mesh position={[(sign * halfWidth) / 2, GATE.height - 0.05, 0]}>
            <boxGeometry args={[halfWidth, 0.1, 0.1]} />
            <meshStandardMaterial color="#f2ece1" roughness={0.55} metalness={0.2} />
          </mesh>
          <mesh position={[sign * halfWidth * 0.97, GATE.height / 2, 0]}>
            <boxGeometry args={[0.08, GATE.height, 0.1]} />
            <meshStandardMaterial color="#f2ece1" roughness={0.55} metalness={0.2} />
          </mesh>
          {/* Handle */}
          <mesh position={[sign * halfWidth * 0.82, GATE.height * 0.45, 0.08]}>
            <boxGeometry args={[0.05, 0.5, 0.05]} />
            <meshStandardMaterial color="#c2a24c" roughness={0.35} metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
