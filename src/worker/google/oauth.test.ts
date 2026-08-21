import { describe, expect, it, vi } from "vitest";
import { createGoogleOAuth } from "./oauth";

const credentials = {
  client_email: "wedding@example.iam.gserviceaccount.com",
  private_key: "unused-by-injected-signer",
  token_uri: "https://oauth2.googleapis.com/token",
};

describe("Google OAuth", () => {
  it("exchanges a scoped assertion and caches the token", async () => {
    const calls: URLSearchParams[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      calls.push(new URLSearchParams(String(init?.body)));
      return Response.json({ access_token: "token-1", expires_in: 3600 });
    };
    const signAssertion = vi.fn(async (claims) => {
      expect(claims.scope).toBe(
        "https://www.googleapis.com/auth/spreadsheets",
      );
      expect(claims.iss).toBe(credentials.client_email);
      return "signed.jwt";
    });
    const auth = createGoogleOAuth({
      credentials,
      fetcher,
      now: () => 1_700_000_000_000,
      signAssertion,
    });

    await expect(auth.getAccessToken()).resolves.toBe("token-1");
    await expect(auth.getAccessToken()).resolves.toBe("token-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].get("assertion")).toBe("signed.jwt");
    expect(signAssertion).toHaveBeenCalledOnce();
  });

  it("refreshes when less than sixty seconds remain", async () => {
    let now = 1_700_000_000_000;
    let token = 0;
    const auth = createGoogleOAuth({
      credentials,
      now: () => now,
      signAssertion: async () => "signed.jwt",
      fetcher: async () =>
        Response.json({ access_token: `token-${++token}`, expires_in: 120 }),
    });

    await expect(auth.getAccessToken()).resolves.toBe("token-1");
    now += 61_000;
    await expect(auth.getAccessToken()).resolves.toBe("token-2");
  });

  it("reports only the status when the exchange fails", async () => {
    const auth = createGoogleOAuth({
      credentials,
      signAssertion: async () => "signed.jwt",
      fetcher: async () => new Response("sensitive body", { status: 401 }),
    });

    await expect(auth.getAccessToken()).rejects.toThrow(
      "Google OAuth failed (401)",
    );
  });
});
