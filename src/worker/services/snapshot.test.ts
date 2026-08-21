import { describe, expect, it, vi } from "vitest";
import type { SheetsApi } from "../google/sheets-api";
import { createSnapshotRepository } from "./snapshot";

const valueRanges = [
  {
    values: [
      ["guest_id", "name_th", "name_en", "group_id", "table_id", "seat_index", "side", "tags", "token"],
      ["g1", "วิว", "View", "grp1", "1", "1", "bride", "", "me1"],
    ],
  },
  {
    values: [
      ["group_id", "label_th", "label_en", "token"],
      ["grp1", "ครอบครัว", "Family", "group1"],
    ],
  },
  {
    values: [["timestamp", "group_id", "guest_id", "attending", "dietary", "message", "submitted_by", "lang"]],
  },
];

describe("snapshot repository", () => {
  it("shares concurrent reads and caches a fresh snapshot", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const api: SheetsApi = {
      batchGet: vi.fn(async () => { await gate; return valueRanges; }),
      append: vi.fn(),
    };
    const repository = createSnapshotRepository({ api, now: () => 100_000 });

    const first = repository.getSnapshot();
    const second = repository.getSnapshot();
    release();
    expect((await first).guests[0].guestId).toBe("g1");
    await second;
    await repository.getSnapshot();
    expect(api.batchGet).toHaveBeenCalledOnce();
  });

  it("serves the last snapshot as stale when refresh fails", async () => {
    let now = 100_000;
    let fail = false;
    const api: SheetsApi = {
      batchGet: async () => {
        if (fail) throw new Error("offline");
        return valueRanges;
      },
      append: vi.fn(),
    };
    const repository = createSnapshotRepository({ api, now: () => now });

    await expect(repository.getSnapshot()).resolves.toMatchObject({ status: "ok" });
    now += 46_000;
    fail = true;
    await expect(repository.getSnapshot()).resolves.toMatchObject({
      status: "stale",
      guests: [{ guestId: "g1" }],
    });
  });

  it("appends serialized RSVP rows then invalidates the snapshot", async () => {
    let now = 100_000;
    const api: SheetsApi = {
      batchGet: vi.fn(async () => valueRanges),
      append: vi.fn(async () => undefined),
    };
    const repository = createSnapshotRepository({ api, now: () => now });
    await repository.getSnapshot();

    await repository.appendRsvp({
      groupId: "grp1",
      submittedBy: "g1",
      lang: "en",
      entries: [{ guestId: "g1", attending: true, dietary: "halal", note: "Hi" }],
    });

    expect(api.append).toHaveBeenCalledWith("RSVP!A:H", [
      [expect.any(String), "grp1", "g1", "yes", "halal", "Hi", "g1", "en"],
    ]);
    now += 1;
    await repository.getSnapshot();
    expect(api.batchGet).toHaveBeenCalledTimes(2);
  });
});
