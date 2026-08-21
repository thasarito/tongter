export {
  allowDietaryOther,
  dietaryOptions,
  event,
  siteUrl,
} from "@/shared/event-config";

/** Server-only environment used by the transitional Next.js runtime. */
export function serverEnv() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  const adminPassphrase = process.env.ADMIN_PASSPHRASE;

  return { sheetId, credentialsPath, credentialsJson, adminPassphrase };
}
