import { z } from "zod";
import type { ServiceAccount } from "../env";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets" as const;
const textEncoder = new TextEncoder();

export interface GoogleClaims {
  iss: string;
  scope: typeof SHEETS_SCOPE;
  aud: string;
  iat: number;
  exp: number;
}

export interface OAuthDependencies {
  credentials: ServiceAccount;
  fetcher?: typeof fetch;
  now?: () => number;
  signAssertion?: (claims: GoogleClaims) => Promise<string>;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64Url(textEncoder.encode(JSON.stringify(value)));
}

function pemBuffer(pem: string): ArrayBuffer {
  const encoded = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function signServiceAccountJwt(
  credentials: ServiceAccount,
  claims: GoogleClaims,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBuffer(credentials.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const unsigned = `${encodeJson({ alg: "RS256", typ: "JWT" })}.${encodeJson(claims)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(unsigned),
  );
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

export function createGoogleOAuth(deps: OAuthDependencies): {
  getAccessToken(): Promise<string>;
} {
  const fetcher = deps.fetcher ?? fetch;
  const now = deps.now ?? Date.now;
  const signAssertion =
    deps.signAssertion ??
    ((claims) => signServiceAccountJwt(deps.credentials, claims));
  let cached: { value: string; expiresAt: number } | null = null;

  return {
    async getAccessToken() {
      if (cached && cached.expiresAt - now() > 60_000) return cached.value;

      const issuedAt = Math.floor(now() / 1000);
      const assertion = await signAssertion({
        iss: deps.credentials.client_email,
        scope: SHEETS_SCOPE,
        aud: deps.credentials.token_uri,
        iat: issuedAt,
        exp: issuedAt + 3600,
      });
      const response = await fetcher(deps.credentials.token_uri, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }),
      });
      if (!response.ok) {
        throw new Error(`Google OAuth failed (${response.status})`);
      }

      const token = tokenSchema.parse(await response.json());
      cached = {
        value: token.access_token,
        expiresAt: now() + token.expires_in * 1000,
      };
      return cached.value;
    },
  };
}
