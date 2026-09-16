# Native React Glass House Studio

## Entry point and source of truth

Open `/admin/studio` using the existing signed administrator session. This is a native React/Vite route with a separately lazy-loaded R3F scene, not an iframe or injected standalone script. PR #8 is the native alternative to iframe PR #7; do not merge both implementations.

The current StudioMeta, StudioGuests and StudioObjects tabs in Google Sheets provide the layout. The studio waits for a valid sheet response rather than flashing or uploading a previous browser draft. Exact `guestList` table IDs and seat numbers are authoritative; old per-table name caches are derived, not an independent seating source. Original-source table/seat references remain historical.

User-facing JSON import/export has been removed. The earlier standalone-to-JSON migration instructions are obsolete for the live sheet-connected studio. Internal API messages still use JSON. No private reception roster or invitation tokens are bundled in the repository.

## Component map

```text
routes/AdminStudioRoute.tsx          signed-session guard and login
studio/GlassHouseStudio.tsx          provider tree, lazy scene, modal composition
  state/StudioProvider.tsx           optimistic edits, guarded undo, pending-save recovery
  state/SheetConnection.tsx          authoritative loading, refresh, status and retry
  state/sheet-source.ts              private GET/POST transport
  interaction/GuestDragProvider.tsx  mouse/touch/pen drops and bounded feedback
  components/
    StudioToolbar.tsx               view selection, CSV and printable exports
    StudioSidebar.tsx               layers, tables, palette and diagnostics
    GuestRoster.tsx                 search, groups and bulk assignment
    GuestForm.tsx                   names, flags, notes, dietary and seats
    SeatEditor.tsx                  exact-seat selection, swap/replace and roster
    ObjectInspector.tsx             dimensions, locks, position and deletion
    ImportDialog.tsx                CSV preview before a confirmed live save
  plan/
    FloorPlan.tsx                   declarative SVG and visual exports
    PlanFurniture.tsx               shared geometry, tables and chairs
    GuestNameLabels.tsx             name-only labels anchored to seats
    usePlanCamera.ts                pan, pinch, zoom and furniture dragging
  scene/
    VenueScene.tsx                  R3F Canvas and controls
    VenueShell.tsx                  floor, glazing, vault, steel and garden
    BanquetTable.tsx                cloths, instanced chairs and occupancy colors
    EventZone.tsx                   stage, band, bar, aisles and other zones
    InstancedBoxes.tsx              batched meshes and exact-seat picking
    SceneControls.tsx               drei controls and picking
    WalkController.tsx              continuous movement and input lifecycle
    walk-motion.ts                  frame-time independent motion
    SeatLabels.tsx                  seat-centered drei Html guest names
    SceneErrorBoundary.tsx          return to SVG on graphics failure
  model/
    schema.ts                       normalized typed layout and guest validation
    geometry.ts                     shared metre-based room and chair positions
    defaults.ts                     reference geometry only
    commands.ts                     atomic seating, grouping and guest changes
    labels.ts                       wrapping and fixed seat anchors
    exchange.ts                     CSV and retained internal compatibility helpers
    printing.tsx                    SVG/PNG and printable seating HTML
shared/studio-mutations.ts           field-aware before/after guards and inverse edits
worker/routes/studio-write.ts        authenticated, same-origin mutation boundary
worker/services/studio-gateway.ts    targeted Google cell batches and receipts
worker/services/studio-writer.ts     conflict checks, idempotency and readback
worker/studio-coordinator.ts         private per-spreadsheet Durable Object queue
```

React, fiber, drei and three keep the repository's existing dependencies. All views consume the same normalized layout.

## Seating, drag feedback and names

Drag an assigned chair/name to an exact seat. A seated guest dropped on an occupied chair swaps both people. Drop a roster group onto a table for first-free assignment; groups that do not fit fail as a whole. An unassigned guest cannot silently displace an occupant: use the seat editor's replacement confirmation. Reserve/declined guests must be activated first. Deleting a table unassigns its guests rather than deleting their records.

Assigned labels show only names, centered directly over their seats. Exact numbers remain in data, accessible labels and empty-chair controls. Fixed seat anchoring supersedes the earlier displaced callout layout: zoom or open a table to read dense arrangements.

SVG coordinates are metres, not CSS pixels. Drop/focus feedback therefore uses `vector-effect: non-scaling-stroke` with a 2px stroke on the actual shape, never an SVG CSS outline. Guest pointer handlers suppress native text selection and drag-image feedback; keyboard activation remains available. The custom ghost has bounded screen-pixel dimensions.

## Automatic saving and conflicts

A completed edit creates one guarded operation, not requests for every pointer movement. It is shown optimistically while Saving is visible. Other mutations pause until acknowledgement; camera movement and browsing remain available. Unrelated remote fields are merged. A stale edit to the same guest, destination seat, capacity or removed record is rejected and the authoritative sheet state is shown.

Undo/redo submits a guarded inverse operation against the current sheet, not an old whole-layout snapshot. Pending operations survive reload in local storage when available. Retry uses the same operation ID and checks the receipt before applying anything, preventing a lost response from causing a second swap. On mobile, Retry save and Reload sheet remain visible.

The main application binds to the separately deployed private `warissara-studio-writer`. One durable coordinator serializes application writes per spreadsheet. Both sides of a swap and its receipt share one Google atomic batch. Only changed managed Studio cells are written. Legacy Guests, Groups, invitation tokens and RSVP history are never written by this path.

Native spreadsheet collaborators do not use the application queue. Before-value checks and readback detect many conflicts, but there is no database-style isolation against a simultaneous native edit or row reorder. Avoid sorting source rows or editing the same cells while an application save is in progress.

See [studio-google-sheet-source.md](studio-google-sheet-source.md) for protocol, recovery and deployment details.

## Files and privacy

Guest CSV import previews its changes and requires confirmation before saving to the live Studio tabs. Merge preserves other records; Replace can delete omitted guest records, with explicit confirmation. Stable IDs distinguish people with duplicate names. CSV formula-like values use the reversible safety convention implemented in the exchange model; the Google gateway writes literal string cells, not formulas.

CSV, SVG, PNG and printable HTML exports remain. Printable HTML is a seating list, not another interactive application. Exported names and notes are private information. Browser pending operations may also contain private guest changes; use a trusted device.

The authenticated legacy `/api/admin/studio/guests` DTO remains for compatibility and excludes invitation tokens/messages. It is no longer offered as a JSON import workflow in this studio.

## Authentication

The requested administrator credential is verified server-side using `ADMIN_PASSPHRASE_HASH`: PBKDF2-SHA-256, 16-byte salt, 100,000 iterations, 32-byte result. A configured hash overrides the legacy plaintext binding and malformed hashes fail closed. `ADMIN_SESSION_SECRET` is a separate private secret. Cookies remain HttpOnly, Secure and SameSite=Lax. The selected three-digit password is weak even when hashed and should be rotated before broader exposure.

Mutations require the existing signed session and same-origin checks. Sheet credentials and IDs come only from server bindings. The internal coordinator is not publicly routed, and credentials are never stored in its journal or exposed to the browser. Private responses are no-store, including forwarded binding responses.

## Geometry and walkthrough

The reference room remains 27.20 × 11.25 m with three curved bays, interpreted 3.5 m eaves and a 7.5 m ridge. These dimensions and spatial warnings are not a survey or accessibility/fire-egress approval.

Walking uses frame time, acceleration/deceleration, normalized diagonals, capped long frames, drag-to-look, optional pointer capture, Shift pace and a touch pad. Eye height is 1.67 m without head bob. Blur, hidden documents, dialogs, text inputs and view changes stop movement. Boundary checks are approximate and do not certify safe real-world paths.

## Verification and deployment

Normal CI is enabled: lint, TypeScript, all unit/model/worker tests, existing venue/logic/view/walk/look checks, production build, private writer dry-run bundle and desktop/mobile Playwright. Browser tests include native pointer/touch swaps, bounded SVG feedback, conflict rejection, lost-response retry, guarded undo, sheet-authoritative reload and real WebGL rendered pixels.

Only after successful verification does the workflow deploy the internal coordinator and update the PR preview. The main production website is not deployed on PR events. PR #8 remains unmerged unless explicitly requested otherwise.

Live verification compares the actual authenticated Google Sheet response to rendered names, seats, capacities and geometry on desktop/mobile. The writer is probed with an empty operation that creates no receipt and changes no guest cells. Real mutation tests use synthetic data. Latest Actions results, not this document, determine the current pass/deployment status.
