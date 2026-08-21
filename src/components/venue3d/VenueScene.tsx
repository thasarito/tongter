"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  AISLE,
  ALCOVES,
  ALCOVE_DEPTH,
  ALL_SEATS,
  BG_TABLE,
  DIMS,
  GATE,
  HALL,
  HALL_DEPTH,
  HALL_WIDTH,
  NORTH_WALL_Z,
  OUTSIDE_DEPTH,
  PROPS,
  TABLES,
  longTableLength,
  seatKey,
  seatOutward,
} from "@/lib/venue";

/**
 * The Glass House at Nai Lert Park.
 *
 * The venue is a glass pavilion, so the walls are glazed and the garden outside
 * is part of the room — an opaque box would read as the wrong building
 * entirely. That drives most of the choices here: transparent panels with
 * mullions, planting beyond them, and daylight coming through rather than a
 * flat interior wash.
 *
 * It still has to hold up on a phone. Everything repeated is instanced — 170
 * chairs, 170 place settings, the mullions, the planting — and the only real
 * lights are one sun and a hemisphere fill. Pendant lamps are emissive spheres,
 * not light sources.
 */

const CHAIR = {
  width: 0.42,
  seatDepth: 0.42,
  seatThickness: 0.06,
  backThickness: 0.05,
  backHeight: 0.45,
};

const COLORS = {
  floor: "#e8ddcd",
  aisle: "#dcc3d1",
  linen: "#fdfbf7",
  chair: "#c9b9a2",
  chairGroup: "#e9b8c9",
  chairFocus: "#c2a24c",
  glass: "#cfe2e6",
  mullion: "#f2ece1",
  bar: "#d8c7a8",
  stage: "#cbb894",
  band: "#c9b28c",
  lawn: "#8fa878",
  foliage: "#6f8f63",
  foliageLight: "#87a473",
  trunk: "#8a7358",
  path: "#d9cfbe",
  plate: "#ffffff",
  lamp: "#ffe3b0",
};

/** Roof height at the eaves; the glass house is tall and open. */
const ROOF_Y = HALL.wallHeight;

export interface Highlight {
  /** Seats belonging to the viewer's group. */
  group: readonly { tableId: number; seatIndex: number }[];
  /** The one seat the camera settles on. */
  focus: { tableId: number; seatIndex: number } | null;
}

/** Deterministic pseudo-random, so the planting is identical every load. */
function hashRandom(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Light
// ---------------------------------------------------------------------------

function Lighting() {
  return (
    <>
      {/*
        A hemisphere does the work a glass building's daylight actually does:
        bright warm sky above, light bounced off the lawn below. It is a single
        cheap light that makes every surface read as lit from outside.
      */}
      <hemisphereLight args={["#fff4e2", "#c8bda6", 1.15]} />
      {/* Low warm sun through the west glazing, matching an early evening. */}
      <directionalLight position={[-16, 9, 6]} intensity={1.35} color="#ffd9a8" />
      {/* Cool counter-fill from the north so shaded sides do not go flat black. */}
      <directionalLight position={[8, 7, -14]} intensity={0.35} color="#cfe0f0" />
      <ambientLight intensity={0.28} color="#fff1de" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function Ground() {
  return (
    <group>
      {/* Interior floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(HALL.minX + HALL.maxX) / 2, 0, (HALL.minZ + HALL.maxZ) / 2]}
        receiveShadow={false}
      >
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.85} metalness={0} />
      </mesh>

      {/* Lawn, wrapping the pavilion on every side. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, HALL.minZ - 6]}>
        <planeGeometry args={[HALL_WIDTH + 40, OUTSIDE_DEPTH + 40]} />
        <meshStandardMaterial color={COLORS.lawn} roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, HALL.maxZ + OUTSIDE_DEPTH / 2]}
      >
        <planeGeometry args={[HALL_WIDTH + 40, OUTSIDE_DEPTH]} />
        <meshStandardMaterial color={COLORS.lawn} roughness={1} />
      </mesh>

      {/* The approach path, leading to the doors. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[GATE.center.x, -0.01, HALL.maxZ + 5]}
      >
        <planeGeometry args={[3.2, 10]} />
        <meshStandardMaterial color={COLORS.path} roughness={0.95} />
      </mesh>
    </group>
  );
}

/**
 * A glazed wall panel.
 *
 * Kept as a plain transparent standard material rather than true transmission:
 * refraction would mean rendering the scene twice, which a mid-range phone
 * cannot spare for something that reads almost identically at this opacity.
 */
function Glass({
  width,
  height,
  position,
  rotation = [0, 0, 0],
}: {
  width: number;
  height: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        color={COLORS.glass}
        transparent
        opacity={0.16}
        roughness={0.08}
        metalness={0.1}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Vertical glazing bars, instanced — they are what make glass read as glass. */
function Mullions() {
  const ref = useRef<THREE.InstancedMesh>(null);

  const positions = useMemo(() => {
    const out: { x: number; z: number; ry: number }[] = [];
    const spacing = 2.2;

    // North and south runs.
    for (let x = HALL.minX; x <= HALL.maxX + 0.01; x += spacing) {
      // Leave the doorway clear.
      if (Math.abs(x - GATE.center.x) > GATE.width / 2 + 0.1) {
        out.push({ x, z: HALL.maxZ, ry: 0 });
      }
      out.push({ x, z: HALL.minZ, ry: 0 });
    }
    // East and west runs.
    for (let z = HALL.minZ; z <= HALL.maxZ + 0.01; z += spacing) {
      out.push({ x: HALL.minX, z, ry: Math.PI / 2 });
      out.push({ x: HALL.maxX, z, ry: Math.PI / 2 });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    positions.forEach((p, i) => {
      matrix.compose(
        new THREE.Vector3(p.x, ROOF_Y / 2, p.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.ry, 0)),
        new THREE.Vector3(1, 1, 1),
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, positions.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[0.09, ROOF_Y, 0.09]} />
      <meshStandardMaterial color={COLORS.mullion} roughness={0.6} metalness={0.15} />
    </instancedMesh>
  );
}

function Shell() {
  const halfGate = GATE.width / 2;
  const westWidth = GATE.center.x - halfGate - HALL.minX;
  const eastWidth = HALL.maxX - (GATE.center.x + halfGate);
  const lintel = ROOF_Y - GATE.height;

  return (
    <group>
      {/* North glazing sits at the alcove line; the alcoves themselves are solid. */}
      <Glass
        width={HALL_WIDTH}
        height={ROOF_Y}
        position={[0, ROOF_Y / 2, HALL.minZ]}
      />
      <Glass
        width={HALL_DEPTH}
        height={ROOF_Y}
        position={[HALL.minX, ROOF_Y / 2, (HALL.minZ + HALL.maxZ) / 2]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <Glass
        width={HALL_DEPTH}
        height={ROOF_Y}
        position={[HALL.maxX, ROOF_Y / 2, (HALL.minZ + HALL.maxZ) / 2]}
        rotation={[0, Math.PI / 2, 0]}
      />

      {/* South glazing, in three pieces around the doorway. */}
      <Glass
        width={westWidth}
        height={ROOF_Y}
        position={[HALL.minX + westWidth / 2, ROOF_Y / 2, HALL.maxZ]}
      />
      <Glass
        width={eastWidth}
        height={ROOF_Y}
        position={[HALL.maxX - eastWidth / 2, ROOF_Y / 2, HALL.maxZ]}
      />
      <Glass
        width={GATE.width}
        height={lintel}
        position={[GATE.center.x, GATE.height + lintel / 2, HALL.maxZ]}
      />

      <Mullions />

      {/* Glass roof with exposed beams. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, ROOF_Y, (HALL.minZ + HALL.maxZ) / 2]}>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
        <meshStandardMaterial
          color={COLORS.glass}
          transparent
          opacity={0.12}
          roughness={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const x = HALL.minX + ((i + 0.5) * HALL_WIDTH) / 9;
        return (
          <mesh key={i} position={[x, ROOF_Y - 0.12, (HALL.minZ + HALL.maxZ) / 2]}>
            <boxGeometry args={[0.14, 0.24, HALL_DEPTH]} />
            <meshStandardMaterial color={COLORS.mullion} roughness={0.6} metalness={0.15} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * The three recesses along the north wall.
 *
 * Solid, unlike the rest of the shell: they are the built-in end of the
 * pavilion, and the band sits in one of them.
 */
function Alcoves() {
  return (
    <group>
      {ALCOVES.map((alcove, i) => {
        const halfWidth = alcove.width / 2;
        const backZ = NORTH_WALL_Z - ALCOVE_DEPTH;
        return (
          <group key={i}>
            <mesh
              position={[alcove.center, ROOF_Y / 2, backZ]}
              rotation={[0, Math.PI, 0]}
            >
              <cylinderGeometry
                args={[halfWidth, halfWidth, ROOF_Y, 20, 1, true, -Math.PI / 2, Math.PI]}
              />
              <meshStandardMaterial
                color={COLORS.linen}
                roughness={0.9}
                side={THREE.BackSide}
              />
            </mesh>
            {[-1, 1].map((sign) => (
              <mesh
                key={sign}
                rotation={[0, sign * (Math.PI / 2), 0]}
                position={[
                  alcove.center + sign * halfWidth,
                  ROOF_Y / 2,
                  (backZ + NORTH_WALL_Z) / 2,
                ]}
              >
                <planeGeometry args={[ALCOVE_DEPTH, ROOF_Y]} />
                <meshStandardMaterial
                  color={COLORS.linen}
                  roughness={0.9}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Planting beyond the glass, which is most of what sells the building. */
function Garden() {
  const foliage = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);

  const plants = useMemo(() => {
    const out: { x: number; z: number; scale: number; tall: boolean }[] = [];
    let i = 0;
    const place = (x: number, z: number) => {
      const r = hashRandom(i++);
      const r2 = hashRandom(i++);
      out.push({
        x: x + (r - 0.5) * 2.4,
        z: z + (r2 - 0.5) * 2.4,
        scale: 0.7 + r * 0.9,
        tall: r2 > 0.55,
      });
    };

    // A loose border, kept clear of the approach path so the doors stay visible.
    for (let x = HALL.minX - 4; x <= HALL.maxX + 4; x += 3.4) {
      if (Math.abs(x - GATE.center.x) > 3.4) place(x, HALL.maxZ + 6.5);
      place(x, HALL.minZ - 4.5);
    }
    for (let z = HALL.minZ - 3; z <= HALL.maxZ + 3; z += 3.6) {
      place(HALL.minX - 4, z);
      place(HALL.maxX + 4, z);
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const canopy = foliage.current;
    const stems = trunks.current;
    if (!canopy || !stems) return;

    const matrix = new THREE.Matrix4();
    const colour = new THREE.Color();
    const light = new THREE.Color(COLORS.foliageLight);
    const dark = new THREE.Color(COLORS.foliage);

    plants.forEach((p, i) => {
      const height = p.tall ? 2.6 : 1.3;
      matrix.compose(
        new THREE.Vector3(p.x, height, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(p.scale, p.scale * (p.tall ? 1.25 : 1), p.scale),
      );
      canopy.setMatrixAt(i, matrix);
      colour.copy(hashRandom(i * 3.3) > 0.5 ? light : dark);
      canopy.setColorAt(i, colour);

      matrix.compose(
        new THREE.Vector3(p.x, height / 2, p.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, height, 1),
      );
      stems.setMatrixAt(i, matrix);
    });

    canopy.instanceMatrix.needsUpdate = true;
    stems.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  }, [plants]);

  return (
    <group>
      <instancedMesh
        ref={foliage}
        args={[undefined, undefined, plants.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={trunks}
        args={[undefined, undefined, plants.length]}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.09, 0.12, 1, 6]} />
        <meshStandardMaterial color={COLORS.trunk} roughness={1} />
      </instancedMesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

function Tables() {
  return (
    <group>
      {TABLES.map((table) => {
        // Floor-length linen: one solid volume from floor to table height reads
        // correctly and costs a single primitive.
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
              <meshStandardMaterial color={COLORS.linen} roughness={0.95} />
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
            <meshStandardMaterial color={COLORS.linen} roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
}

/** A place setting per seat, pulled in from the chair toward the table. */
function PlaceSettings() {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    ALL_SEATS.forEach((seat, i) => {
      const out = seatOutward(seat);
      // Sit the setting on the table side of the chair.
      matrix.compose(
        new THREE.Vector3(
          seat.x - out.x * 0.42,
          DIMS.tableHeight + 0.012,
          seat.z - out.z * 0.42,
        ),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, ALL_SEATS.length]}
      frustumCulled={false}
    >
      <cylinderGeometry args={[0.13, 0.13, 0.02, 12]} />
      <meshStandardMaterial color={COLORS.plate} roughness={0.35} metalness={0.05} />
    </instancedMesh>
  );
}

/** A low centrepiece and candle glow on each table. */
function Centrepieces() {
  return (
    <group>
      {TABLES.map((table) => (
        <group key={table.id} position={[table.center.x, DIMS.tableHeight, table.center.z]}>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.2, 12, 10]} />
            <meshStandardMaterial color={COLORS.foliageLight} roughness={1} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial
              color={COLORS.lamp}
              emissive={COLORS.lamp}
              emissiveIntensity={1.8}
              roughness={1}
            />
          </mesh>
        </group>
      ))}
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
      {/* Lambert, not standard: this is the one thing drawn 170 times, and
          fabric gains nothing from a specular term. */}
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
      {Object.entries(PROPS).map(([name, prop]) => (
        <mesh key={name} position={[prop.center.x, prop.height / 2, prop.center.z]}>
          {prop.shape === "round" ? (
            <cylinderGeometry args={[prop.width / 2, prop.width / 2, prop.height, 20]} />
          ) : (
            <boxGeometry args={[prop.width, prop.height, prop.depth]} />
          )}
          <meshStandardMaterial
            roughness={0.8}
            color={
              name === "bar"
                ? COLORS.bar
                : name === "band"
                  ? COLORS.band
                  : name === "cakeTable"
                    ? COLORS.linen
                    : COLORS.stage
            }
          />
        </mesh>
      ))}

      {/* The couple's table, standing on the stage. */}
      <mesh
        position={[
          BG_TABLE.center.x,
          BG_TABLE.baseHeight + DIMS.tableHeight / 2,
          BG_TABLE.center.z,
        ]}
      >
        <boxGeometry args={[BG_TABLE.width, DIMS.tableHeight, BG_TABLE.depth]} />
        <meshStandardMaterial color={COLORS.linen} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** The carpeted aisle, drawn flat on the floor. */
function Aisle() {
  const spine = AISLE.spine;
  const branch = AISLE.toStage;
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[
          (spine.minX + spine.maxX) / 2,
          0.012,
          (spine.minZ + spine.maxZ) / 2,
        ]}
      >
        <planeGeometry args={[spine.maxX - spine.minX, spine.maxZ - spine.minZ]} />
        <meshStandardMaterial color={COLORS.aisle} roughness={0.95} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[
          (branch.minX + branch.maxX) / 2,
          0.012,
          (branch.minZ + branch.maxZ) / 2,
        ]}
      >
        <planeGeometry args={[branch.maxX - branch.minX, branch.maxZ - branch.minZ]} />
        <meshStandardMaterial color={COLORS.aisle} roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Pendant lamps down the room. Emissive only — no extra real lights. */
function Pendants() {
  const rows = [-5, -2.1, 0.8];
  return (
    <group>
      {rows.flatMap((z) =>
        [-8, -4, 0, 4, 8].map((x) => (
          <group key={`${x}:${z}`} position={[x, 0, z]}>
            <mesh position={[0, 2.6, 0]}>
              <sphereGeometry args={[0.11, 10, 8]} />
              <meshStandardMaterial
                color={COLORS.lamp}
                emissive={COLORS.lamp}
                emissiveIntensity={2.2}
                roughness={1}
              />
            </mesh>
            <mesh position={[0, (ROOF_Y + 2.7) / 2, 0]}>
              <cylinderGeometry args={[0.006, 0.006, ROOF_Y - 2.7, 4]} />
              <meshStandardMaterial color={COLORS.mullion} roughness={0.7} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

export default function VenueScene({ highlight }: { highlight: Highlight }) {
  return (
    <group>
      {/* Warm haze, far enough out that the room stays crisp but the garden
          softens with distance. */}
      <fog attach="fog" args={["#e7ddc9", 26, 78]} />

      <Lighting />
      <Ground />
      <Garden />
      <Shell />
      <Alcoves />
      <Aisle />
      <Tables />
      <PlaceSettings />
      <Centrepieces />
      <Chairs highlight={highlight} />
      <Props3D />
      <Pendants />
    </group>
  );
}
