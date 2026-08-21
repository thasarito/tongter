import { z } from "zod";

export interface WorkerBindings {
  GOOGLE_SHEET_ID: string;
  GOOGLE_CREDENTIALS_JSON: string;
  ADMIN_PASSPHRASE: string;
  ADMIN_SESSION_SECRET: string;
  MOCK_SHEET?: string;
}

export const serviceAccountSchema = z.object({
  client_email: z.email(),
  private_key: z.string().min(1),
  token_uri: z
    .url()
    .default("https://oauth2.googleapis.com/token"),
});

export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

export function parseServiceAccount(raw: string): ServiceAccount {
  return serviceAccountSchema.parse(JSON.parse(raw));
}
