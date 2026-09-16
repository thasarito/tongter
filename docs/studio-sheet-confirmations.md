# Review Google Sheets actions

The studio asks for confirmation before a new edit enters the Google Sheets save queue. This includes furniture movement/dimensions/locks, guest creation/edits/deletion, seating/swaps/unassignment, bulk distribution, CSV merge/replacement, reference-layout restoration, and undo/redo.

The review is derived from the exact guarded mutation, not just a button label. It shows named records, before/after seats and dimensions, affected-record counts, and distinct warnings for deleting records versus releasing seats. Bulk reviews paginate all records, without truncating the underlying action. Values render as React text, not HTML.

## Confirmation and cancellation

Nothing from the proposed action is added to the document, history, recovery journal or write queue before Confirm. The existing form remains mounted beneath the native modal. Cancel, Escape and the close button leave the action unapplied and retain form entries/selections. Selection changes, modal closing and next-seat advancement happen only after confirmation.

Confirm immediately applies the reviewed change locally, then the existing sequential queue syncs it. Users can review and confirm the next edit while earlier saves are still pending. Cancelling a new action does not cancel previously confirmed saves. Duplicate/stale confirmation events are ignored.

The provider revalidates the frozen mutation against the latest layout and history. It never reruns the original updater, which could generate new IDs or choose different seats. Unrelated changes can be retained, but changed reviewed details or conflicting history produce a visible error requiring cancellation and a fresh review. Existing server conflict checks remain authoritative.

## Connection actions

Manual Reload (including retrying the initial connection) has an explicitly read-only confirmation. Manual Retry summarizes the ordered pending saves and reuses their original operation IDs. Automatic startup/focus/periodic reads and recovery of already-confirmed queue entries do not reprompt. Refreshes defer while a review is open; the synchronous gate prevents a stale React render from blocking the confirmed reload.

## Accessibility and boundaries

The native dialog provides a modal top layer above guest/seat editors, labelled/described headings, initial Cancel focus, Escape handling, and focus restoration. The body scrolls independently with pinned actions, touch-sized buttons and wrapping long/Thai names. No new dependencies, server APIs, Google Sheet tabs, credentials, invitation/RSVP flows or deployment workflows are introduced.

Tests cover summary generation, one-time approval, cancel/no-write behavior, save acknowledgement races, revalidation, read-only refresh, retries, and preserved nonblocking saves. Browser regressions explicitly approve actions rather than bypassing the confirmation gate.
