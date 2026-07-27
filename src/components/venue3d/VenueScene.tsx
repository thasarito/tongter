"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  ALL_SEATS,
  DIMS,
  HALL,
  HALL_DEPTH,
  HALL_WIDTH,
  PROPS,
  TABLES,
  longTableLength,
  seatKey,
  seatOutward,
} from "@/lib/venue";

/**
 * The banquet hall, built from the same geometry the 2D map uses.
 *
 * Everything is boxes and cylinders on purpose: 170 chairs have to render on a
 * mid-range phone, so there are no loaded models, no shadow maps and no
 * post-processing. Chairs are drawn as two instanced meshes (seats and backs)
 * rather than 340 separate objects.
 */

const CHAIR = {
  width: 0.42,
  seatDepth: 0.42,
  seatThickness: 0.06,
  backThickness: 0.05,
  backHeight: 0.45,
};

const COLORS = {
  floor: "#efe7da",
  wall: "#f7f2e9",
  linen: "#ffffff",
  chair: "#c9b9a2",
  chairGroup: "#e9b8c9",
  chairFocus: "#c2a24c",
  bar: "#d8c7a8",
  stage: "#cbb894",
};

export interface Highlight {
  /** Seats belonging to the viewer's group. */
  group: readonly { tableId: number; seatIndex: number }[];
  /** The one seat the camera settles on. */
  focus: { tableId: number; seatIndex: number } | null;
}

function Floor() {
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(HALL.minX + HALL.maxX) / 2, 0, (HALL.minZ + HALL.maxZ) / 2]}
      >
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
        <meshLambertMaterial color={COLORS.floor} />
      </mesh>
      {/* Walls are single-sided planes facing inward — cheaper than boxes and
          they never occlude the camera from outside. */}
      <mesh
        position={[(HALL.minX + HALL.maxX) / 2, HALL.wallHeight / 2, HALL.minZ]}
      >
        <planeGeometry args={[HALL_WIDTH, HALL.wallHeight]} />
        <meshLambertMaterial color={COLORS.wall} side={THREE.FrontSide} />
      </mesh>
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[HALL.minX, HALL.wallHeight / 2, (HALL.minZ + HALL.maxZ) / 2]}
      >
        <planeGeometry args={[HALL_DEPTH, HALL.wallHeight]} />
        <meshLambertMaterial color={COLORS.wall} side={THREE.FrontSide} />
      </mesh>
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[HALL.maxX, HALL.wallHeight / 2, (HALL.minZ + HALL.maxZ) / 2]}
      >
        <planeGeometry args={[HALL_DEPTH, HALL.wallHeight]} />
        <meshLambertMaterial color={COLORS.wall} side={THREE.FrontSide} />
      </mesh>
    </group>
  );
}

function Tables() {
  return (
    <group>
      {TABLES.map((table) => {
        // Floor-length linen: one solid volume from floor to table height reads
        // correctly and costs a single box.
        if (table.shape === "round") {
          return (
            <mesh
              key={table.id}
              position={[table.center.x, DIMS.tableHeight / 2, table.center.z]}
            >
              <cylinderGeometry
                args={[
                  DIMS.roundTableDiameter / 2,
                  DIMS.roundTableDiameter / 2,
                  DIMS.tableHeight,
                  24,
                ]}
              />
              <meshLambertMaterial color={COLORS.linen} />
            </mesh>
          );
        }
        return (
          <mesh
            key={table.id}
            position={[table.center.x, DIMS.tableHeight / 2, table.center.z]}
          >
            <boxGeometry
              args={[longTableLength(table), DIMS.tableHeight, DIMS.longTableDepth]}
            />
            <meshLambertMaterial color={COLORS.linen} />
          </mesh>
        );
      })}
    </group>
  );
}

/** All 170 chairs as two instanced meshes, tinted per instance. */
function Chairs({ highlight }: { highlight: Highlight }) {
  const seatsRef = useRef<THREE.InstancedMesh>(null);
  const backsRef = useRef<THREE.InstancedMesh>(null);

  const groupKeys = useMemo(
    () => new Set(highlight.group.map((s) => seatKey(s.tableId, s.seatIndex))),
    [highlight.group],
  );
  const focusKey = highlight.focus
    ? seatKey(highlight.focus.tableId, highlight.focus.seatIndex)
    : null;

  useLayoutEffect(() => {
    const seats = seatsRef.current;
    const backs = backsRef.current;
    if (!seats || !backs) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    ALL_SEATS.forEach((seat, i) => {
      const key = seatKey(seat.tableId, seat.seatIndex);

      matrix.compose(
        new THREE.Vector3(seat.x, CHAIR.seatThickness / 2 + DIMS.chairSeatHeight, seat.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, seat.rotationY, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      seats.setMatrixAt(i, matrix);

      // The back sits behind the seat, on the side away from the table.
      const backOffset = CHAIR.seatDepth / 2;
      const out = seatOutward(seat);
      matrix.compose(
        new THREE.Vector3(
          seat.x + out.x * backOffset,
          DIMS.chairSeatHeight + CHAIR.backHeight / 2,
          seat.z + out.z * backOffset,
        ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, seat.rotationY, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      backs.setMatrixAt(i, matrix);

      const hex =
        key === focusKey
          ? COLORS.chairFocus
          : groupKeys.has(key)
            ? COLORS.chairGroup
            : COLORS.chair;
      color.set(hex);
      seats.setColorAt(i, color);
      backs.setColorAt(i, color);
    });

    seats.instanceMatrix.needsUpdate = true;
    backs.instanceMatrix.needsUpdate = true;
    if (seats.instanceColor) seats.instanceColor.needsUpdate = true;
    if (backs.instanceColor) backs.instanceColor.needsUpdate = true;
  }, [groupKeys, focusKey]);

  return (
    <group>
      <instancedMesh
        ref={seatsRef}
        args={[undefined, undefined, ALL_SEATS.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[CHAIR.width, CHAIR.seatThickness, CHAIR.seatDepth]} />
        <meshLambertMaterial />
      </instancedMesh>

      <instancedMesh
        ref={backsRef}
        args={[undefined, undefined, ALL_SEATS.length]}
        frustumCulled={false}
      >
        <boxGeometry args={[CHAIR.width, CHAIR.backHeight, CHAIR.backThickness]} />
        <meshLambertMaterial />
      </instancedMesh>
    </group>
  );
}

function Props3D() {
  return (
    <group>
      <mesh
        position={[PROPS.bar.center.x, PROPS.bar.height / 2, PROPS.bar.center.z]}
      >
        <boxGeometry args={[PROPS.bar.width, PROPS.bar.height, PROPS.bar.depth]} />
        <meshLambertMaterial color={COLORS.bar} />
      </mesh>
      <mesh
        position={[PROPS.stage.center.x, PROPS.stage.height / 2, PROPS.stage.center.z]}
      >
        <boxGeometry
          args={[PROPS.stage.width, PROPS.stage.height, PROPS.stage.depth]}
        />
        <meshLambertMaterial color={COLORS.stage} />
      </mesh>
    </group>
  );
}

/** Soft pulsing disc under the focus seat, so it reads at a distance. */
function FocusMarker({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.34, 0.46, 32]} />
      <meshBasicMaterial color={COLORS.chairFocus} transparent opacity={0.85} />
    </mesh>
  );
}

export default function VenueScene({ highlight }: { highlight: Highlight }) {
  const focusSeat = highlight.focus
    ? ALL_SEATS.find(
        (s) =>
          s.tableId === highlight.focus!.tableId &&
          s.seatIndex === highlight.focus!.seatIndex,
      )
    : null;

  return (
    <group>
      {/* Warm, flat lighting. Lambert + two lights keeps this cheap and avoids
          the shadow map cost entirely. */}
      <ambientLight intensity={1.5} color="#fff6e8" />
      <directionalLight position={[6, 10, 6]} intensity={1.1} color="#fff1dc" />
      <directionalLight position={[-8, 6, -6]} intensity={0.45} color="#e8f1f9" />

      <Floor />
      <Tables />
      <Chairs highlight={highlight} />
      <Props3D />
      {focusSeat && <FocusMarker position={[focusSeat.x, 0.02, focusSeat.z]} />}
    </group>
  );
}
