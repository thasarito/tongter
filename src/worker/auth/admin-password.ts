import { passphraseMatches } from "./admin-session";

interface PasswordConfiguration {
  ADMIN_PASSPHRASE_HASH?: string;
  ADMIN_PASSPHRASE?: string;
}
const encoder = new TextEncoder();
function decodeHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Server-side verifier. A configured hash is authoritative: an invalid hash
 * never silently enables the older plaintext password. The hash itself cannot
 * be submitted as a password. Session signing uses its own separate secret. */
export async function configuredPassphraseMatches(candidate: string, config: PasswordConfiguration): Promise<boolean> {
  if (config.ADMIN_PASSPHRASE_HASH) {
    // Bound the accepted work factor to the deployed Workers-compatible format.
    const match = /^pbkdf2-sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/i.exec(config.ADMIN_PASSPHRASE_HASH);
    if (!match || !candidate || candidate.length > 500) return false;
    try {
      const key = await crypto.subtle.importKey("raw", encoder.encode(candidate), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: decodeHex(match[1]), iterations: 100_000 }, key, 256);
      const actual = new Uint8Array(bits), expected = decodeHex(match[2]);
      let difference = actual.length ^ expected.length;
      for (let i = 0; i < expected.length; i++) difference |= actual[i] ^ expected[i];
      return difference === 0;
    } catch {
      return false;
    }
  }
  return !!config.ADMIN_PASSPHRASE && passphraseMatches(candidate, config.ADMIN_PASSPHRASE);
}
