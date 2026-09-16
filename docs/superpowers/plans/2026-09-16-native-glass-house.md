# Native Glass House Studio implementation plan

## Goal and architecture
Refactor the approved standalone seat planner into the existing React/Vite project. Native React controls and SVG share one validated TypeScript layout with an independently lazy-loaded React Three Fiber scene. Use the already-installed fiber/drei/three versions; do not add CDN loaders, iframe/srcDoc documents, global window state, or private roster fixtures.

## Integration boundaries
- New `/admin/studio` route, guarded by the existing signed administrator session.
- Read-only roster DTO behind worker authentication; explicitly exclude invitation tokens and RSVP messages. Imported live seats become source references, never guessed into the 20-table draft.
- Public RSVP, live Sheets assignments and the public venue stay unchanged.
- This PR is an independent native alternative to open iframe PR #7, based on main. Do not merge both implementations.

## Work units
1. Typed data model: legacy layout parsing, seat IDs, transactions, moves/swaps, capacity checks, label packing and format compatibility.
2. React state and interactions: local history/autosave, recoverable import previews, pointer-based mouse/touch drag with exact-seat targets and cancellation.
3. Native UI: toolbar, layers, guest book, guest form, object inspector, close-up seat editor, SVG floor plan and name labels.
4. R3F scene: venue shell/roof, table/chair geometry, event zones, camera controls, smooth walk controller and projected labels. Hooks and resource lifetimes stay in the Canvas tree.
5. Admin route/API integration, documentation and authored regression cases.
6. Direct GitHub API commits, inspect complete changes, create PR and mark ready.

## Review-only execution constraint
Do not run a local clone, git/gh CLI, package install, tests, lint, typechecking, builds, GitHub Actions, workflow dispatch or deployments. Use connector commits with `[skip ci]` and code/diff inspection. Regression cases and acceptance checklists may be written, but must be described as unrun.

## Acceptance review
- Seat targets resolve before furniture targets; drag from a chair/name means one person even when a bulk selection exists.
- Swaps and group placement are atomic; deleting a table unassigns, never deletes guests.
- Import preview revalidates against the current draft at apply time; no partial write on invalid files.
- Full names wrap; global 2D label overflow is collision-free and reflows on table movement / guest changes.
- Walking is frame-time based and stops on blur, modal opening, text entry and view changes.
- Export serializes data only; no invitation tokens or untrusted executable HTML.
