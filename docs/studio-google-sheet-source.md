# Google Sheets is the studio's live source

The `/admin/studio` route now reads the configured workbook's `StudioMeta`, `StudioGuests` and `StudioObjects` tabs before displaying the room. Names, exact seat IDs, vacant-seat gaps and table geometry are loaded together through the authenticated `GET /api/admin/studio/layout` endpoint. No private roster is bundled in the repository or frontend assets.

## Canonical tabs

- **StudioGuests**: one row per JSON guest, with the original 21 field names. `tableId` and `seatNumber` are the current assignment. A blank pair means unassigned. `sourceTableId` and `sourceSeatNumber` are historical references only.
- **StudioObjects**: one row per layout object. `x/z/w/d/h/rotation/seats` are read as their underlying values, not rounded display text. `guests_json` preserves the original export's cached array for provenance, but it is never used to assign chairs. Occupancy is rebuilt from StudioGuests so empty-seat gaps are retained.
- **StudioMeta**: key/value records. `syncStatus` must be `complete`, `version` must be `3`, and units are `metres`. Set status to `writing` during multi-step bulk imports so the site will refuse partially updated data. `guestSource`, `sourceFile` and `sourceSha256` are import provenance; the imported-count fields are historical, not a limit on future edits.

The existing **Guests**, **Groups** and **RSVP** tabs remain the legacy invitation system. Their IDs, tokens and response history are not rewritten. This avoids invalidating previously shared invitations or accidentally joining people by an ambiguous name. These canonical studio tabs do not migrate the public RSVP site's older ten-table geometry; that remains a separate, explicitly reviewable migration.

## Reload and local edits

The studio blocks its first render until a valid current sheet has arrived. An old browser-local draft is not silently substituted for a failed or incomplete sheet read. The previous local draft is preserved in a recovery slot before the first replacement, and can be downloaded with **Previous draft**.

While the studio is clean, it rereads the sheet every 30 seconds and on window focus. The server coalesces simultaneous reads but does not serve an old cached studio result. Name or geometry edits made in Sheets therefore appear without importing another file.

Edits made in the studio are still local drafts, not automatic writes to Sheets. The status banner explicitly says **Local draft edits — not published to Sheets**. Background polling does not overwrite those edits, an active dialog, or an in-progress guest drag. **Reload sheet** confirms discarding a modified draft, saves a recovery copy, then displays current Sheets values. JSON remains the complete project backup/export.

Malformed rows, unknown tables, duplicate seats, partial table/seat pairs, an in-progress import, and unavailable Sheets credentials fail visibly instead of displaying an unrelated reference plan. Native Sheets text and numeric/boolean cells are supported. Only explicitly identified `MOCK_SHEET=1` test environments can open the legacy local/demo fixture without a live workbook.

## Safety and verification

The endpoint remains behind the existing signed administrator cookie and sends `Cache-Control: no-store`. It allowlists studio fields and does not expose invitation tokens. It does not write or append any sheet records or RSVP rows.

Added tests cover current-versus-historical assignment data, Table 12-style seat gaps, raw decimal precision, boolean decoding, invalid/interrupted imports, authentication, no stale response fallback, clean refreshes, protected dirty drafts and recovery backups. Deployed verification must compare the rendered/exported studio state against the actual authenticated sheet response, without publishing private guest data in CI artifacts or logs.
