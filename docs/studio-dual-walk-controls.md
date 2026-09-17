# Dual walk controls

Walk inside uses two independently captured thumb controls: **MOVE** at the left for forward/backward/strafe, **LOOK** at the right for horizontal/vertical looking. Greater deflection gives greater speed; a dead zone prevents center drift. Hold either stick to continue; release it to stop that channel without cancelling the other stick or held keyboard keys.

The old Walk settings disclosure, pace selector and Mouse look button are removed. The normal walking pace remains the default. Keyboard WASD/arrows, Shift, and dragging the scene to look still work. Reset position stays in the View panel.

`WalkJoystick` is shared by both controls, with unique input and accessible-help IDs. Non-primary touch pointers are accepted. `WalkMotion` owns separate movement/look channels and integrates angular input in the existing frame update, waking the demand renderer while active and returning to idle after release. No additional animation loop or dependency is used.

Both controls stay above the measured bottom dock, including in short landscape viewports, and account for horizontal safe areas. Opening planning tools, a guest modal or a sheet confirmation hides and disables both. Escape, window blur/resize, hidden documents and unmount clean up input; a single-pointer cancel only releases that stick.

## Verification

- `pnpm lint && pnpm check` includes motion direction, proportionality, pitch limits, frame-rate comparison, independent release, keyboard preservation, interruption and render-idle unit checks.
- `pnpm test:e2e` includes real WebGL and mouse/touch controls, simultaneous touches and either release order, 320/390/844 viewport bounds, no Walk settings, and no seating writes. Desktop intentionally skips the simultaneous-touch-only scenario; mobile executes it.
- The touch test explicitly selects Chromium's direct WebTouch input path. In that path a nonempty `touchEnd` identifies ended contacts, not the contacts that remain; an empty end releases all.
- All gesture tests use synthetic intercepted sheet data. The existing deployed preview verification reads live data and performs its no-op writer probe. Deliberate administrator edits in a preview still save to live Studio sheet tabs.
