import { describe, expect, it, vi } from "vitest";
import { WalkMotion } from "./walk-motion";

const advance = (motion: WalkMotion, seconds = 1, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) motion.update(1 / fps);
};

describe("independent move and look joysticks", () => {
  it("turns right and looks up without translating the camera", () => {
    const motion = new WalkMotion(() => true), { x, z, yaw, pitch } = motion;
    motion.setLookAnalog("look", 1, 1);
    advance(motion);
    expect(motion.yaw).toBeLessThan(yaw);
    expect(motion.pitch).toBeGreaterThan(pitch);
    expect([motion.x, motion.z]).toEqual([x, z]);
  });
  it("keeps turning while held, even without more pointer events", () => {
    const motion = new WalkMotion(() => true);
    motion.setLookAnalog("look", 1, 0);
    advance(motion); const yaw = motion.yaw;
    advance(motion);
    expect(motion.yaw).toBeLessThan(yaw - 1);
    expect(motion.moving).toBe(true);
  });
  it("uses proportional look speed with a bounded diagonal magnitude", () => {
    const slow = new WalkMotion(() => true), fast = new WalkMotion(() => true), diagonal = new WalkMotion(() => true);
    slow.setLookAnalog("look", .25, 0); fast.setLookAnalog("look", 1, 0); diagonal.setLookAnalog("look", 100, 100);
    advance(slow); advance(fast); advance(diagonal);
    expect(Math.PI / 2 - fast.yaw).toBeCloseTo((Math.PI / 2 - slow.yaw) * 4, 5);
    const vector = diagonal.lookHeld.get("look")!;
    expect(Math.hypot(...vector)).toBeCloseTo(1);
  });
  it("looks at the same time-based rate at 30 and 144 frames per second", () => {
    const a = new WalkMotion(() => true), b = new WalkMotion(() => true);
    a.setLookAnalog("look", .6, .2); b.setLookAnalog("look", .6, .2);
    advance(a, 2, 30); advance(b, 2, 144);
    expect(a.yaw).toBeCloseTo(b.yaw, 2); expect(a.pitch).toBeCloseTo(b.pitch, 2);
    expect(a.targetYaw).toBeCloseTo(b.targetYaw, 10);
  });
  it("clamps pitch without banking excess input at either limit", () => {
    const motion = new WalkMotion(() => true);
    motion.setLookAnalog("look", 0, 1); advance(motion, 4);
    expect(motion.targetPitch).toBe(1.15); expect(motion.pitch).toBeLessThanOrEqual(1.15);
    motion.setLookAnalog("look", 0, -1); motion.update(.04);
    expect(motion.targetPitch).toBeLessThan(1.15);
    advance(motion, 4); expect(motion.targetPitch).toBe(-1.05);
    motion.setLookAnalog("look", 0, 1); motion.update(.04);
    expect(motion.targetPitch).toBeGreaterThan(-1.05);
  });
  it("releasing look stops rotation immediately but preserves movement and keys", () => {
    const motion = new WalkMotion(() => true);
    motion.press("key:KeyW", "forward"); motion.setAnalog("move", .4, .5); motion.setLookAnalog("look", 1, .1);
    advance(motion, .5); motion.releaseLook("look");
    const { x, z, yaw, pitch } = motion;
    advance(motion, .5);
    expect([motion.yaw, motion.pitch]).toEqual([yaw, pitch]);
    expect([motion.x, motion.z]).not.toEqual([x, z]);
    expect([...motion.held.keys()]).toEqual(["key:KeyW", "move"]);
  });
  it("releasing movement immediately leaves the look stick active", () => {
    const motion = new WalkMotion(() => true);
    motion.setAnalog("move", 0, 1); motion.setLookAnalog("look", 1, 0);
    advance(motion, .5); motion.release("move", true);
    const { x, z, yaw } = motion;
    advance(motion, .5);
    expect([motion.x, motion.z]).toEqual([x, z]);
    expect(motion.yaw).toBeLessThan(yaw); expect(motion.lookHeld.has("look")).toBe(true);
  });
  it("does not drop keyboard input when a movement pointer is cancelled", () => {
    const motion = new WalkMotion(() => true);
    motion.press("key:KeyW", "forward"); motion.setAnalog("move", 1, 0);
    motion.release("move", true); advance(motion);
    expect([...motion.held.keys()]).toEqual(["key:KeyW"]); expect(motion.x).toBeGreaterThan(-11.2);
  });
  it("ignores neutral, disabled and nonfinite look input", () => {
    const motion = new WalkMotion(() => true);
    for (const [right, up] of [[0, 0], [NaN, 1], [1, Infinity], [Number.MAX_VALUE, Number.MAX_VALUE]]) {
      motion.setLookAnalog("look", right, up); expect(motion.lookHeld.size).toBe(0);
    }
    motion.enabled = false; motion.setLookAnalog("look", 1, 1);
    expect(motion.lookHeld.size).toBe(0); expect(motion.moving).toBe(false);
  });
  it("stop and reset clear both input channels and do not resume old gestures", () => {
    const motion = new WalkMotion(() => true);
    motion.setAnalog("move", 1, 1); motion.setLookAnalog("look", 1, 1); advance(motion);
    motion.stop(); const pose = [motion.x, motion.z, motion.yaw, motion.pitch]; advance(motion);
    expect([motion.x, motion.z, motion.yaw, motion.pitch]).toEqual(pose);
    expect(motion.held.size + motion.lookHeld.size).toBe(0); expect(motion.moving).toBe(false);
    motion.setLookAnalog("look", 1, 0); motion.reset();
    expect(motion.lookHeld.size).toBe(0); expect(motion.yaw).toBe(Math.PI / 2); expect(motion.pitch).toBe(.035);
  });
  it("wakes demand rendering for look input and becomes idle on release", () => {
    const motion = new WalkMotion(() => true), wake = vi.fn();
    const unsubscribe = motion.subscribe(wake);
    motion.setLookAnalog("look", .5, 0); expect(wake).toHaveBeenCalledOnce();
    advance(motion); motion.releaseLook("look"); expect(wake).toHaveBeenCalledTimes(2);
    expect(motion.moving).toBe(false);
    motion.stop(); motion.setLookAnalog("look", 0, 0); expect(wake).toHaveBeenCalledTimes(2);
    unsubscribe(); motion.setLookAnalog("look", 1, 0); expect(wake).toHaveBeenCalledTimes(2);
  });
});
