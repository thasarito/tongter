import { buildMockDataset } from "@/shared/mock-dataset";
import type { RsvpRow, Snapshot } from "@/shared/types";
import type { WorkerBindings } from "./env";
import { parseServiceAccount } from "./env";
import { createGoogleOAuth } from "./google/oauth";
import { createSheetsApi } from "./google/sheets-api";
import {
  createSnapshotRepository,
  type SnapshotRepository,
} from "./services/snapshot";

export interface AppDependencies {
  repositoryFor(env: WorkerBindings): SnapshotRepository;
  now(): number;
}

const repositories = new Map<string, SnapshotRepository>();

function createMockRepository(): SnapshotRepository {
  const fixture = buildMockDataset({ readableTokens: true });
  const sessionRsvps: RsvpRow[] = [];
  return {
    async getSnapshot(): Promise<Snapshot> {
      return {
        status: "ok",
        guests: fixture.guests,
        groups: fixture.groups,
        rsvps: [...fixture.rsvps, ...sessionRsvps],
        fetchedAt: Date.now(),
        warnings: [],
      };
    },
    invalidate() {},
    async appendRsvp(input) {
      const timestamp = new Date().toISOString();
      sessionRsvps.push(
        ...input.entries.map((entry) => ({
          timestamp,
          groupId: input.groupId,
          guestId: entry.guestId,
          attending: entry.attending,
          dietary: entry.dietary,
          message: entry.note,
          submittedBy: input.submittedBy,
          lang: input.lang,
        })),
      );
    },
  };
}

const unconfiguredRepository: SnapshotRepository = {
  async getSnapshot() {
    return {
      status: "unconfigured",
      guests: [],
      groups: [],
      rsvps: [],
      fetchedAt: 0,
      warnings: [],
    };
  },
  invalidate() {},
  async appendRsvp() {
    throw new Error("Google Sheets is not configured");
  },
};

export function repositoryForBindings(env: WorkerBindings): SnapshotRepository {
  if (env.MOCK_SHEET === "1") {
    const key = "mock";
    if (!repositories.has(key)) repositories.set(key, createMockRepository());
    return repositories.get(key)!;
  }
  if (!env.GOOGLE_SHEET_ID || !env.GOOGLE_CREDENTIALS_JSON) {
    return unconfiguredRepository;
  }
  const key = `${env.GOOGLE_SHEET_ID}:${env.GOOGLE_CREDENTIALS_JSON.length}`;
  const existing = repositories.get(key);
  if (existing) return existing;

  const oauth = createGoogleOAuth({
    credentials: parseServiceAccount(env.GOOGLE_CREDENTIALS_JSON),
  });
  const repository = createSnapshotRepository({
    api: createSheetsApi({
      spreadsheetId: env.GOOGLE_SHEET_ID,
      getAccessToken: oauth.getAccessToken,
    }),
  });
  repositories.set(key, repository);
  return repository;
}

export const productionDependencies: AppDependencies = {
  repositoryFor: repositoryForBindings,
  now: Date.now,
};
