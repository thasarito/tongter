# Native React Glass House Studio

## Entry point and migration

Open `/admin/studio` from the admin dashboard. The editor uses the existing signed administrator session. The React route and its Three.js scene are independently lazy-loaded; there is no iframe, injected script bundle or window-global seating state.

Export **Layout JSON** from the latest standalone v3/v4/v5 HTML, then use **Files → Import standalone / studio layout JSON** here. Format version 3 carries the full guest roster, exact seat numbers, furniture and original-source references. Legacy version 2 per-table name arrays are also supported, including empty-seat gaps. Invalid/duplicate assignments fail without partial writes.

The public repository contains the twenty-table venue geometry and synthetic tests, **not the private reception roster**. New drafts start without guests. Local storage uses `tongter:glass-house-react:v1`; JSON is the durable backup when changing browsers or moving from the earlier standalone/iframe copy.

This PR is the native alternative to iframe PR #7. Do not merge both route implementations.

## Administrator password

The current explicitly requested preview password is verified against `ADMIN_PASSPHRASE_HASH` in the Worker configuration. The stored verifier uses PBKDF2-SHA-256, a 16-byte salt, 100,000 iterations and a 32-byte result. The browser sends the entered password to the server over HTTPS; it never receives a verifier as a substitute login token.

A nonempty `ADMIN_PASSPHRASE_HASH` takes precedence over `ADMIN_PASSPHRASE`. A malformed hash fails closed rather than falling back to the old password. Existing development environments that configure only the plaintext binding remain compatible. Unit tests cover valid/invalid passwords, hash replay, precedence and missing signing secrets.

`ADMIN_SESSION_SECRET` remains a separate **private Cloudflare secret**. A missing signing key cannot issue a session. Login cookies remain HttpOnly, Secure and SameSite=Lax. The public verifier must never be reused as a signing key.

**The selected three-digit password is weak even when hashed.** Before allowing sensitive live guest data or production use, replace it with a strong password and a newly generated salted verifier. Do not put a plaintext password or signing secret into client code or a public configuration file. The test environment retains its own synthetic password and signing key.

## Component map

```text
routes/AdminStudioRoute.tsx         signed-session guard and sign-in
studio/GlassHouseStudio.tsx         providers, lazy scene, modal composition
  state/StudioProvider.tsx          authoritative layout, history and autosave
  interaction/GuestDragProvider.tsx mouse/touch/pen gestures and exact-seat drops
  components/
    StudioToolbar.tsx              views, JSON backup, guest file import/export
    StudioSidebar.tsx              layers, table palette, spatial diagnostics
    GuestRoster.tsx                search/filter, source groups, bulk assignment
    GuestForm.tsx                  names, RSVP, dietary/notes, flags and seating
    SeatEditor.tsx                 exact-seat selection, swap/replace and roster
    ObjectInspector.tsx            size, position, rotation, locks and deletion
    ImportDialog.tsx               merge/replace preview against current state
    Modal.tsx                      native dialog lifecycle
  plan/
    FloorPlan.tsx                  declarative SVG and image export
    PlanFurniture.tsx              table/zone geometry and selectable chairs
    GuestNameLabels.tsx            name-only badges centered on assigned seats
    usePlanCamera.ts               pan, pinch, zoom and furniture dragging
  scene/
    VenueScene.tsx                 R3F Canvas, lighting and walk controls
    VenueShell.tsx                 floor, glazing, barrel vault, ribs and garden
    BanquetTable.tsx               cloths, instanced chairs and occupancy colors
    EventZone.tsx                  stage, aisle, band, bar, buffet and dance floor
    InstancedBoxes.tsx             batched geometry and instance-seat mapping
    SceneControls.tsx              drei OrbitControls, ray picking and shadows
    WalkController.tsx             camera frame loop and keyboard/touch lifecycle
    walk-motion.ts                 pure time-based movement and boundary sliding
    SeatLabels.tsx                 centered drei Html names above real chairs
    SceneErrorBoundary.tsx         safe return to the SVG editor on WebGL failure
  model/
    schema.ts                      validated layout/guest types and normalization
    geometry.ts                    shared metre-space venue and chair geometry
    defaults.ts                    venue geometry only; no private roster
    commands.ts                    atomic moves, swaps, replacement and grouping
    labels.ts                      full-name wrapping and exact seat anchors
    exchange.ts                    legacy/current imports and reversible safe CSV
    printing.tsx                   SVG/PNG and escaped printable seating HTML
```

React, fiber, drei and three use the repository's existing dependency versions. SVG and R3F read the same `StudioLayout`, so a seat change cannot create separate 2D/3D seating records.

## Name labels and seating

**Current design:** assigned guest labels sit directly on their chairs and show the full guest name only. There are no visible seat-number prefixes, leader lines, fanned side columns or distant overflow rails. The detailed SVG map paints labels above the chair geometry; the 3D view uses camera-facing `Html` anchored immediately above each occupied chair. Long names wrap.

Exact seat numbers still exist in import/export data, accessibility labels, empty-seat controls and the detailed roster. They are needed to preserve assignments and distinguish duplicate guest names. An occupied chair's visible number is suppressed while its guest name is shown. Use the Names toggle to show/hide the overlay without changing assignments.

Fixed on-seat positioning intentionally supersedes the earlier collision-avoiding callout layout. A dense whole-room view can have crowded names: zoom or open a table to read them, rather than moving labels away from their seats.

- Drag a chair or name to move one person; a roster grip can move a bulk selection.
- Drop on a table for the next free seat, or on a specific chair for its exact seat.
- A seated guest dropped onto an occupied seat swaps both exact assignments.
- An unassigned guest cannot silently displace an occupant. Use confirmed replacement in the seat editor; the previous occupant returns to Unassigned and is not deleted.
- Reserve/declined guests must be activated first. Geometry locks do not lock the guest list.
- Group moves/distribution are atomic; over-capacity and invalid operations leave prior assignments unchanged.
- Deleting a table unassigns its occupants. Guest and geometry changes share Undo/Redo.

## Geometry and walking

The reference datum remains 27.20 × 11.25 m with three curved bays. Roof details, 3.5 m eaves, 7.5 m ridge and furniture spacing are interpreted, not survey-grade. Spatial warnings are not venue capacity, accessibility or fire-egress approval.

Walking is frame-time based, with acceleration/deceleration, normalized diagonals, capped long frames, drag-to-look, optional pointer capture, Shift pace and a touch direction pad. Eye height is 1.67 m without head bob. Window blur, hidden documents, dialogs, text entry and view changes stop held movement. Boundary checks use the approximate venue footprint, not furniture collision or real accessibility clearances.

## Site-roster boundary

`GET /api/admin/studio/guests` requires the existing signed-cookie middleware and returns `Cache-Control: no-store`. Its DTO allowlists names, side/group, RSVP state, dietary text and original table/seat references. Invitation tokens, group tokens and RSVP messages are excluded.

Site import is an explicit preview. The DTO omits current `tableId`/`seatNumber`, so merging an updated RSVP or name preserves a deliberate draft placement. Live site's ten-table seats remain source references, never guessed into the twenty-table studio draft. There is **no studio publish/write endpoint to Google Sheets**.

## Files and native-app differences

- **Save JSON** backs up the complete editable project.
- Guest CSV/JSON merges by stable ID or replaces the roster without moving furniture. Whole-layout replacement has separate confirmation.
- In CSV, populated `table_id` is canonical; `table` is the label fallback. Edit consistently, or remove the ID column to use labels. Clear both current table references plus seat to unassign. Source columns are historical references, not assignment commands.
- Formula-like CSV text uses the reversible `apostrophe-v1` marker; JSON is the preferred lossless interchange.
- SVG/PNG and printable seating HTML remain available. Printable HTML is a seating list, not a second interactive copy of the React app.
- This change does not add service-worker caching or first-load offline routing. Once loaded, guest editing and the SVG plan do not need live Sheets requests.

All exported project files and images containing names are private guest information and should be shared accordingly.

## CI and deployment

The user explicitly enabled CI and PR deployment for this update. The earlier review-only / `[skip ci]` constraint is superseded. New commits run the normal **Verify and deploy** workflow: lint, TypeScript, unit/model tests, venue/logic/view/walk/look checks, production build, and Playwright browser tests.

New browser coverage exercises the authenticated studio, synthetic layout import, seat-centered name labels, pointer/touch swaps, undo, persistence, and the real R3F scene. The password verifier has route-level tests independent of the legacy development credential.

Cloudflare **PR preview** uploads remain gated on successful verification. This update does not merge PR #8 or deploy its branch directly to the production route. The latest Actions run and the bot's PR preview comment are the authoritative completion records; a green unit-test subset alone does not establish deployment success.
