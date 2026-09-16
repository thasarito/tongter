# Glass House admin studio

Open `/admin/studio` or use **Open Glass House seating studio** on `/admin`.
The editor uses the existing signed administrator session. It is an isolated,
lazy-loaded document so its CSS, global listeners and legacy Three.js runtime
cannot replace the public site's React components or venue definitions.

## Start with your own draft

The public repository intentionally contains **no private guest roster**, tokens,
notes, or saved browser seating snapshots. It starts with the v5 twenty-table
geometry and an empty guest list. Use **Files → Import layout** to import the JSON
from your standalone v5 copy. This preserves geometry, guests, seat numbers and
original source references. Importing a complete layout replaces the draft only
after confirmation, with undo available.

Alternatively use **Import site guests (preview)** above the editor. This reads
`GET /api/admin/studio/guests`, behind the existing admin authentication middleware,
with `Cache-Control: no-store`. The response is explicitly allowlisted: no personal
invite tokens, group invite tokens or RSVP messages. RSVP state follows the
existing last-row-wins rule. Names prefer the Thai display name, then English.
Host labels use the source `bride`/`groom` side without guessing couple nicknames.

The site's fixed ten-table layout and the studio's twenty-table draft are different
plans. Site table/seat references are saved as `sourceTableId`/`sourceSeatNumber`,
not assigned to similarly numbered studio tables. First-time imports start
unassigned. Merge imports preserve local seating for matching IDs because the
site import intentionally omits the draft `tableId` and `seatNumber` fields.
No matching by guest name is performed; separate IDs stay separate. Unsupported
or oversized fields fail validation in the import preview rather than silently
changing names or identifiers.

## Editing

- Move furniture, edit dimensions, lock spaces, toggle the roof, and switch
  between the SVG floor plan, 3D model and continuous eye-level walking.
- Open a numbered chair or its name label for seat-by-seat assignment. Drag an
  occupied chair or label to an empty chair to move; an occupied target swaps.
  A chair/label drag moves exactly that person even if a bulk group is selected.
- Bulk assignment, add/edit/remove guests, source-group filters, reserve flags,
  import preview, undo/redo and printable seating lists are retained.
- Name labels use full names with wrapping and deterministic collision-aware
  positioning. Dense arrangements can send labels outward; zoom or use the table
  close-up. Leader lines can still cross in crowded whole-venue views.
- Move with WASD/arrows or the touch pad; drag to look; Shift increases pace.
  Escape releases mouse look and cancels an active guest drag.

## Persistence and live-site boundary

All editor commits autosave to this browser's local storage under a studio-specific
key and are exportable as Layout JSON, guest CSV/JSON, SVG/PNG and portable HTML.
The iframe never sends draft state to the server. There is **no publish/write-back
endpoint** and no edits to the live Google Sheet, RSVP records, guest-facing seat
reveals, QR links or existing `/debug/venue` geometry. Publishing a twenty-table
layout to those surfaces requires a separate migration and approval.

The parent/frame bridge validates both the message origin and the exact source
window. It only opens the normal import preview; it never applies an import
without user confirmation. The iframe contains trusted repository code and uses
same-origin access for local storage, so it is lifecycle/CSS isolation, not a
security boundary against arbitrary third-party scripts. Guest JSON/CSV imports
are parsed as data, never as executable HTML.

Exports and local drafts contain private guest data. Do not commit them or use a
shared browser without considering its retained storage. A downloaded portable
HTML is a private offline copy and has no server sign-in gate.

## Runtime layout

`src/client/studio/document.ts` assembles an inline document from `shell.ts`, raw
CSS and the ordered `runtime/*.js.txt` fragments. The four application fragments
and integration adapter form **one IIFE**; they are not independently executable
modules. The `.txt` suffix intentionally prevents bundler/TypeScript transforms
from treating partial classic-script source as application modules. Review them
as source, not generated binaries.

The adapter preserves v5's pinned Three.js r161 loader rather than forcing the
site's newer React Three Fiber version onto it. First 3D use needs CDN access;
SVG/guest editing does not. After the engine loads, **Save portable HTML** embeds
it for offline use. The existing repository seating reference is bundled inline;
private uploaded photos and guest snapshots are not copied into source.

## Review / verification status

Implementation is delivered through direct GitHub API commits. No GitHub Actions,
local CLI checks, test suites or deployment commands were run for this change.
Commit messages include `[skip ci]` to avoid the repository's push/PR workflow.
Static review covers routing, authentication placement, import allowlisting,
source/target seat resolution, fragment assembly and persistence boundaries.
Typechecking, browser behavior and live WebGL rendering are **not verified** here.

Suggested manual review after checkout: unauthenticated login, import a v5 Layout
JSON, move/swap a guest by chair and label, cancel a drag, undo/redo, touch dragging,
name visibility, 3D walk, JSON/CSV/portable round trips, and source-guest preview.
Confirm that none of those edits affect the live RSVP/seat-reveal pages.
