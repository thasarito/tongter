const PREFIX = "tongter:studio:rsvp-note-v1:";
const MAX_NOTE_LENGTH = 4000;

/** Keep raw typing separate from the normalized note and the submitted queue. */
export function readRsvpNoteDraft(id: string): string | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw !== null && raw.length <= MAX_NOTE_LENGTH ? raw : null;
  } catch { return null; }
}

export function storeRsvpNoteDraft(id: string, notes: string): boolean {
  if (notes.length > MAX_NOTE_LENGTH) return false;
  try {
    localStorage.setItem(PREFIX + id, notes);
    return true;
  } catch { return false; }
}

/** An acknowledgement may clear its own note, never text typed afterward. */
export function clearRsvpNoteDraft(id: string, expectedNote?: string): void {
  try {
    const key = PREFIX + id;
    if (expectedNote !== undefined && localStorage.getItem(key)?.trim() !== expectedNote) return;
    localStorage.removeItem(key);
  } catch { /* Recovery storage may be unavailable; saving remains usable. */ }
}
