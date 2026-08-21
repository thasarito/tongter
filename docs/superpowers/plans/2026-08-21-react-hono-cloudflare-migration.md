# React + Hono Cloudflare Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Next.js runtime with a React/Vite SPA and typed Hono API, deploy both in one Cloudflare Worker, and serve the complete wedding application at `https://warissara.thasarito.com`.

**Architecture:** Vite builds the React 19 client while the Cloudflare Vite plugin builds a Hono Worker that runs only for `/api/*`; all navigation falls back to the SPA shell. Pure wedding domain modules remain runtime-neutral, Hono RPC shares endpoint types with the browser, and a fetch-based Google Sheets adapter replaces `googleapis` in production.

**Tech Stack:** React 19, Vite, React Router, Hono, Hono RPC, Zod, Cloudflare Workers and static assets, Wrangler, Vitest, Testing Library, Playwright, Google OAuth 2 service-account JWT, Google Sheets REST API, pnpm.

---

## File Map

The implementation converges on this ownership model:

```text
index.html                         Vite HTML shell and static metadata
vite.config.ts                     React and Cloudflare Vite build
wrangler.jsonc                     Worker, assets, observability, domain
src/client/main.tsx                Browser bootstrap
src/client/App.tsx                 Router and global language provider
src/client/api/client.ts           Typed Hono RPC client
src/client/app/LanguageProvider.tsx Cookie-backed language state
src/client/routes/*.tsx            Route-level loading and error states
src/components/**                  Existing reusable presentation and 3D UI
src/shared/**                      Runtime-neutral domain, view, and validation logic
src/worker/app.ts                  Composed Hono routes and exported AppType
src/worker/index.ts                Production Worker entry point
src/worker/contracts.ts            Zod request and response contracts
src/worker/auth/admin-session.ts   Signed administrator session cookies
src/worker/google/oauth.ts         Service-account JWT and token cache
src/worker/google/sheets-api.ts    Google Sheets REST transport
src/worker/services/snapshot.ts    Snapshot parsing, cache, stale fallback, append
src/worker/routes/*.ts             Public and administrator endpoints
tests/e2e/*.spec.ts                Browser route and workflow smoke tests
.github/workflows/deploy.yml       Verified deployment from main
```

Next-specific files stay in place until the SPA routes and API reach parity. They are deleted only in Task 10.

---

### Task 1: Establish the Vite, Hono, and test harness alongside Next.js

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `wrangler.jsonc`
- Create: `src/client/main.tsx`
- Create: `src/client/App.tsx`
- Create: `src/worker/index.ts`
- Create: `src/worker/app.ts`
- Test: `src/worker/app.test.ts`

- [ ] **Step 1: Install the Cloudflare-native runtime and test dependencies**

Run:

```bash
pnpm remove @opennextjs/cloudflare
pnpm add hono react-router zod
pnpm add -D vite @vitejs/plugin-react @cloudflare/vite-plugin @cloudflare/workers-types vitest jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

Expected: `wrangler` remains in `devDependencies`; OpenNext is absent; the new packages are locked.

- [ ] **Step 2: Add a failing Worker health test**

Create `src/worker/app.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "./app";

describe("worker app", () => {
  it("returns a cache-safe health response", async () => {
    const response = await createApp().request("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the missing app failure**

Run: `pnpm vitest run src/worker/app.test.ts`

Expected: FAIL because `src/worker/app.ts` does not exist.

- [ ] **Step 4: Add the minimal Hono app and Worker entry**

Create `src/worker/app.ts`:

```ts
import { Hono } from "hono";

export function createApp() {
  return new Hono().get("/api/health", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ ok: true } as const, 200);
  });
}

export type AppType = ReturnType<typeof createApp>;
```

Create `src/worker/index.ts`:

```ts
import { createApp } from "./app";

export default createApp();
```

- [ ] **Step 5: Add the minimal client shell**

Create `index.html`:

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="description" content="ร่วมเป็นส่วนหนึ่งในวันสำคัญของเรา · Join us on our wedding day" />
    <title>Warissara & Thanat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

Create `src/client/App.tsx`:

```tsx
export default function App() {
  return <main aria-label="Wedding application" />;
}
```

Create `src/client/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Configure Vite and Cloudflare SPA routing**

Create `vite.config.ts`:

```ts
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
```

Create `vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/client/test-setup.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
```

Create `wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "warissara-wedding",
  "main": "./src/worker/index.ts",
  "compatibility_date": "2026-08-21",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "observability": { "enabled": true }
}
```

Create `src/client/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Add transitional scripts without removing the Next scripts**

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev:worker": "vite dev",
    "build:worker": "vite build",
    "preview:worker": "vite preview",
    "test": "vitest run"
  }
}
```

Keep `dev`, `build`, and `start` pointed at Next until Task 10.

- [ ] **Step 8: Ignore Cloudflare local state and verify the harness**

Append to `.gitignore`:

```gitignore
# Cloudflare local state and local Worker secrets
/.wrangler/
.dev.vars*
!.dev.vars.example

# Vite output
/dist/
```

Run:

```bash
pnpm vitest run src/worker/app.test.ts
pnpm build:worker
```

Expected: one health test passes and Vite emits client plus Worker build output.

- [ ] **Step 9: Commit the parallel runtime scaffold**

```bash
git add package.json pnpm-lock.yaml .gitignore index.html vite.config.ts wrangler.jsonc src/client src/worker
git commit -m "build: scaffold React Hono Worker runtime"
```

---

### Task 2: Make the domain and view modules runtime-neutral

**Files:**
- Create: `src/shared/`
- Move: `src/lib/dietary.ts`
- Move: `src/lib/guest-list.ts`
- Move: `src/lib/i18n.ts`
- Move: `src/lib/identity.ts`
- Move: `src/lib/mock-dataset.ts`
- Move: `src/lib/rsvp-form.ts`
- Move: `src/lib/search.ts`
- Move: `src/lib/seated-look.ts`
- Move: `src/lib/types.ts`
- Move: `src/lib/venue.ts`
- Move: `src/lib/walk-path.ts`
- Move: `src/lib/views/`
- Create: `src/shared/event-config.ts`
- Modify: `scripts/check-logic.ts`
- Modify: `scripts/check-look.ts`
- Modify: `scripts/check-sheets.ts`
- Modify: `scripts/check-venue.ts`
- Modify: `scripts/check-views.ts`
- Modify: `scripts/check-walk.ts`
- Modify: `scripts/make-sheet.ts`
- Modify: `scripts/push-to-sheet.ts`
- Modify: imports under `src/app/` during transition
- Modify: `src/components/NotFoundCard.tsx`
- Modify: `src/components/RsvpForm.tsx`
- Modify: `src/components/SeatReveal.tsx`
- Modify: `src/components/StatusNotice.tsx`
- Modify: `src/components/journey/GuestJourney.tsx`

- [ ] **Step 1: Record the current pure-logic baseline**

Run: `pnpm check`

Expected: all venue, logic, view, walk, and look checks pass before files move.

- [ ] **Step 2: Move pure modules without changing their implementations**

Run:

```bash
mkdir -p src/shared
git mv src/lib/dietary.ts src/shared/dietary.ts
git mv src/lib/guest-list.ts src/shared/guest-list.ts
git mv src/lib/i18n.ts src/shared/i18n.ts
git mv src/lib/identity.ts src/shared/identity.ts
git mv src/lib/mock-dataset.ts src/shared/mock-dataset.ts
git mv src/lib/rsvp-form.ts src/shared/rsvp-form.ts
git mv src/lib/search.ts src/shared/search.ts
git mv src/lib/seated-look.ts src/shared/seated-look.ts
git mv src/lib/types.ts src/shared/types.ts
git mv src/lib/venue.ts src/shared/venue.ts
git mv src/lib/walk-path.ts src/shared/walk-path.ts
git mv src/lib/views src/shared/views
```

Update imports so all moved modules refer only to `@/shared/*` or relative shared paths. Update scripts to use explicit `.ts` imports such as:

```ts
import { ALL_SEATS } from "../src/shared/venue.ts";
import { buildSeatView } from "../src/shared/views/build.ts";
```

- [ ] **Step 3: Split public event configuration from server environment access**

Create `src/shared/event-config.ts` by moving `event`, `dietaryOptions`, `allowDietaryOther`, and `siteUrl` from `src/lib/config.ts`. Define the public URL without a server-only dependency:

```ts
const viteSiteUrl = (
  import.meta as ImportMeta & { env?: { VITE_SITE_URL?: string } }
).env?.VITE_SITE_URL;
const nodeSiteUrl =
  typeof process === "undefined" ? undefined : process.env.NEXT_PUBLIC_SITE_URL;

export const siteUrl =
  viteSiteUrl ?? nodeSiteUrl ?? "https://warissara.thasarito.com";
```

Keep only `serverEnv()` in `src/lib/config.ts` until the old Next runtime is removed.

- [ ] **Step 4: Verify both the old runtime and pure checks still compile**

Run:

```bash
pnpm check
pnpm build
pnpm build:worker
```

Expected: all checks pass; both Next and Vite builds complete during the transition.

- [ ] **Step 5: Commit the runtime-neutral domain boundary**

```bash
git add src/shared src/lib src/app src/components scripts
git commit -m "refactor: isolate shared wedding domain modules"
```

---

### Task 3: Implement Google service-account OAuth with Web Crypto

**Files:**
- Create: `src/worker/env.ts`
- Create: `src/worker/google/oauth.ts`
- Test: `src/worker/google/oauth.test.ts`
- Create: `.dev.vars.example`

- [ ] **Step 1: Define Worker bindings and credential parsing**

Create `src/worker/env.ts`:

```ts
import { z } from "zod";

export interface WorkerBindings {
  GOOGLE_SHEET_ID: string;
  GOOGLE_CREDENTIALS_JSON: string;
  ADMIN_PASSPHRASE: string;
  ADMIN_SESSION_SECRET: string;
}

export const serviceAccountSchema = z.object({
  client_email: z.string().email(),
  private_key: z.string().min(1),
  token_uri: z.string().url().default("https://oauth2.googleapis.com/token"),
});

export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

export function parseServiceAccount(raw: string): ServiceAccount {
  return serviceAccountSchema.parse(JSON.parse(raw));
}
```

- [ ] **Step 2: Write failing OAuth tests using an injected signer**

Create `src/worker/google/oauth.test.ts` with tests that assert:

```ts
it("exchanges a correctly shaped assertion and caches the token", async () => {
  const calls: URLSearchParams[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    calls.push(new URLSearchParams(String(init?.body)));
    return Response.json({ access_token: "token-1", expires_in: 3600 });
  };
  const auth = createGoogleOAuth({
    credentials: {
      client_email: "wedding@example.iam.gserviceaccount.com",
      private_key: "unused-by-injected-signer",
      token_uri: "https://oauth2.googleapis.com/token",
    },
    fetcher,
    now: () => 1_700_000_000_000,
    signAssertion: async (claims) => {
      expect(claims.scope).toBe("https://www.googleapis.com/auth/spreadsheets");
      return "signed.jwt";
    },
  });

  await expect(auth.getAccessToken()).resolves.toBe("token-1");
  await expect(auth.getAccessToken()).resolves.toBe("token-1");
  expect(calls).toHaveLength(1);
  expect(calls[0].get("assertion")).toBe("signed.jwt");
});
```

Add tests for a rejected token response and refresh within 60 seconds of expiry.

- [ ] **Step 3: Run the focused test and confirm the missing implementation failure**

Run: `pnpm vitest run src/worker/google/oauth.test.ts`

Expected: FAIL because `createGoogleOAuth` is not defined.

- [ ] **Step 4: Implement JWT signing and token caching**

Create `src/worker/google/oauth.ts` with these public contracts and algorithm:

```ts
export interface GoogleClaims {
  iss: string;
  scope: "https://www.googleapis.com/auth/spreadsheets";
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

export function createGoogleOAuth(deps: OAuthDependencies): {
  getAccessToken(): Promise<string>;
} {
  const fetcher = deps.fetcher ?? fetch;
  const now = deps.now ?? Date.now;
  const signAssertion = deps.signAssertion ?? ((claims) => signServiceAccountJwt(deps.credentials, claims));
  let cached: { value: string; expiresAt: number } | null = null;

  return {
    async getAccessToken() {
      if (cached && cached.expiresAt - now() > 60_000) return cached.value;

      const issuedAt = Math.floor(now() / 1000);
      const assertion = await signAssertion({
        iss: deps.credentials.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: deps.credentials.token_uri,
        iat: issuedAt,
        exp: issuedAt + 3600,
      });
      const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      });
      const response = await fetcher(deps.credentials.token_uri, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok) throw new Error(`Google OAuth failed (${response.status})`);
      const token = z.object({ access_token: z.string(), expires_in: z.number().positive() })
        .parse(await response.json());
      cached = { value: token.access_token, expiresAt: now() + token.expires_in * 1000 };
      return cached.value;
    },
  };
}
```

Add `signServiceAccountJwt(credentials, claims)` in the same file. Strip the PEM header, footer, and whitespace; decode it with `atob`; import it as PKCS#8 using `crypto.subtle.importKey`; base64url-encode `{ "alg": "RS256", "typ": "JWT" }` and the claims; sign their dot-joined UTF-8 bytes with `RSASSA-PKCS1-v1_5`; and append the base64url signature. This function must never include the private key in thrown errors.

- [ ] **Step 5: Document local secret names without values**

Create `.dev.vars.example`:

```dotenv
GOOGLE_SHEET_ID=spreadsheet-id
GOOGLE_CREDENTIALS_JSON={"client_email":"service-account@example.iam.gserviceaccount.com","private_key":"PEM value","token_uri":"https://oauth2.googleapis.com/token"}
ADMIN_PASSPHRASE=local-only-passphrase
ADMIN_SESSION_SECRET=at-least-32-random-characters
```

- [ ] **Step 6: Verify and commit OAuth**

Run:

```bash
pnpm vitest run src/worker/google/oauth.test.ts
pnpm typecheck
```

Expected: OAuth tests and type checking pass.

```bash
git add src/worker/env.ts src/worker/google .dev.vars.example
git commit -m "feat: authenticate Google Sheets from Workers"
```

---

### Task 4: Replace `googleapis` with a tested Sheets REST repository

**Files:**
- Create: `src/shared/sheet-records.ts`
- Create: `src/worker/google/sheets-api.ts`
- Create: `src/worker/services/snapshot.ts`
- Test: `src/worker/google/sheets-api.test.ts`
- Test: `src/worker/services/snapshot.test.ts`
- Modify: `scripts/check-sheets.ts`

- [ ] **Step 1: Extract the existing row parsers into a runtime-neutral module**

Move `normaliseHeader`, `toRecords`, `parseGuests`, `parseGroups`, and `parseRsvps` from `src/lib/sheets.ts` into `src/shared/sheet-records.ts`. Export one entry point:

```ts
export function snapshotFromBatchValues(
  valueRanges: Array<{ values?: string[][] }> | undefined,
  fetchedAt: number,
): Snapshot {
  const warnings: string[] = [];
  const [guestRange, groupRange, rsvpRange] = valueRanges ?? [];
  return {
    status: "ok",
    guests: parseGuests(toRecords(guestRange?.values), warnings),
    groups: parseGroups(toRecords(groupRange?.values), warnings),
    rsvps: parseRsvps(toRecords(rsvpRange?.values)),
    warnings,
    fetchedAt,
  };
}
```

Extend `scripts/check-sheets.ts` to feed three in-memory ranges through this function and assert duplicate-token, invalid-seat, and parsed-RSVP behavior.

- [ ] **Step 2: Write failing REST transport tests**

Create `src/worker/google/sheets-api.test.ts`. Mock `fetch` and assert:

```ts
const api = createSheetsApi({
  spreadsheetId: "sheet-123",
  getAccessToken: async () => "access-123",
  fetcher,
});

await api.batchGet(["Guests!A1:Z", "Groups!A1:Z", "RSVP!A1:Z"]);
expect(request.headers.get("authorization")).toBe("Bearer access-123");
expect(new URL(request.url).searchParams.getAll("ranges")).toEqual([
  "Guests!A1:Z",
  "Groups!A1:Z",
  "RSVP!A1:Z",
]);
```

Also assert append uses `valueInputOption=RAW`, writes to `RSVP!A:I`, and retries only `429`, `500`, `502`, and `503` responses.

- [ ] **Step 3: Implement the REST transport**

Create `src/worker/google/sheets-api.ts` with:

```ts
export interface SheetsApi {
  batchGet(ranges: string[]): Promise<Array<{ values?: string[][] }>>;
  append(range: string, rows: string[][]): Promise<void>;
}

export function createSheetsApi(deps: {
  spreadsheetId: string;
  getAccessToken: () => Promise<string>;
  fetcher?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
}): SheetsApi;
```

Encode the spreadsheet ID and range path segments, use `URLSearchParams` for repeated ranges, set Bearer authorization, and use the existing 400/800/1600 ms retry schedule. Error messages contain the operation and status only.

- [ ] **Step 4: Write failing snapshot cache tests**

Create `src/worker/services/snapshot.test.ts` covering:

```ts
it("serves the last snapshot as stale when refresh fails", async () => {
  const repository = createSnapshotRepository({ api, now, ttlMs: 45_000 });
  await expect(repository.getSnapshot()).resolves.toMatchObject({ status: "ok" });
  nowMs += 46_000;
  failReads = true;
  await expect(repository.getSnapshot()).resolves.toMatchObject({ status: "stale" });
});
```

Also assert concurrent reads share one in-flight request, invalidation forces a read, and append invalidates the snapshot only after a successful Sheets append.

- [ ] **Step 5: Implement the repository**

Create `src/worker/services/snapshot.ts`:

```ts
export interface SnapshotRepository {
  getSnapshot(): Promise<Snapshot>;
  invalidate(): void;
  appendRsvp(input: RsvpSubmission): Promise<void>;
}

export interface RsvpSubmission {
  groupId: string;
  submittedBy: string;
  lang: string;
  entries: Array<{
    guestId: string;
    attending: boolean;
    dietary: string;
    message: string;
  }>;
}

export function createSnapshotRepository(deps: {
  api: SheetsApi;
  now?: () => number;
  ttlMs?: number;
}): SnapshotRepository;
```

Reuse `SHEET_TABS`, `RSVP_HEADERS`, the existing row serialization, and `snapshotFromBatchValues`. Keep one cached snapshot and one in-flight read in the repository closure.

- [ ] **Step 6: Verify and commit Sheets access**

Run:

```bash
pnpm vitest run src/worker/google/sheets-api.test.ts src/worker/services/snapshot.test.ts
pnpm check:sheets
pnpm typecheck
```

Expected: REST, cache, parser, and type checks pass.

```bash
git add src/shared/sheet-records.ts src/worker/google src/worker/services scripts/check-sheets.ts
git commit -m "feat: access wedding sheet through REST"
```

---

### Task 5: Expose the public typed Hono API

**Files:**
- Create: `src/worker/contracts.ts`
- Create: `src/worker/dependencies.ts`
- Create: `src/worker/routes/public.ts`
- Modify: `src/worker/app.ts`
- Modify: `src/worker/index.ts`
- Test: `src/worker/routes/public.test.ts`

- [ ] **Step 1: Write failing endpoint tests with an injected repository**

Create `src/worker/routes/public.test.ts` using `MOCK_SNAPSHOT` and a fake repository. Cover health, search minimum length, search result privacy, personal invite, group RSVP bootstrap, missing token, seat view, successful RSVP append, foreign guest IDs, and failed append.

The success assertion is:

```ts
const response = await app.request("/api/rsvp/group-a", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    submittedBy: "guest-1",
    lang: "en",
    answers: [{ guestId: "guest-1", attending: true, dietary: [], dietaryOther: "", message: "" }],
  }),
});

expect(response.status).toBe(201);
expect(await response.json()).toEqual({ ok: true, seatHref: "/seat/group-a?celebrate=1" });
expect(repository.appendRsvp).toHaveBeenCalledOnce();
```

The failed append response is `503` with `{ error: { code: "RSVP_WRITE_FAILED", message: "Please try again." } }`.

- [ ] **Step 2: Define request contracts and stable error responses**

Create `src/worker/contracts.ts` with Zod schemas for search query, language, route tokens, and RSVP JSON. The RSVP schema applies the same maximum lengths and dietary identifiers as `parseRsvpForm`. Export:

```ts
export const apiError = <Code extends string>(code: Code, message: string) => ({
  error: { code, message },
});
```

- [ ] **Step 3: Create production dependencies from Worker bindings**

Create `src/worker/dependencies.ts`:

```ts
export interface AppDependencies {
  repositoryFor(env: WorkerBindings): SnapshotRepository;
  now(): number;
}

export const productionDependencies: AppDependencies = {
  repositoryFor: repositoryForBindings,
  now: () => Date.now(),
};
```

`repositoryForBindings` caches a repository by the non-secret binding identity required for the current isolate and wires `parseServiceAccount`, `createGoogleOAuth`, and `createSheetsApi`.

- [ ] **Step 4: Implement and compose public routes**

Create `src/worker/routes/public.ts` as one chained Hono router with explicit response statuses. Build responses through the existing view builders. Each handler first obtains `const repository = deps.repositoryFor(c.env)` and `const snapshot = await repository.getSnapshot()`, then follows this exact mapping:

```ts
export function publicRoutes(deps: AppDependencies) {
  return new Hono<{ Bindings: WorkerBindings }>()
    .get("/health", (c) => {
      c.header("Cache-Control", "no-store");
      return c.json({ ok: true } as const, 200);
    })
    .get("/journey", async (c) => c.json(buildJourneyIntroView(
      await deps.repositoryFor(c.env).getSnapshot(),
      parseLang(c.req.query("lang")),
    ), 200))
    .get("/search", searchHandler(deps))
    .get("/journey/:guestToken", personalJourneyHandler(deps))
    .get("/rsvp/:groupToken", groupRsvpHandler(deps))
    .post("/rsvp/:groupToken", submitRsvpHandler(deps))
    .get("/seat/:groupToken", seatHandler(deps));
}
```

`searchHandler` validates `{ q, lang }` and returns `buildSearchView`. `personalJourneyHandler` resolves `findGuestByToken`, then returns `{ intro, flow: { view, selfGuestId } }` or the same `404` error envelope for every missing relationship. `groupRsvpHandler` resolves `findGroupByToken` and returns `{ intro, choices, view }`, where choices contain only `guestId` and localized name. `submitRsvpHandler` validates JSON, re-resolves group membership from the snapshot, converts answers into the existing append row shape, returns `201` with `seatHref` after success, `400` for invalid input, `404` for an invalid token, and `503` after a logged append failure. `seatHandler` passes `celebrate === "1"`, `guest`, and `debug === "1"` into `buildSeatView` and returns either the view or `404`.

Mount it in `src/worker/app.ts` with `.route("/api", publicRoutes(deps))`. Export the chained return type as `AppType`. The default export in `src/worker/index.ts` uses `productionDependencies`.

Apply Hono's `bodyLimit` middleware with `maxSize: 64 * 1024` to `/api/rsvp/*` and `/api/admin/login`, and `secureHeaders` to all API responses. Reject a non-JSON RSVP request with `415` before reading its body.

- [ ] **Step 5: Verify response typing and endpoint behavior**

Run:

```bash
pnpm vitest run src/worker/routes/public.test.ts
pnpm typecheck
pnpm build:worker
```

Expected: all public endpoint tests pass and the Worker bundle builds.

- [ ] **Step 6: Commit the public API**

```bash
git add src/worker
git commit -m "feat: expose typed wedding API"
```

---

### Task 6: Implement signed administrator sessions and API routes

**Files:**
- Create: `src/worker/auth/admin-session.ts`
- Create: `src/worker/routes/admin.ts`
- Modify: `src/worker/app.ts`
- Test: `src/worker/auth/admin-session.test.ts`
- Test: `src/worker/routes/admin.test.ts`

- [ ] **Step 1: Write failing session tests**

Create tests proving that a session round-trips, expires after 12 hours, rejects a changed payload, and rejects a changed signature:

```ts
const secret = "0123456789abcdef0123456789abcdef";
const now = () => 1_700_000_000_000;
const token = await createAdminSession({
  secret,
  now: () => 1_700_000_000_000,
});
await expect(verifyAdminSession(token, { secret, now })).resolves.toBe(true);
```

- [ ] **Step 2: Implement constant-time passphrase checks and HMAC sessions**

Create `src/worker/auth/admin-session.ts` exporting:

```ts
export const ADMIN_COOKIE = "wedding-admin";
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 12;

export async function passphraseMatches(candidate: string, expected: string): Promise<boolean>;
export async function createAdminSession(input: { secret: string; now?: () => number }): Promise<string>;
export async function verifyAdminSession(
  token: string,
  input: { secret: string; now?: () => number },
): Promise<boolean>;
```

Use SHA-256 digests for constant-time passphrase comparison and HMAC SHA-256 over a base64url JSON payload `{ "exp": epochSeconds }` for the cookie value.

- [ ] **Step 3: Write failing administrator route tests**

Cover bad login (`401`), good login (`204` plus Secure/HttpOnly/SameSite cookie), unauthenticated summary (`401`), authenticated summary (`200`), sync cache invalidation (`204`), logout expiration, and QR data.

- [ ] **Step 4: Implement administrator middleware and routes**

Create `src/worker/routes/admin.ts` with:

```ts
POST /login
POST /logout
POST /sync
GET  /summary
GET  /qr
```

Use Hono cookie helpers. The login cookie has `path: "/api/admin"`, `httpOnly: true`, `secure: true`, `sameSite: "Lax"`, and `maxAge: ADMIN_MAX_AGE_SECONDS`. Logout expires the cookie with the identical path. Summary returns `buildAdminView`; QR returns `buildQrSheetView` data and lets the browser render QR SVGs.

- [ ] **Step 5: Verify and commit administrator API behavior**

Run:

```bash
pnpm vitest run src/worker/auth/admin-session.test.ts src/worker/routes/admin.test.ts
pnpm typecheck
```

Expected: authentication and administrator API tests pass.

```bash
git add src/worker/auth src/worker/routes src/worker/app.ts
git commit -m "feat: add secure administrator API"
```

---

### Task 7: Build the SPA shell, language state, typed client, and route loaders

**Files:**
- Create: `src/client/api/client.ts`
- Create: `src/client/app/LanguageProvider.tsx`
- Create: `src/client/app/RouteStatus.tsx`
- Create: `src/client/routes/HomeRoute.tsx`
- Create: `src/client/routes/SearchRoute.tsx`
- Create: `src/client/routes/PersonalInviteRoute.tsx`
- Create: `src/client/routes/GroupRsvpRoute.tsx`
- Create: `src/client/routes/SeatRoute.tsx`
- Create: `src/client/routes/AdminRoute.tsx`
- Create: `src/client/routes/AdminQrRoute.tsx`
- Create: `src/client/routes/VenueDebugRoute.tsx`
- Modify: `src/client/App.tsx`
- Modify: `src/client/main.tsx`
- Move: `src/app/globals.css` to `src/client/globals.css`
- Move: `src/app/favicon.ico` to `public/favicon.ico`
- Test: `src/client/App.test.tsx`

- [ ] **Step 1: Write failing route and language tests**

Use `createMemoryRouter` and Testing Library to assert `/`, `/rsvp`, `/i/personal-a`, `/rsvp/group-a`, `/seat/group-a`, `/admin`, `/admin/qr`, and `/debug/venue` select the correct route module. Assert language initializes from `wedding-lang=en`, updates `<html lang>`, and writes a one-year SameSite cookie.

- [ ] **Step 2: Add the typed same-origin API client**

Create `src/client/api/client.ts`:

```ts
import { hc } from "hono/client";
import type { AppType } from "@/worker/app";

export const api = hc<AppType>(window.location.origin, {
  init: { credentials: "include" },
});
```

- [ ] **Step 3: Implement language ownership in the browser**

Create `LanguageProvider` exposing `{ lang, setLang }`. Read only `th` or `en` from `document.cookie`, default to `th`, update `document.documentElement.lang`, and persist:

```ts
document.cookie = `wedding-lang=${next}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
```

Modify `LangToggle` to call the provider rather than the Next server action.

- [ ] **Step 4: Compose React Router and lazy route modules**

Implement `src/client/App.tsx` with `createBrowserRouter` and `RouterProvider`. Use exact paths:

```tsx
const router = createBrowserRouter([
  { path: "/", element: <HomeRoute /> },
  { path: "/rsvp", element: <SearchRoute /> },
  { path: "/rsvp/:token", element: <GroupRsvpRoute /> },
  { path: "/i/:guestToken", element: <PersonalInviteRoute /> },
  { path: "/seat/:token", element: <SeatRoute /> },
  { path: "/admin", element: <AdminRoute /> },
  { path: "/admin/qr", element: <AdminQrRoute /> },
  { path: "/debug/venue", element: <VenueDebugRoute /> },
  { path: "*", element: <NotFoundRoute /> },
]);
```

Wrap the router in `LanguageProvider`. Each data route uses an abortable effect, renders a stable loading state, distinguishes `404`, `401`, and `503`, and ignores state updates after unmount.

- [ ] **Step 5: Move global CSS and replace Next fonts**

Move `src/app/globals.css` to `src/client/globals.css`, import it from `src/client/main.tsx`, and add Google Fonts stylesheet links to `index.html` for Cormorant Garamond, Noto Serif Thai, and Noto Sans Thai. Define the same CSS custom properties on `:root` so typography remains unchanged.

Move `src/app/favicon.ico` to `public/favicon.ico` and add `<link rel="icon" href="/favicon.ico" />` to `index.html` before Task 10 removes `src/app`.

- [ ] **Step 6: Verify route selection and compile-time API inference**

Run:

```bash
pnpm vitest run src/client/App.test.tsx
pnpm typecheck
pnpm build:worker
```

Expected: route and language tests pass; Vite builds the SPA.

- [ ] **Step 7: Commit the SPA shell**

```bash
git add index.html src/client src/components/LangToggle.tsx
git commit -m "feat: add typed wedding SPA routes"
```

---

### Task 8: Port the guest journey, RSVP, search, and seating UI

**Files:**
- Modify: `src/components/GuestSearch.tsx`
- Modify: `src/components/RsvpForm.tsx`
- Modify: `src/components/SeatReveal.tsx`
- Modify: `src/components/SiteHeader.tsx`
- Modify: `src/components/journey/GuestJourney.tsx`
- Modify: `src/components/GuestSearch.tsx`
- Modify: `src/components/LangToggle.tsx`
- Modify: `src/components/NotFoundCard.tsx`
- Modify: `src/components/StatusNotice.tsx`
- Modify: `src/components/journey/GateTransition.tsx`
- Modify: `src/components/journey/InvitationCard.tsx`
- Modify: `src/components/journey/LogoReveal.tsx`
- Modify: `src/components/journey/SidePicker.tsx`
- Modify: `src/client/routes/HomeRoute.tsx`
- Modify: `src/client/routes/SearchRoute.tsx`
- Modify: `src/client/routes/PersonalInviteRoute.tsx`
- Modify: `src/client/routes/GroupRsvpRoute.tsx`
- Modify: `src/client/routes/SeatRoute.tsx`
- Test: `src/client/routes/guest-flow.test.tsx`

- [ ] **Step 1: Write failing guest-flow tests**

Mock the typed API and assert:

- Home loads the intro and resumes local identity.
- Search waits for two characters and renders only safe search fields.
- A personal token opens the identified guest's card.
- A group token shows only that group's person choices.
- RSVP failure retains entered values and offers retry.
- RSVP success navigates to the returned `seatHref`.
- Seat route passes `celebrate`, `guest`, and `debug` query values.

The RSVP failure assertion must verify the form remains mounted:

```tsx
await user.click(screen.getByRole("button", { name: /submit|ส่งคำตอบ/i }));
expect(await screen.findByText(/please try again|กรุณาลองใหม่/i)).toBeVisible();
expect(screen.getByDisplayValue("A message that must survive")).toBeVisible();
```

- [ ] **Step 2: Replace Next navigation primitives**

Replace `next/link` with React Router `Link`, `redirect` with `useNavigate`, and `next/dynamic` with `React.lazy` plus `Suspense`. Preserve every current href and query string.

- [ ] **Step 3: Replace server actions with typed API calls**

`GuestJourney` receives loader data from routes and requests chosen-person details through `api.api.journey` or the group bootstrap payload. `RsvpForm` serializes its controlled state to JSON and calls the typed RSVP endpoint. Do not use native server-action props or `useActionState`.

Use an explicit mutation state:

```ts
type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };
```

- [ ] **Step 4: Preserve client-only identity and 3D loading behavior**

Keep the current localStorage identity key and validation rules. Load the Three.js walkthrough lazily only after the seat route is selected. Preserve reduced-motion and debug query behavior.

- [ ] **Step 5: Run focused UI tests and all geometry/domain checks**

Run:

```bash
pnpm vitest run src/client/routes/guest-flow.test.tsx
pnpm check
pnpm build:worker
```

Expected: guest-flow tests, 170-seat checks, route checks, walk checks, look checks, and Worker build pass.

- [ ] **Step 6: Commit public route parity**

```bash
git add src/client/routes src/components
git commit -m "feat: port guest journey to React SPA"
```

---

### Task 9: Port the administrator dashboard and printable QR cards

**Files:**
- Modify: `src/components/admin/AdminActions.tsx`
- Modify: `src/components/admin/AdminLogin.tsx`
- Modify: `src/client/routes/AdminRoute.tsx`
- Modify: `src/client/routes/AdminQrRoute.tsx`
- Test: `src/client/routes/admin-flow.test.tsx`

- [ ] **Step 1: Write failing administrator browser tests**

Cover login failure, login success followed by summary refresh, sync, logout, unauthorized expiry, QR card rendering, and print navigation. Mock API responses and assert no passphrase remains in the DOM after submission.

- [ ] **Step 2: Port login and dashboard actions**

Replace Next action forms with controlled fetch mutations through Hono RPC. After login, refetch summary. After `401`, render the login form. After sync, refetch and show the new `fetchedAt`. After logout, clear dashboard state.

- [ ] **Step 3: Render QR SVGs in the browser**

Use the existing `qrcode` dependency in `AdminQrRoute`. Fetch authenticated card data, call `QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#2f2a26", light: "#00000000" } })`, and preserve existing print CSS and two-card row layout.

- [ ] **Step 4: Verify and commit administrator parity**

Run:

```bash
pnpm vitest run src/client/routes/admin-flow.test.tsx
pnpm typecheck
pnpm build:worker
```

Expected: administrator flows pass and the client bundle builds.

```bash
git add src/client/routes src/components/admin
git commit -m "feat: port wedding administration to SPA"
```

---

### Task 10: Remove Next.js and make Vite the only application runtime

**Files:**
- Delete: `src/app/`
- Delete: `src/lib/admin-auth.ts`
- Delete: `src/lib/config.ts`
- Delete: `src/lib/lang.ts`
- Delete: `src/lib/mock-data.ts`
- Delete: `src/lib/sheets.ts`
- Delete: `next.config.ts`
- Delete: `Dockerfile`
- Delete: `docker-compose.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Modify: `eslint.config.mjs`
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Prove no live code imports Next or old server modules**

Run:

```bash
rg -n 'from "next|from ''next|@/app|@/lib/(admin-auth|config|lang|mock-data|sheets)' src scripts
```

Expected: no matches outside the files scheduled for deletion. Resolve any match before continuing.

- [ ] **Step 2: Remove the old runtime files and dependencies**

Run:

```bash
git rm -r src/app
git rm src/lib/admin-auth.ts src/lib/config.ts src/lib/lang.ts src/lib/mock-data.ts src/lib/sheets.ts
git rm next.config.ts Dockerfile docker-compose.yml
pnpm remove next eslint-config-next googleapis server-only
```

Retain `exceljs` because the sheet-generation scripts use it.

- [ ] **Step 3: Promote Vite scripts and include every verification layer**

Set the scripts in `package.json` to:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "pnpm check && wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "check": "pnpm typecheck && pnpm test && pnpm check:venue && pnpm check:logic && pnpm check:views && pnpm check:walk && pnpm check:look"
  }
}
```

Keep all existing sheet and domain scripts unchanged.

- [ ] **Step 4: Remove Next-specific TypeScript and ESLint configuration**

In `tsconfig.json`, remove the Next plugin, `.next` includes, `incremental`, and `next-env.d.ts`. Include `src`, `scripts`, `vite.config.ts`, and `vitest.config.ts` if created. Add `types: ["vite/client", "@cloudflare/workers-types"]`.

Replace `eslint.config.mjs` with flat ESLint TypeScript/React configuration using `typescript-eslint`, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`; ignore `dist`, `.wrangler`, and `coverage`.

Install those configuration dependencies before editing the file:

```bash
pnpm add -D typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

- [ ] **Step 5: Rewrite operational documentation**

Update `README.md` with:

```text
pnpm dev                 local React + Worker runtime
cp .dev.vars.example .dev.vars
pnpm check               complete verification
pnpm preview             production Worker preview
pnpm deploy              verified Cloudflare deployment
```

Update `.env.example` to retain only script-side values and point runtime users to `.dev.vars.example`.

- [ ] **Step 6: Run the full runtime-removal gate**

Run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm build
rg -n 'next/|next.config|\.next|OpenNext|googleapis' --glob '!docs/superpowers/**' --glob '!pnpm-lock.yaml' .
```

Expected: install, complete checks, lint, and build pass; the final search has no application-runtime matches.

- [ ] **Step 7: Commit the runtime cutover**

```bash
git add -A
git commit -m "refactor: replace Next.js with React and Hono"
```

---

### Task 11: Add browser and local Worker-runtime verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/public-routes.spec.ts`
- Create: `tests/e2e/rsvp.spec.ts`
- Create: `tests/e2e/admin.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Configure Playwright against a production preview**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});
```

- [ ] **Step 2: Add deterministic mock-mode runtime data**

Add `MOCK_SHEET` to `WorkerBindings` and make `repositoryForBindings` return an in-memory repository built from `buildMockDataset({ readableTokens: true })` only when `MOCK_SHEET === "1"`. Keep submitted rows in a closure-local array and append them after the fixture RSVP rows so latest-row-wins behavior remains realistic. Put `MOCK_SHEET=1` in local Playwright configuration, never in production secrets.

- [ ] **Step 3: Add browser smoke tests**

`public-routes.spec.ts` checks direct navigation and refresh for every public route, language persistence, unknown token handling, and the 3D debug route.

`rsvp.spec.ts` completes one mock RSVP and verifies navigation to the seat reveal.

`admin.spec.ts` logs in with the local mock passphrase, checks dashboard totals, opens QR cards, and logs out.

Use role- or label-based locators, never CSS implementation selectors.

- [ ] **Step 4: Add scripts and run the browser gate**

Add:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "check": "pnpm typecheck && pnpm test && pnpm check:venue && pnpm check:logic && pnpm check:views && pnpm check:walk && pnpm check:look && pnpm build"
  }
}
```

Run:

```bash
pnpm exec playwright install chromium
pnpm check
pnpm lint
pnpm test:e2e
```

Expected: all unit/domain checks pass, production build succeeds, and desktop/mobile browser projects pass.

- [ ] **Step 5: Commit production smoke coverage**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts tests src/worker
git commit -m "test: cover Worker wedding flows end to end"
```

---

### Task 12: Configure continuous deployment and the custom domain

**Files:**
- Modify: `wrangler.jsonc`
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1: Add verified GitHub deployment**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: production
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.28.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm lint
      - run: pnpm exec wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Authenticate Wrangler and verify the target account**

Run:

```bash
pnpm wrangler login
pnpm wrangler whoami
```

Expected: Wrangler reports the Cloudflare account that owns `thasarito.com` and Workers edit permissions.

- [ ] **Step 3: Upload application secrets interactively**

Run each command and paste only the value at Wrangler's hidden prompt:

```bash
pnpm wrangler secret put GOOGLE_SHEET_ID
pnpm wrangler secret put GOOGLE_CREDENTIALS_JSON
pnpm wrangler secret put ADMIN_PASSPHRASE
pnpm wrangler secret put ADMIN_SESSION_SECRET
```

Generate `ADMIN_SESSION_SECRET` with a cryptographically secure 32-byte or longer random value. Never print or commit the values.

Create a scoped Cloudflare API token in the Cloudflare dashboard with Account Workers Scripts Edit, Account Account Settings Read, Zone Workers Routes Edit, and Zone DNS Edit for `thasarito.com`. Add it and the account ID to GitHub without echoing either value:

```bash
read -rsp "Cloudflare deploy token: " WEDDING_CF_DEPLOY_TOKEN
printf '%s' "$WEDDING_CF_DEPLOY_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN --repo thasarito/tongter
unset WEDDING_CF_DEPLOY_TOKEN
read -rp "Cloudflare account ID: " WEDDING_CF_ACCOUNT_ID
printf '%s' "$WEDDING_CF_ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID --repo thasarito/tongter
unset WEDDING_CF_ACCOUNT_ID
gh secret list --repo thasarito/tongter
```

Expected: the list contains both secret names without exposing their values.

- [ ] **Step 4: Run the complete predeployment gate and commit deployment config**

Run:

```bash
pnpm check
pnpm lint
pnpm test:e2e
git diff --check
```

Expected: all commands exit zero.

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: deploy wedding app to Cloudflare"
```

- [ ] **Step 5: Deploy first to the temporary Worker hostname and verify Sheets access**

Run:

```bash
WEDDING_DEPLOY_OUTPUT=$(pnpm exec wrangler deploy 2>&1 | tee /dev/stderr)
WEDDING_WORKER_URL=$(printf '%s\n' "$WEDDING_DEPLOY_OUTPUT" | rg -o 'https://[^ ]+\.workers\.dev' | tail -1)
test -n "$WEDDING_WORKER_URL"
curl --fail --silent --show-error "$WEDDING_WORKER_URL/api/health"
```

The health response must be `{"ok":true}`. Open a known invitation URL on the `workers.dev` hostname, load current Sheets data, and perform one reversible test RSVP before proceeding. Remove the test row from the spreadsheet after confirming the append.

- [ ] **Step 6: Add and deploy the custom domain**

Add to `wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "warissara.thasarito.com", "custom_domain": true }
]
```

Do not create a separate manual A or CNAME record; the custom-domain deployment owns the Cloudflare DNS record and certificate.

Run:

```bash
git add wrangler.jsonc
git commit -m "deploy: attach wedding custom domain"
pnpm exec wrangler deploy
```

- [ ] **Step 7: Verify DNS, TLS, and HTTP behavior**

Deploy the configuration containing the custom-domain route, then run:

```bash
dig +short warissara.thasarito.com
curl --fail --silent --show-error https://warissara.thasarito.com/api/health
curl --fail --silent --show-error -I https://warissara.thasarito.com/
```

Expected: DNS resolves through Cloudflare, health returns `{"ok":true}`, the root returns `200`, and TLS validates without curl overrides.

- [ ] **Step 8: Push and verify automatic deployment**

Run:

```bash
git push origin main
gh run watch --repo thasarito/tongter --exit-status
git status --short --branch
```

Expected: the GitHub workflow completes successfully and the local tree is clean and tracks `origin/main`.

- [ ] **Step 9: Perform the production acceptance check**

Verify in a real browser at `https://warissara.thasarito.com`:

- Home journey loads and language survives refresh.
- Known personal and group invitation links resolve.
- RSVP reads existing values, submits, and reaches the correct seat.
- Seat walkthrough and look controls work on desktop and mobile.
- Administrator login, sync, dashboard, QR cards, and logout work.
- Unknown tokens show the safe not-found state.
- Browser console and Worker logs contain no secrets or guest-list dumps.

Record the deployed Git SHA and Cloudflare version in the final handoff.
