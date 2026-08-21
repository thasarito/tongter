const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const ADMIN_COOKIE = "wedding-admin";
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 12;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

export async function passphraseMatches(
  candidate: string,
  expected: string,
): Promise<boolean> {
  const [candidateDigest, expectedDigest] = await Promise.all([
    digest(candidate),
    digest(expected),
  ]);
  return equalBytes(candidateDigest, expectedDigest);
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload)),
  );
}

export async function createAdminSession(input: {
  secret: string;
  now?: () => number;
}): Promise<string> {
  const now = input.now ?? Date.now;
  const payload = base64Url(
    textEncoder.encode(
      JSON.stringify({
        exp: Math.floor(now() / 1000) + ADMIN_MAX_AGE_SECONDS,
      }),
    ),
  );
  return `${payload}.${base64Url(await hmac(input.secret, payload))}`;
}

export async function verifyAdminSession(
  token: string,
  input: { secret: string; now?: () => number },
): Promise<boolean> {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    const expected = await hmac(input.secret, payload);
    if (!equalBytes(expected, fromBase64Url(signature))) return false;
    const parsed = JSON.parse(textDecoder.decode(fromBase64Url(payload))) as {
      exp?: unknown;
    };
    const now = input.now ?? Date.now;
    return typeof parsed.exp === "number" && parsed.exp >= Math.floor(now() / 1000);
  } catch {
    return false;
  }
}
