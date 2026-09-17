import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { NEUTRAL_JOYSTICK, sampleJoystick } from "./joystick";
import type { WalkMotion } from "./walk-motion";
import "../styles/walk-controls.css";

type JoystickMode = "move" | "look";
/** Each stick owns one pointer and one input channel, including non-primary touches. */
export function WalkJoystick({ motion, mode = "move", disabled = false }: { motion: WalkMotion; mode?: JoystickMode; disabled?: boolean }) {
  const base = useRef<HTMLDivElement>(null), pointer = useRef<number | null>(null), id = useId();
  const input = `joystick:${id}`, helpId = `${id}-help`;
  const [thumb, setThumb] = useState(NEUTRAL_JOYSTICK), [active, setActive] = useState(false);
  const releaseInput = useCallback(() => {
    if (mode === "look") motion.releaseLook(input);
    else motion.release(input, true);
  }, [motion, mode, input]);
  const release = useCallback(() => {
    const captured = pointer.current;
    pointer.current = null;
    releaseInput();
    setThumb(NEUTRAL_JOYSTICK); setActive(false);
    if (captured !== null && base.current?.hasPointerCapture(captured)) base.current.releasePointerCapture(captured);
  }, [releaseInput]);
  // Global interruptions clear both channels; an ordinary release/cancel clears
  // only this stick. Losing one finger must not stop the other thumb or keyboard.
  const stop = useCallback(() => { release(); motion.stop(); }, [motion, release]);
  useEffect(() => { if (disabled) stop(); }, [disabled, stop]);
  useEffect(() => {
    const element = base.current;
    const visibility = () => { if (document.hidden) stop(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") stop(); };
    window.addEventListener("blur", stop); window.addEventListener("resize", stop);
    document.addEventListener("visibilitychange", visibility); document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("blur", stop); window.removeEventListener("resize", stop);
      document.removeEventListener("visibilitychange", visibility); document.removeEventListener("keydown", escape);
      const captured = pointer.current;
      pointer.current = null;
      releaseInput();
      if (captured !== null && element?.hasPointerCapture(captured)) element.releasePointerCapture(captured);
    };
  }, [stop, releaseInput]);
  function sample(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect(), radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2 - 25);
    const value = sampleJoystick(event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2, radius);
    if (mode === "look") motion.setLookAnalog(input, value.right, value.forward);
    else motion.setAnalog(input, value.right, value.forward);
    setThumb(value);
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !motion.enabled || pointer.current !== null || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
    pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
    setActive(true); sample(event);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); sample(event);
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); release();
  }
  function cancel(event: PointerEvent<HTMLDivElement>) { if (pointer.current === event.pointerId) release(); }
  return <div className="studio-joystick-wrap" data-mode={mode} hidden={disabled} data-studio-ui>
    <div ref={base} className="studio-joystick" role="group" aria-label={mode === "look" ? "Look joystick" : "Walk joystick"} aria-describedby={helpId} tabIndex={0} data-active={active}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onContextMenu={event => event.preventDefault()}>
      <span className="studio-joystick-knob" aria-hidden="true" style={{ transform: `translate(${thumb.knobX}px,${thumb.knobY}px)` }} />
    </div>
    <small>{mode === "look" ? "LOOK" : "MOVE"}</small>
    <span id={helpId} className="studio-joystick-help">{mode === "look"
      ? "Drag right or left to turn, up or down to look vertically. Hold farther from the center to look faster. Release to stop looking. The left stick can keep moving at the same time."
      : "Drag to walk forward, backward or sideways. Push farther to move faster. Release to stop. Use the right stick to look at the same time. Keyboard: W A S D or arrow keys; Shift for a faster pace."}</span>
  </div>;
}
