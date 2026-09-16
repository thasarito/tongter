# Native React Glass House Studio

## Entry point and migration

After signing in with the existing admin passphrase, open `/admin/studio` from the admin dashboard. The studio is a lazy-loaded React route; the Three.js bundle is loaded only after switching to 3D or Walk inside.

Export **Layout JSON** from the latest standalone v3/v4/v5 HTML, then choose **Files → Import standalone / studio layout JSON** here. The app versions use layout format version 3; the importer also accepts version 2 per-table guest-name arrays. Chair numbers and empty-seat gaps are preserved. Unknown layout versions and duplicate/invalid assignments are rejected without a partial write.

The public repository includes the twenty-table reference geometry, **not the private guest roster**. A new browser draft is empty of guests. Its local storage key is `tongter:glass-house-react:v1`; it deliberately does not guess at the storage belonging to old iframe or local-file copies. Keep JSON backups when changing computers or clearing browser data.

This is an independent native alternative to the open iframe integration in PR #7. It is based on main, not on that branch. Do not merge both route implementations.

## Component and responsibility map

```text
routes/AdminStudioRoute.tsx          existing signed-session guard / sign-in
studio/GlassHouseStudio.tsx          provider composition, lazy scene, modal host
  state/StudioProvider.tsx           authoritative layout, transactional history, autosave
  interaction/GuestDragProvider.tsx  mouse/touch/pen sensor, validated seat drop, cancellation
  components/
    StudioToolbar.tsx               views, files, private roster import preview
    StudioSidebar.tsx               layers, object palette, geometry diagnostics
    GuestRoster.tsx                 search/filter, group selection, bulk assignment
    GuestForm.tsx                   guest metadata and exact-seat form
    SeatEditor.tsx                  close-up seat diagram, swap/replace, named seat list
    ObjectInspector.tsx            dimensions, rotation, locks, duplication/deletion
    ImportDialog.tsx               merge/replace preview against current draft
    Modal.tsx                      native accessible dialog lifecycle
  plan/
    FloorPlan.tsx                  declarative SVG venue and export controls
    PlanFurniture.tsx              selectable tables/zones and numbered chairs
    GuestNameLabels.tsx            full-name badges with seat-linked leaders
    usePlanCamera.ts               pan/pinch/zoom and one-transaction furniture drag
  scene/
    VenueScene.tsx                 Canvas and lazy WebGL boundary
    VenueShell.tsx                 slab, glazing, vault, steel ribs, garden
    BanquetTable.tsx               tablecloths and instanced chairs / occupancy
    EventZone.tsx                  stage, bar, band, L-shaped aisle, buffet, dance floor
    InstancedBoxes.tsx             batched geometry with instance-to-seat mapping
    SceneControls.tsx              drei OrbitControls, exact chair ray picking, shadows
    WalkController.tsx             frame-loop camera and input lifecycle
    walk-motion.ts                 pure time-based movement and boundary sliding
    SeatLabels.tsx                 drei Html projection and measured screen packing
    SceneErrorBoundary.tsx         preserve 2D/guest tools when WebGL fails
  model/
    schema.ts                      Zod boundary and legacy format normalization
    geometry.ts                    one metre-space footprint / numbered seat geometry
    defaults.ts                    venue layout only, no private guest fixtures
    commands.ts                    immutable moves/swaps/group seating/replacement
    labels.ts                      grapheme wrapping and global collision-free packing
    exchange.ts                    guest/layout parsing, source mapping and safe CSV
    printing.tsx                   SVG/PNG exports and escaped printable seating HTML
```

There is no iframe, srcDoc, injected script bundle, CDN engine loader, or window-global application state. SVG and R3F consume the same `StudioLayout`. Existing React, fiber, drei and three package versions are used; no dependencies or lockfiles change.

## Seating semantics

- A chair or floating name drag represents exactly one guest, even when a roster bulk selection exists. A roster grip moves the selected group.
- Drop on a table for the next free seat; drop on a numbered chair for an exact seat.
- A seated guest dropped on an occupied seat swaps both exact assignments. An unassigned guest cannot silently displace an occupant; the close-up editor offers confirmed replacement, returning the previous occupant to Unassigned.
- Reserve/declined guests must be activated before seating. Table locks apply to geometry, not to guest assignment.
- Group moves and distribution are atomic. Over-capacity operations leave all prior assignments untouched.
- Removing a table returns occupants to Unassigned. Removing a guest releases only that guest's seat. All changes share Undo/Redo.
- Source/original table fields are historical references, not a guessed mapping onto the twenty-table geometry. Filter an original group, select its members and explicitly distribute them across chosen target tables.

## Labels, geometry and walking

Floor-plan labels are measured globally, not separately per table. When local positions are exhausted, the algorithm moves a badge outside the existing label bounds rather than leaving overlaps. **Fit labels** includes this overflow area; zoom or open a table for full detail. Leader lines may cross, but name rectangles are separated. Long Unicode names wrap instead of truncating.

The 3D label layer projects chair anchors and measures its Html badges. It repositions visible labels after camera changes without setting React state inside `useFrame`. If a crowded viewport cannot show every badge without collision, it shows a count and asks the user to zoom or use the seat map; it does not pretend all 200 names fit on a small screen.

Walking is continuous and frame-time based, with acceleration/deceleration, normalized diagonals, capped long frames, drag-to-look, optional mouse capture, Shift pace and a touch direction pad. Eye height is 1.67 m with no head bob. Blur, hidden documents, open dialogs, text editing and view changes stop held movement. Collision is with the approximate venue footprint, not furniture or real accessibility clearances.

The original dimensions (27.20 × 11.25 m rectangular datum, three curved bays) and conventional seat numbering are retained. Vault, roof details, furniture spacing and garden remain architectural approximations. Geometry warnings are not venue capacity or fire-egress approval.

## Private site integration

`GET /api/admin/studio/guests` is behind the existing signed-cookie middleware and returns `Cache-Control: no-store`. Its shared DTO allowlists guest names, side/group, RSVP state, dietary text and source table/seat references. It excludes invitation tokens, group tokens, and RSVP messages.

Importing site guests is an explicit preview. The DTO omits current `tableId` and `seatNumber`; merging a newer RSVP/name does not clear deliberate draft seating. The worker has **no studio write/publish endpoint**. Existing public RSVP flows, Sheets assignment logic and admin dashboard data are unchanged.

## Files and intentional native-app differences

- **Save JSON** is the complete editable project backup: furniture, guests, exact seats and original references.
- Guest CSV/JSON supports merge by stable guest ID and roster replacement without moving furniture. The whole-project import requires separate confirmation before replacing both.
- In CSV, `table_id` is the canonical current table reference when populated; `table` is the display-label fallback. To change exported assignments, edit the ID and label consistently, or remove the ID column and use table labels. Clear both current table columns and seat to unassign. Do not edit the source columns to move a guest.
- CSV uses a reversible `apostrophe-v1` escape marker for formula-like text; JSON is the recommended lossless interchange.
- SVG/PNG and printable seating HTML remain available. Printable HTML contains data and CSS, not a copied interactive application. The old standalone **export a second interactive app HTML** operation is intentionally replaced by project JSON plus the hosted React route.
- Once the app is loaded, guest editing and the SVG plan do not require live Sheets requests. This change does not add a service worker or guarantee first-load offline routing.

## Review and verification status

Source and diff review only. No package installs, tests, lint, typechecking, builds, browser runs, GitHub Actions, or deployments were executed. Commits use `[skip ci]` for the repository's push/pull_request workflows. The added Vitest files are authored regression cases, not passing-test evidence.

Authored coverage includes model validation and history; legacy seat gaps; exact-seat move/swap/replace; capacity and reserve safeguards; CSV/JSON round trips; source versus current seats; Unicode labels and global packing; frame-rate-independent motion; private DTO serialization; and authenticated read-only API behavior.

### Before merge / deployment

1. Confirm typechecking, lint, unit tests and the production build in the maintainer's chosen environment.
2. Sign in at `/admin/studio`; verify unauthenticated API access is rejected. Confirm the public invitation/RSVP routes and QR dashboard are unchanged.
3. Import a private layout exported from the standalone app; compare guest count, all source references and exact seat numbers before editing.
4. Move a guest from chair to chair, swap occupied seats, reject a full-table group drop, cancel a drag, undo/redo, save and reopen JSON.
5. Test phone touch drag, two-finger SVG navigation, full names in the seat editor, and long labels after table rotation/movement.
6. Inspect the WebGL model in target browsers: roof layers, instance-to-seat picking, name projection, graphics fallback and resource release after repeated view switching.
7. Walk and look simultaneously on touch; verify blur, dialogs and text fields immediately stop motion.
8. Review every export as private data and verify that no tokens or RSVP messages are included.
