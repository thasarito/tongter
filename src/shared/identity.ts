"use client";

/**
 * Remembers which guest this device belongs to.
 *
 * A personal invite link identifies someone exactly once; without this every
 * later visit would send them back through side-and-name picking. Stored in
 * localStorage rather than a cookie because nothing server-side needs it — the
 * journey resolves the guest from data it already has.
 *
 * Exposed as an external store rather than something React owns, because that
 * is what it is: the browser holds the value, and React subscribes. The cached
 * snapshot matters — `useSyncExternalStore` compares by reference, so parsing
 * afresh on every call would re-render forever.
 *
 * Deliberately forgettable: the UI always shows a "not you?" escape, because
 * phones get shared and couples hand each other the link.
 */

const KEY = "wedding.guest";

export interface RememberedGuest {
  guestId: string;
  /** Kept only to show "continue as …" without another lookup. */
  name: string;
  /** Epoch ms, so a stale identity can be aged out. */
  savedAt: number;
}

/** Identities older than this are ignored — a phone passed on months later. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 120;

/** `undefined` means "not read from storage yet". */
let cached: RememberedGuest | null | undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function readStorage(): RememberedGuest | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedGuest>;
    if (typeof parsed?.guestId !== "string" || !parsed.guestId) return null;
    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return {
      guestId: parsed.guestId,
      name: typeof parsed.name === "string" ? parsed.name : "",
      savedAt: parsed.savedAt ?? 0,
    };
  } catch {
    // Private browsing, blocked storage, or corrupt JSON — treat as unknown.
    return null;
  }
}

export function subscribeIdentity(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Stable across calls, so it is safe for useSyncExternalStore. */
export function getIdentitySnapshot(): RememberedGuest | null {
  if (cached === undefined) cached = readStorage();
  return cached;
}

/** The server knows nobody; identity only exists in the browser. */
export function getIdentityServerSnapshot(): RememberedGuest | null {
  return null;
}

export function rememberGuest(guestId: string, name: string): void {
  if (typeof window === "undefined") return;
  const value: RememberedGuest = { guestId, name, savedAt: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; keep it for this session at least.
  }
  cached = value;
  notify();
}

export function forgetGuest(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
  cached = null;
  notify();
}
