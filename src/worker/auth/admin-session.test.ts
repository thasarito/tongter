import { describe, expect, it } from "vitest";
import {
  createAdminSession,
  passphraseMatches,
  verifyAdminSession,
} from "./admin-session";

const secret = "0123456789abcdef0123456789abcdef";

describe("administrator sessions", () => {
  it("round-trips until its twelve-hour expiry", async () => {
    const token = await createAdminSession({ secret, now: () => 1_700_000_000_000 });
    await expect(
      verifyAdminSession(token, { secret, now: () => 1_700_000_000_000 + 43_199_000 }),
    ).resolves.toBe(true);
    await expect(
      verifyAdminSession(token, { secret, now: () => 1_700_000_000_000 + 43_201_000 }),
    ).resolves.toBe(false);
  });

  it("rejects changed payloads and signatures", async () => {
    const token = await createAdminSession({ secret });
    const [payload, signature] = token.split(".");
    await expect(verifyAdminSession(`${payload}x.${signature}`, { secret })).resolves.toBe(false);
    await expect(verifyAdminSession(`${payload}.${signature}x`, { secret })).resolves.toBe(false);
  });

  it("compares passphrases without accepting near matches", async () => {
    await expect(passphraseMatches("correct horse", "correct horse")).resolves.toBe(true);
    await expect(passphraseMatches("correct horsf", "correct horse")).resolves.toBe(false);
  });
});
