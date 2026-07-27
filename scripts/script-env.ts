import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Environment loading for the standalone scripts, which run under plain node
 * rather than Next and so do not get .env for free.
 */

export function loadEnv(file = ".env"): void {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      // Real environment variables win over the file.
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2];
      }
    }
  } catch {
    // Fine if the variables are already exported, or there is no .env yet.
  }
}

export interface Credentials {
  /** Path to a key file, if that is how credentials are supplied. */
  keyFile?: string;
  /** Inline key JSON, if that is how credentials are supplied. */
  json?: string;
  /** Set when the configured path was missing and a local file was used. */
  note?: string;
}

/** The path the container mounts the key at, which does not exist on the host. */
const CONTAINER_PATH = "/app/secrets/google-service-account.json";
const LOCAL_PATH = "secrets/google-service-account.json";

/**
 * Resolves credentials for a host-side script.
 *
 * GOOGLE_APPLICATION_CREDENTIALS is written for the container, so when a script
 * runs on the host that path is absent. Rather than failing on a path that is
 * correct for production, fall back to the same key in the working tree.
 */
export function resolveCredentials(): Credentials | null {
  const json = process.env.GOOGLE_CREDENTIALS_JSON;
  if (json) return { json };

  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (configured && existsSync(configured)) return { keyFile: configured };

  if (existsSync(LOCAL_PATH)) {
    const note =
      configured && configured !== LOCAL_PATH
        ? `${configured} does not exist on this machine (it is the container path); ` +
          `using ${resolve(LOCAL_PATH)} instead`
        : undefined;
    return { keyFile: LOCAL_PATH, note };
  }

  if (configured === CONTAINER_PATH || !configured) return null;
  return null;
}
