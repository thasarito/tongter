import { snapshotFromBatchValues } from "@/shared/sheet-records";
import { SHEET_TABS, type Snapshot } from "@/shared/types";
import type { SheetsApi } from "../google/sheets-api";

const CACHE_TTL_MS = 45_000;

export interface RsvpSubmission {
  groupId: string;
  submittedBy: string;
  lang: string;
  entries: Array<{
    guestId: string;
    attending: boolean;
    dietary: string;
    note: string;
  }>;
}

export interface SnapshotRepository {
  getSnapshot(): Promise<Snapshot>;
  invalidate(): void;
  appendRsvp(input: RsvpSubmission): Promise<void>;
}

export function createSnapshotRepository(deps: {
  api: SheetsApi;
  now?: () => number;
  ttlMs?: number;
}): SnapshotRepository {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? CACHE_TTL_MS;
  let snapshot: Snapshot | null = null;
  let inflight: Promise<Snapshot> | null = null;
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function refresh(): Promise<Snapshot> {
    const values = await deps.api.batchGet([
      `${SHEET_TABS.guests}!A1:Z`,
      `${SHEET_TABS.groups}!A1:Z`,
      `${SHEET_TABS.rsvp}!A1:Z`,
    ]);
    return snapshotFromBatchValues(values, now());
  }

  return {
    async getSnapshot() {
      if (snapshot && snapshot.fetchedAt > 0 && now() - snapshot.fetchedAt < ttlMs) {
        return snapshot;
      }
      inflight ??= refresh()
        .then((next) => {
          snapshot = next;
          return next;
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          snapshot = snapshot
            ? { ...snapshot, status: "stale", error: message }
            : {
                status: "stale",
                guests: [],
                groups: [],
                rsvps: [],
                warnings: [],
                fetchedAt: 0,
                error: message,
              };
          return snapshot;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },

    invalidate() {
      if (snapshot) snapshot = { ...snapshot, fetchedAt: 0 };
    },

    async appendRsvp(input) {
      const run = async () => {
        const timestamp = new Date(now()).toISOString();
        await deps.api.append(
          `${SHEET_TABS.rsvp}!A:H`,
          input.entries.map((entry) => [
            timestamp,
            input.groupId,
            entry.guestId,
            entry.attending ? "yes" : "no",
            entry.dietary,
            entry.note,
            input.submittedBy,
            input.lang,
          ]),
        );
        if (snapshot) snapshot = { ...snapshot, fetchedAt: 0 };
      };
      const result = writeQueue.then(run, run);
      writeQueue = result.catch(() => undefined);
      return result;
    },
  };
}
