import { EYE_HEIGHT, GOAL_STANDOFF, SEAT_LOOK_HEIGHT } from "./walk-path.ts";

/**
 * The maths behind looking around from your chair.
 *
 * Pure and free of three.js so it can be asserted headlessly. That matters
 * here more than most places: this logic previously lived inside a `useFrame`,
 * where nothing could check it, and it shipped with the entire reachable range
 * sitting *below* the horizon — a guest could see the floor and the tablecloth
 * and nothing else. It read fine in review. Only arithmetic catches that.
 */

const deg = (d: number) => (d * Math.PI) / 180;

/**
 * How steeply the camera is looking when it arrives.
 *
 * Derived rather than written down: it falls out of where the walk stops and
 * what it aims at, so if that geometry moves, this and every check follow.
 * Negative means looking down.
 */
export const ARRIVAL_PITCH = -Math.atan2(
  EYE_HEIGHT - SEAT_LOOK_HEIGHT,
  GOAL_STANDOFF,
);

export const LOOK = {
  /**
   * The horizon is the floor of the range. Guests should be looking at the
   * room — the stage, the band, the glass roof, the garden — not at the
   * carpet. Raising this above 0 would also hide their own table setting.
   */
  pitchMin: 0,
  pitchMax: deg(25),
  /**
   * Past about this much either way you are looking through the back of your
   * own chair, which reads as a bug rather than as freedom.
   */
  yawLimit: deg(130),
  /** Radians per pixel dragged. */
  sensitivity: 0.0032,
  /** Higher is snappier; an exponential-approach rate, not a duration. */
  smoothing: 12,
} as const;

/**
 * Sitting down, then looking up.
 *
 * The arrival framing is the payoff — it is the moment the guest sees their own
 * chair, with their name on screen — so it is held before the gaze rises. The
 * lift then carries them to the horizon, which is where the interesting half of
 * the room is.
 */
export const SETTLE = {
  holdMs: 700,
  liftMs: 900,
} as const;

export const SETTLE_MS = SETTLE.holdMs + SETTLE.liftMs;

function smoothstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

/** 0 while held on the chair, easing to 1 as the gaze reaches the horizon. */
export function settleProgress(sinceActiveMs: number): number {
  if (sinceActiveMs <= SETTLE.holdMs) return 0;
  return smoothstep((sinceActiveMs - SETTLE.holdMs) / SETTLE.liftMs);
}

/**
 * The pitch the view rests at, before any drag is added.
 *
 * Starts at the arrival angle and eases to the horizon. Everything the guest
 * does is measured from here, so once settled, "no drag" means "level".
 */
export function basePitchAt(sinceActiveMs: number, arrivalPitch = ARRIVAL_PITCH): number {
  return arrivalPitch * (1 - settleProgress(sinceActiveMs));
}

export interface LookOffset {
  /** Radians left of the arrival heading; positive turns left. */
  yaw: number;
  /** Radians above the horizon; never negative. */
  pitch: number;
}

/**
 * Folds a drag into the current offset and clamps it.
 *
 * **Direct manipulation**: the room follows the finger, as it does in every
 * photo-sphere viewer on a phone. Dragging right sends the room right, which
 * means turning the view left — hence adding to yaw, since a larger Y euler
 * rotates anticlockwise seen from above. Dragging down brings the room down,
 * which means looking up.
 *
 * Clamping on accumulation rather than on use is deliberate: otherwise a long
 * drag past a limit banks up an invisible surplus the guest has to unwind
 * before the view responds again.
 */
export function applyDrag(current: LookOffset, dx: number, dy: number): LookOffset {
  return {
    yaw: clamp(
      current.yaw + dx * LOOK.sensitivity,
      -LOOK.yawLimit,
      LOOK.yawLimit,
    ),
    pitch: clamp(
      current.pitch + dy * LOOK.sensitivity,
      LOOK.pitchMin,
      LOOK.pitchMax,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Frame-rate independent exponential approach toward a target. */
export function ease(current: number, target: number, deltaSeconds: number): number {
  const t = 1 - Math.exp(-LOOK.smoothing * Math.min(deltaSeconds, 0.05));
  return current + (target - current) * t;
}
