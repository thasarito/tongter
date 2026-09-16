# Fullscreen, touch-first Glass House Studio

This follow-up starts at the main branch after PR #8 was merged. It changes studio presentation and camera input only. The sheet writer, conflict/retry protocol, authentication, invitation tokens, and live guest data are unchanged.

## Layout

The Canvas and SVG stage occupy the entire available browser viewport (`100dvh`). Floating controls do not reserve a sidebar/header strip or resize the camera when the guest sheet opens. This is viewport fullscreen, not a requirement to enter the browser Fullscreen API; mobile browser bars remain under browser control.

The top bar switches Floor plan / 3D model / Walk inside and retains Undo, Redo, names and CSV/print exports. The source/saving status remains visible, including Retry save. The bottom dock has Layout, Guests, Selected and Layers. It opens a modeless overlay panel: a left sheet on desktop, a thumb-reachable bottom sheet on a phone. Close it with its close button, the active dock button, or Escape. Closed panels are hidden from keyboard navigation. Guest search state is retained while the same panel is merely collapsed.

Safe-area insets protect controls from display cutouts and home indicators. Tool content has its own native vertical scroll. The document behind the studio is locked and its inline styles and previous page position are restored on route exit. The scene itself uses `touch-action: none`, so a drag rotates/looks rather than scrolling the page. Existing guest grips still move guests; empty scene space controls the camera.

## Guest names

Names remain centered directly over the associated seat with no visible seat number. On narrow screens labels use bounded screen pixels, rather than becoming tiny at an overview distance or enormous near the camera. Names wrap to two visual lines; the full name remains in the accessible label, title and seat editor. Dense arrangements still benefit from zooming or opening a specific seat. In Walk mode the labels are non-interactive and pass look gestures through to the scene; switch back to the model or plan to edit seating.

## Joystick

Walk inside has an on-screen analogue thumb joystick, replacing the directional button pad. Drag from the center to choose direction, including diagonals. Deflection controls speed with a radial dead zone and a bounded unit vector. Hold the stick with one finger and drag the scene with another to look. The existing keyboard WASD/arrows, Shift pace, optional mouse capture, acceleration/deceleration and approximate room boundary remain.

Release removes the joystick input. Pointer cancellation, lost capture, blur, hidden documents, resize, modal/panel opening and unmount cannot leave movement stuck. Opening a tools panel pauses walking. Walk settings contains pace, reset, and desktop mouse-look controls. Normal pan/orbit remains available on the uncovered part of the scene while a modeless sheet is open.

## Components

- `state/StudioChrome.tsx`: ephemeral panel state and scoped document-scroll lifecycle.
- `components/StudioDock.tsx`: four persistent, labelled tool-panel controls.
- `styles/immersive.css`: overlay layout, safe areas, portrait/landscape and responsive badges.
- `scene/joystick.ts`: pure radial normalization and dead-zone mapping.
- `scene/WalkJoystick.tsx`: pointer capture, thumb feedback and cleanup.
- `scene/WalkController.tsx`: camera input arbitration and pause behavior.

Tests use synthetic guest data. Existing autosave/conflict/browser regressions remain enabled. New tests cover viewport bounds, scene gestures, independent panel scrolling, responsive labels, touch walking with simultaneous looking, cancellation and route-exit style restoration. The normal CI workflow decides the current verified/deployed state; this document is not a claim that an unfinished build passed.
