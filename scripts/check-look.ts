/**
 * Verifies the seated look-around. Run: pnpm check:look
 *
 * This suite exists because of a specific failure: the look-around shipped with
 * its entire reachable range *below* the horizon, so a guest could see the
 * carpet and the tablecloth and nothing of the room. It read correctly in
 * review. Only arithmetic catches it, and arithmetic needs the maths out of the
 * render loop — which is what lib/seated-look is for.
 */
import {
  ARRIVAL_PITCH,
  LOOK,
  SETTLE,
  SETTLE_MS,
  applyDrag,
  basePitchAt,
  ease,
  settleProgress,
} from "../src/shared/seated-look.ts";
import { EYE_HEIGHT, GOAL_STANDOFF, SEAT_LOOK_HEIGHT } from "../src/shared/walk-path.ts";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "FAIL  "} ${label}${detail ? ` — ${detail}` : ""}`);
}

const deg = (rad: number) => (rad * 180) / Math.PI;

// ---------------------------------------------------------------------------
console.log("\n--- arrival framing ---");

check("arrival pitch is derived from the walk geometry, not hard-coded",
  Math.abs(ARRIVAL_PITCH + Math.atan2(EYE_HEIGHT - SEAT_LOOK_HEIGHT, GOAL_STANDOFF)) < 1e-12,
  `${deg(ARRIVAL_PITCH).toFixed(1)}° (eye ${EYE_HEIGHT}, seat ${SEAT_LOOK_HEIGHT}, standoff ${GOAL_STANDOFF})`);
check("the camera arrives looking down at the chair", ARRIVAL_PITCH < 0);

// ---------------------------------------------------------------------------
console.log("\n--- the bug that shipped: is the room reachable? ---");
{
  // Furthest up a guest can get, once settled and dragging as far as allowed.
  const highest = basePitchAt(SETTLE_MS) + LOOK.pitchMax;
  const lowest = basePitchAt(SETTLE_MS) + LOOK.pitchMin;

  check("the horizon is reachable", highest >= 0,
    `highest reachable ${deg(highest).toFixed(1)}°`);
  check("the view can rise above the horizon", highest > 0,
    `${deg(highest).toFixed(1)}° above`);
  check("the view can never drop below the horizon", lowest >= 0,
    `lowest reachable ${deg(lowest).toFixed(1)}°`);
  // The old build could only reach 11.1° below horizontal; assert we are well clear.
  check("the upward range is usable", deg(highest) >= 15,
    `${deg(highest).toFixed(1)}° of headroom`);
}

// ---------------------------------------------------------------------------
console.log("\n--- the gaze lift ---");
{
  check("held on the chair at first", settleProgress(0) === 0);
  check("still held just before the lift", settleProgress(SETTLE.holdMs) === 0);
  check("fully lifted by the end", Math.abs(settleProgress(SETTLE_MS) - 1) < 1e-9);
  check("stays lifted afterwards", settleProgress(SETTLE_MS * 4) === 1);

  check("starts at exactly the arrival pitch",
    Math.abs(basePitchAt(0) - ARRIVAL_PITCH) < 1e-12);
  check("ends at exactly the horizon", Math.abs(basePitchAt(SETTLE_MS)) < 1e-12,
    `${deg(basePitchAt(SETTLE_MS)).toExponential(1)}°`);

  // A jump here would read as the head snapping up rather than lifting.
  const STEPS = 4000;
  let previous = basePitchAt(0);
  let biggestStep = 0;
  let backwards = 0;
  for (let i = 1; i <= STEPS; i++) {
    const value = basePitchAt((i / STEPS) * SETTLE_MS);
    const step = value - previous;
    if (step < -1e-12) backwards += 1;
    biggestStep = Math.max(biggestStep, Math.abs(step));
    previous = value;
  }
  check("rises without ever dipping", backwards === 0, `${backwards} reversals`);
  check("no jump in the lift", deg(biggestStep) < 0.2,
    `largest step ${deg(biggestStep).toFixed(4)}°`);

  check("the whole beat is under two seconds", SETTLE_MS <= 2000,
    `${(SETTLE_MS / 1000).toFixed(1)} s`);
}

// ---------------------------------------------------------------------------
console.log("\n--- drag direction (direct manipulation) ---");
{
  const zero = { yaw: 0, pitch: 0 };
  // Room follows the finger: drag right, the view turns left, which is a larger
  // Y euler. These two assertions are the whole of the reversal.
  check("dragging right turns the view left", applyDrag(zero, 100, 0).yaw > 0);
  check("dragging left turns the view right", applyDrag(zero, -100, 0).yaw < 0);
  check("dragging down looks up", applyDrag(zero, 0, 100).pitch > 0);
  check("dragging up looks back down", applyDrag({ yaw: 0, pitch: LOOK.pitchMax }, 0, -100).pitch < LOOK.pitchMax);
  check("no drag changes nothing", (() => {
    const r = applyDrag({ yaw: 0.3, pitch: 0.2 }, 0, 0);
    return r.yaw === 0.3 && r.pitch === 0.2;
  })());
}

// ---------------------------------------------------------------------------
console.log("\n--- clamping ---");
{
  // Drag far past every limit, in small steps, as a real gesture would.
  let offset = { yaw: 0, pitch: 0 };
  for (let i = 0; i < 500; i++) offset = applyDrag(offset, 40, 40);
  check("yaw stops at its limit", Math.abs(offset.yaw - LOOK.yawLimit) < 1e-9,
    `${deg(offset.yaw).toFixed(1)}°`);
  check("pitch stops at its ceiling", Math.abs(offset.pitch - LOOK.pitchMax) < 1e-9,
    `${deg(offset.pitch).toFixed(1)}°`);

  // The surplus must not bank up: one small drag back has to respond at once.
  const back = applyDrag(offset, -40, -40);
  check("dragging back responds immediately, with no banked surplus",
    back.yaw < offset.yaw && back.pitch < offset.pitch);

  let negative = { yaw: 0, pitch: 0 };
  for (let i = 0; i < 500; i++) negative = applyDrag(negative, -40, -40);
  check("yaw stops at its other limit", Math.abs(negative.yaw + LOOK.yawLimit) < 1e-9);
  check("pitch never goes below the horizon", negative.pitch >= LOOK.pitchMin,
    `${deg(negative.pitch).toFixed(1)}°`);

  check("looking behind is not possible", deg(LOOK.yawLimit) < 180,
    `±${deg(LOOK.yawLimit).toFixed(0)}°`);
}

// ---------------------------------------------------------------------------
console.log("\n--- easing ---");
{
  // Frame-rate independence: the same elapsed time must land in the same place
  // whether it arrives as a few long frames or many short ones.
  const converge = (frames: number, seconds: number) => {
    let v = 0;
    for (let i = 0; i < frames; i++) v = ease(v, 1, seconds / frames);
    return v;
  };
  const slow = converge(6, 0.3);
  const fast = converge(60, 0.3);
  check("frame rate barely changes the result", Math.abs(slow - fast) < 0.05,
    `6 fps ${slow.toFixed(3)} vs 200 fps ${fast.toFixed(3)}`);
  check("easing approaches the target", converge(120, 2) > 0.99);
  check("easing never overshoots", converge(120, 2) <= 1);
  // A long stall must not teleport the view.
  check("a stalled frame is clamped", ease(0, 1, 5) < 0.5, ease(0, 1, 5).toFixed(3));
}

console.log(
  failures === 0
    ? "\nAll look-around checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
