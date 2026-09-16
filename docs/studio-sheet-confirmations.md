# Google Sheets action confirmations

The studio shows one concise action and two buttons, **Cancel** and **Confirm**, before user-initiated sheet actions. Examples: “Move Alice to Table 2 · Seat 3”, “Swap Alice and Bob”, “Remove 12 guests”, and “Reload Google Sheets”. No explanatory paragraphs, counters, record cards, before/after tables, badges, pagination or footnotes are rendered. Destructive actions retain their distinct button styling; deletion and unassignment remain distinct in the action wording.

The dialog is at most 360px wide, with compact spacing, wrapping names and 44px button targets. The native modal retains focus containment, initial Cancel focus, Escape cancellation, pointer-lock release and focus restoration. An actual validation error is the only extra text and disables Confirm until the action is reviewed again.

This is a presentation change only. The complete structured summary and guarded mutation still exist internally. Confirmation applies the exact reviewed operation once after revalidating before-values, history and full details. Nothing is added to the layout, history, recovery journal or save queue before approval. Cancel keeps parent forms and selections. Previously confirmed saves continue through the nonblocking queue.

Furniture and guest edits, seating/swaps, bulk actions, CSV import, reference-layout restoration, undo/redo, manual reload and manual retry retain their existing confirmation coverage. Automatic reads and recovery of previously confirmed edits do not reprompt. No server APIs, credentials, sheet data, invitation/RSVP behavior or workflow gates are changed.

Regression tests cover action-only rendering, named seat moves/swaps, bulk actions, Unicode, conditional errors, safe cancellation, unchanged full-summary validation, queued saving and compact desktop/mobile/landscape dimensions.
