# Bottom navigation and mobile drag focus

Follow-up to the merged fullscreen studio. The upper title/toolbar, mode row, sheet banner and canvas export buttons are removed, not duplicated or simply hidden. One bottom dock holds Layout, Guests, View, Selected and More. Normal save status is compact; errors and Retry save stay in the dock. Dock height is measured so an expanded error does not cover the tool sheet.

View contains Floor plan / 3D model / Walk inside, zoom and fit. More contains undo/redo, guest names, sheet details/reload, CSV/print/SVG/PNG tools, layers and back navigation. A typed, view-local command registry connects these controls to the mounted SVG/R3F renderer without recreating a camera or changing seating. The browser's top/address bars are outside the application's control.

On a narrow screen (or touch landscape), crossing the existing six-pixel guest-drag threshold fades the open tools panel, dock and toast. The seating plan is not faded. All faded UI descendants become hit-test transparent before destination picking, so a seat previously beneath the guest sheet can receive a drop. Opacity changes never remove the captured grip or reset panel state. The source stays mounted, its search/filter/scroll are preserved, and the same panel returns after drop or cancellation.

A tap, ordinary list scroll, furniture drag or scene pan does not enter guest-drag focus. Drags inside a modal keep that modal's own seat targets and do not fade the page through it. Pointer cancel, lost capture, Escape, blur, resize and unmount clear focus safely. Mobile focus does not edge-scroll the invisible panel. Reduced-motion preferences remove the fade transition. Valid/invalid seat highlights and the bounded dragged-name tooltip are unchanged.

Exact seats, seat swaps, capacity checks, reserve safeguards, guarded Google Sheets autosave, conflict detection, retry receipts and shared undo remain the existing data operations. No server, secret, invitation, RSVP, sheet-layout or private guest-data changes are part of this UI refactor. The preview uses live sheet data; all state-changing regression tests must use synthetic intercepted data only.

The existing walking joystick remains on screen in Walk mode and is paused while a tool sheet is open. Opening View and returning to the same mode simply dismisses the sheet; it does not reconstruct the scene. Fullscreen still means the available browser viewport, not a requirement to invoke the browser Fullscreen API.
