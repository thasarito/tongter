import { buildMockDataset } from "@/shared/mock-dataset";
import type { Snapshot } from "@/shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { SnapshotRepository } from "../services/snapshot";

const dataset = buildMockDataset({ readableTokens: true });
const snapshot: Snapshot = {
  status: "ok",
  ...dataset,
  fetchedAt: 1_700_000_000_000,
  warnings: [],
};

describe("public API", () => {
  let repository: SnapshotRepository;

  beforeEach(() => {
    repository = {
      getSnapshot: vi.fn(async () => snapshot),
      invalidate: vi.fn(),
      appendRsvp: vi.fn(async () => undefined),
    };
  });

  function app() {
    return createApp({ repositoryFor: () => repository, now: () => 1_700_000_000_000 });
  }

  it("returns the home journey without group tokens", async () => {
    const response = await app().request("/api/journey?lang=en");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.guests.length).toBe(snapshot.guests.length);
    expect(JSON.stringify(body)).not.toContain("demo001");
  });

  it("searches safely and enforces the minimum query length", async () => {
    const short = await app().request("/api/search?q=V&lang=en");
    expect(await short.json()).toMatchObject({ state: "too-short", results: [] });

    const response = await app().request("/api/search?q=View&lang=en");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.state).toBe("results");
    expect(body.results[0]).toEqual(
      expect.objectContaining({ name: "View", href: "/rsvp/demo001" }),
    );
    expect(body.results[0]).not.toHaveProperty("token");
  });

  it("redirects Google Calendar through a server-owned event URL", async () => {
    const response = await app().request("/api/calendar/google?lang=en", {
      redirect: "manual",
    });
    const location = response.headers.get("location");

    expect(response.status).toBe(302);
    expect(location).not.toBeNull();

    const target = new URL(location!);
    expect(`${target.origin}${target.pathname}`).toBe(
      "https://calendar.google.com/calendar/render",
    );
    expect(target.searchParams.get("action")).toBe("TEMPLATE");
    expect(target.searchParams.get("text")).toBe("Warissara & Thasarit's Wedding");
    expect(target.searchParams.get("dates")).toBe(
      "20261115T110000Z/20261115T150000Z",
    );
    expect(target.searchParams.get("ctz")).toBe("Asia/Bangkok");
    expect(target.searchParams.get("location")).toBe(
      "The Glass House, Nai Lert Park",
    );
    expect(target.searchParams.get("details")).toContain(
      "https://maps.app.goo.gl/5YVrLWsZ3ocuZgia8",
    );
  });

  it("serves a generated wedding calendar file with import-friendly headers", async () => {
    const response = await app().request("/api/calendar/wedding.ics?lang=en");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(response.headers.get("content-disposition")).toContain(
      'filename="warissara-thasarit-wedding.ics"',
    );
    expect(body).toContain("BEGIN:VCALENDAR\r\n");
    expect(body).toContain("DTSTART;TZID=Asia/Bangkok:20261115T180000\r\n");
    expect(body).toContain("DTEND;TZID=Asia/Bangkok:20261115T220000\r\n");
    expect(body).toContain("SUMMARY:Warissara & Thasarit\\'s Wedding\r\n");
    expect(body).toContain("LOCATION:The Glass House\\, Nai Lert Park\r\n");
    expect(body).toContain("URL:https://warissara.thasarito.com\r\n");
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("loads personal and group invitation bootstrap data", async () => {
    const personal = await app().request("/api/journey/me001?lang=en");
    expect(personal.status).toBe(200);
    expect(await personal.json()).toMatchObject({
      flow: { selfGuestId: "g01-01", view: { kind: "form" } },
    });

    const group = await app().request("/api/rsvp/demo001?lang=en");
    expect(group.status).toBe(200);
    const groupBody = await group.json();
    expect(groupBody.view.kind).toBe("form");
    expect(groupBody.choices[0]).toEqual({ guestId: "g01-01", name: "View" });
  });

  it("resolves a name-picker guest without exposing group tokens in the intro", async () => {
    const response = await app().request("/api/journey/person", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guestId: "g01-01", lang: "en" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      selfGuestId: "g01-01",
      view: { kind: "form", token: "demo001" },
    });
  });

  it("uses the same not-found envelope for unknown invitation tokens", async () => {
    for (const path of ["/api/journey/nope", "/api/rsvp/nope", "/api/seat/nope"]) {
      const response = await app().request(path);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "Invitation not found." },
      });
    }
  });

  it("submits only members of the token's group", async () => {
    const response = await app().request("/api/rsvp/demo001", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submittedBy: "g01-01",
        lang: "en",
        answers: [
          { guestId: "g01-01", attending: true, dietary: ["halal"], dietaryOther: "", note: "Hi" },
          { guestId: "g10-01", attending: true, dietary: [], dietaryOther: "", note: "foreign" },
        ],
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      seatHref: "/seat/demo001?celebrate=1&guest=g01-01",
    });
    expect(repository.appendRsvp).toHaveBeenCalledWith({
      groupId: "grp-001",
      submittedBy: "g01-01",
      lang: "en",
      entries: [{ guestId: "g01-01", attending: true, dietary: "halal", note: "Hi" }],
    });
  });

  it("returns a retryable error when the append fails", async () => {
    repository.appendRsvp = vi.fn(async () => { throw new Error("secret failure"); });
    const response = await app().request("/api/rsvp/demo001", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submittedBy: "g01-01",
        lang: "en",
        answers: [{ guestId: "g01-01", attending: false, dietary: [], dietaryOther: "", note: "" }],
      }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "RSVP_WRITE_FAILED", message: "Please try again." },
    });
  });
});
