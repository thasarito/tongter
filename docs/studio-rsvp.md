# RSVP in the seating studio

Tap a guest's name in the floor plan, 3D model, guest book, or table editor to open
the quick RSVP dialog. Dragging a name still moves or swaps seats. Walking-mode
labels remain noninteractive.

| Label | Name background | Existing sheet value |
| --- | --- | --- |
| คอนเฟิร์มว่ามา | Green | `Confirmed` |
| ติดต่อแล้ว รอคำตอบ | Yellow | `Maybe` |
| คอนเฟิร์มว่าไม่มา | Red | `Declined` |
| ยังไม่ได้ติดต่อ | White | `Pending` |

Choosing a status updates the guest and table count immediately, then saves
through the existing ordered Google Sheets mutation queue. RSVP and organizer
notes are the only fields using this immediate-save entry point; ordinary
seating, layout, deletion, undo, and redo actions retain their review dialog.

Notes save after 500 ms of inactivity, on blur, on dialog close, and before
navigation unmounts the studio. A local per-guest draft protects text before the
debounce and after a rejected write. The draft is removed only when the matching
note is acknowledged, so an older acknowledgement cannot erase newer typing.
Pending operations retain their original IDs for safe retry.

If another organizer changes the same note, the dialog keeps the local draft and
shows the current sheet note. The organizer can explicitly retry their note or
accept the latest version. Reopening a guest also offers recovery for a note
rejected after the dialog closed.

`Confirmed n/capacity` counts currently assigned guests whose RSVP is
`Confirmed`; the denominator is the table's configured seat capacity. Source
table references and unassigned guests do not count. Declining a seated guest
keeps their chair and red name visible; it does not silently rearrange the plan.

The feature reuses `StudioGuests.rsvp` and `StudioGuests.notes`. It requires no
sheet migration, new endpoint, or dependency. Public invitation replies remain
in the separate append-only `RSVP` sheet.

## Verification

Provider and dialog tests exercise immediate saves, queue ordering, retained
seats, interrupted saves, note conflicts, late rejections, and navigation.
`tests/e2e/studio-rsvp.spec.ts` covers all four colors, note persistence across
reload, touch layouts, the guest book, the full editor, and 3D labels using
synthetic guest data and intercepted sheet writes.
