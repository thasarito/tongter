# Studio Google Sheets synchronization

`/admin/studio` loads StudioMeta, StudioGuests and StudioObjects through the authenticated, no-store `/api/admin/studio/layout` endpoint. The roster is authoritative for exact seat numbers; cached object guest-name arrays are ignored. Historic source placements stay historic.

## Automatic saving

Completed edits, including drag/drop, seat swaps, guest details and furniture moves, produce one guarded operation after the gesture ends. Pointer movement never writes cells. The UI updates optimistically and shows Saving; one save is outstanding at a time. Further mutations pause until acknowledgement, while camera navigation remains available. There is no JSON file import/export or stale-local-draft startup fallback. Guest CSV preview/import, CSV export and printable/visual exports remain.

The client submits only changed records with their before/after values. The server re-reads the sheet and merges changed fields, retaining unrelated collaborator edits. Stale guest placements, taken destination seats, changed capacities, locked objects, or stale deletions are rejected as conflicts. The latest authoritative snapshot replaces the failed optimistic change. Undo/redo is an inverse guarded operation, never a wholesale restoration of an old spreadsheet.

Pending operations are stored locally for recovery. A retry keeps its operation ID. The shared writer looks up a receipt before applying it, so a lost acknowledgement cannot turn a seat swap into a second swap. Keep the tab open until Saved when local storage is restricted. If a response is ambiguous, the writer blocks other operations until it can reconcile the earlier one rather than guessing.

## Server coordination

The app binds `STUDIO_WRITER` to the separate `warissara-studio-writer` Worker. It is not publicly routed, and the main app does not export a Durable Object class, preserving PR preview support. Each spreadsheet ID maps to one durable coordinator. Session and same-origin checks run before the binding is called; browser requests cannot supply sheet IDs or service-account credentials. Credentials are never persisted to coordinator storage or logs.

`studio-gateway` writes only changed managed cells to StudioGuests/StudioObjects, locating rows and columns by current IDs and headers. Both sides of a swap and a receipt are included in one Google `spreadsheets.batchUpdate`. The hidden `_StudioSync` receipt tab is created on the first real save, not on reads or empty verification requests. Legacy Guests, Groups, invitation tokens and RSVP history are never written by this path.

Google Sheets supports atomic batches, but native sheet collaborators do not use the application coordinator. Avoid sorting/reordering the underlying tabs or editing the same cells while an app save is in progress. The app detects stale preconditions and checks readback, but cannot promise database-style isolation from simultaneous native spreadsheet edits.

## Deployment and verification

CI runs lint, TypeScript, all model/worker tests, the existing venue/walk checks, production build, coordinator dry-run bundle and desktop/mobile browser tests. It deploys the private coordinator before updating the PR preview. Main-production website deployment remains restricted to the existing non-PR job.

The post-deploy checker authenticates against the actual preview and compares the live sheet's names, exact chair placements, geometry and capacity with rendered DOM on desktop and mobile. It probes the writer with an empty operation, which creates no receipt or sheet write. Mutation/conflict/network-retry tests use synthetic data. No live guest placements are changed and no private guest artifacts are published by verification.
