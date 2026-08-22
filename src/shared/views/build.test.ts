import { describe, expect, it } from "vitest";
import { buildMockDataset } from "../mock-dataset";
import type { Snapshot } from "../types";
import { buildQrSheetView } from "./build";

const dataset = buildMockDataset({ readableTokens: true });
const snapshot: Snapshot = {
  status: "ok",
  ...dataset,
  fetchedAt: 1_700_000_000_000,
  warnings: [],
};

describe("buildQrSheetView", () => {
  it("adds LINE's external-browser flag to every printed RSVP QR URL", () => {
    const view = buildQrSheetView(snapshot, "en", "https://example.test");

    expect(view.cards).toHaveLength(snapshot.groups.length);
    for (const card of view.cards) {
      const target = new URL(card.url);
      expect(target.origin).toBe("https://example.test");
      expect(target.pathname).toBe(`/rsvp/${card.token}`);
      expect(target.searchParams.get("openExternalBrowser")).toBe("1");
    }
  });
});
