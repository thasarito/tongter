export interface JoystickSample { right:number; forward:number; knobX:number; knobY:number }
export const NEUTRAL_JOYSTICK:JoystickSample={right:0,forward:0,knobX:0,knobY:0};
/** Screen-pixel displacement to a radial, dead-zoned unit vector. Up means forward.
 * The knob never escapes its ring and diagonals never increase walking speed. */
export function sampleJoystick(dx:number,dy:number,radius:number,deadZone=.12):JoystickSample {
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return {...NEUTRAL_JOYSTICK};
  const length=Math.hypot(dx,dy);
  if(!length)return {...NEUTRAL_JOYSTICK};
  const dead=Number.isFinite(deadZone)?Math.min(.9,Math.max(0,deadZone)):.12;
  const distance=Math.min(length,radius),magnitude=Math.max(0,(distance/radius-dead)/(1-dead));
  // Canonical neutral axes avoid signed zero at the dead-zone boundary.
  return {right:magnitude?dx/length*magnitude:0,forward:magnitude?-dy/length*magnitude:0,knobX:dx/length*distance,knobY:dy/length*distance};
}
