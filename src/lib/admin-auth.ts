import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "./config";

/**
 * Passphrase gate for /admin.
 *
 * The cookie holds a SHA-256 of the passphrase rather than the passphrase
 * itself. That is not password storage — it is a bearer token — but it keeps
 * the secret out of the cookie jar, and anyone holding the cookie already has
 * equivalent access. Comparison is timing-safe so the value cannot be guessed
 * byte by byte.
 */

export const ADMIN_COOKIE = "admin";

export function adminTokenFor(passphrase: string): string {
  return createHash("sha256").update(passphrase).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function checkPassphrase(candidate: string): boolean {
  const { adminPassphrase } = serverEnv();
  // An unset passphrase locks the dashboard rather than opening it.
  if (!adminPassphrase) return false;
  return safeEqual(candidate, adminPassphrase);
}

export function isAdminConfigured(): boolean {
  return Boolean(serverEnv().adminPassphrase);
}

export async function isAdmin(): Promise<boolean> {
  const { adminPassphrase } = serverEnv();
  if (!adminPassphrase) return false;

  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  if (!value) return false;

  return safeEqual(value, adminTokenFor(adminPassphrase));
}
