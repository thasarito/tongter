import { describe, expect, it, vi } from "vitest";
import { createSheetsApi } from "./sheets-api";

describe("Google Sheets REST API", () => {
  it("reads all requested ranges with bearer authentication", async () => {
    let request: Request | undefined;
    const api = createSheetsApi({
      spreadsheetId: "sheet-123",
      getAccessToken: async () => "access-123",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({ valueRanges: [{ values: [["Guest ID"]] }] });
      },
    });

    const ranges = ["Guests!A1:Z", "Groups!A1:Z", "RSVP!A1:Z"];
    await expect(api.batchGet(ranges)).resolves.toHaveLength(1);
    expect(request?.headers.get("authorization")).toBe("Bearer access-123");
    expect(new URL(request!.url).searchParams.getAll("ranges")).toEqual(ranges);
  });

  it("appends raw rows to the selected range", async () => {
    let request: Request | undefined;
    const api = createSheetsApi({
      spreadsheetId: "sheet-123",
      getAccessToken: async () => "access-123",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({ updates: { updatedRows: 1 } });
      },
    });

    await api.append("RSVP!A:H", [["now", "group-1"]]);

    expect(request?.method).toBe("POST");
    expect(new URL(request!.url).searchParams.get("valueInputOption")).toBe("RAW");
    expect(await request?.json()).toEqual({ values: [["now", "group-1"]] });
  });

  it("retries transient responses and not permanent responses", async () => {
    const wait = vi.fn(async () => undefined);
    let transientCalls = 0;
    const transient = createSheetsApi({
      spreadsheetId: "sheet-123",
      getAccessToken: async () => "token",
      wait,
      fetcher: async () =>
        ++transientCalls < 3
          ? new Response(null, { status: 503 })
          : Response.json({ valueRanges: [] }),
    });
    await transient.batchGet(["Guests!A1:Z"]);
    expect(transientCalls).toBe(3);
    expect(wait).toHaveBeenNthCalledWith(1, 400);
    expect(wait).toHaveBeenNthCalledWith(2, 800);

    let permanentCalls = 0;
    const permanent = createSheetsApi({
      spreadsheetId: "sheet-123",
      getAccessToken: async () => "token",
      fetcher: async () => {
        permanentCalls += 1;
        return new Response(null, { status: 400 });
      },
    });
    await expect(permanent.batchGet(["Guests!A1:Z"])).rejects.toThrow(
      "Google Sheets batchGet failed (400)",
    );
    expect(permanentCalls).toBe(1);
  });
});
