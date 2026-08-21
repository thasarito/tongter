import { z } from "zod";

export interface ValueRange {
  values?: string[][];
}

export interface SheetsApi {
  batchGet(ranges: string[]): Promise<ValueRange[]>;
  append(range: string, rows: string[][]): Promise<void>;
}

const batchSchema = z.object({
  valueRanges: z.array(z.object({ values: z.array(z.array(z.string())).optional() })).default([]),
});

const RETRYABLE = new Set([429, 500, 502, 503]);

export function createSheetsApi(deps: {
  spreadsheetId: string;
  getAccessToken: () => Promise<string>;
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
}): SheetsApi {
  const fetcher = deps.fetcher ?? fetch;
  const wait = deps.wait ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(deps.spreadsheetId)}/values`;

  async function request(operation: string, input: string, init?: RequestInit) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const token = await deps.getAccessToken();
      const response = await fetcher(input, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init?.body ? { "content-type": "application/json" } : {}),
          ...init?.headers,
        },
      });
      if (response.ok) return response;
      if (!RETRYABLE.has(response.status) || attempt === 3) {
        throw new Error(`Google Sheets ${operation} failed (${response.status})`);
      }
      await wait(400 * 2 ** attempt);
    }
    throw new Error(`Google Sheets ${operation} failed`);
  }

  return {
    async batchGet(ranges) {
      const url = new URL(`${base}:batchGet`);
      for (const range of ranges) url.searchParams.append("ranges", range);
      const response = await request("batchGet", url.toString());
      return batchSchema.parse(await response.json()).valueRanges;
    },

    async append(range, rows) {
      const url = new URL(`${base}/${encodeURIComponent(range)}:append`);
      url.searchParams.set("valueInputOption", "RAW");
      url.searchParams.set("insertDataOption", "INSERT_ROWS");
      await request("append", url.toString(), {
        method: "POST",
        body: JSON.stringify({ values: rows }),
      });
    },
  };
}
