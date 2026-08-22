# Wedding RSVP — warissara.thasarito.com

Bilingual Thai/English wedding Save the Date, invitation, and RSVP application.
The React client and Hono API are deployed together as one Cloudflare Worker;
Google Sheets remains the only data store.

## Stack

- React 19, React Router, Vite, Tailwind CSS
- Hono on Cloudflare Workers
- Google Sheets REST API authenticated with a service-account JWT
- Vitest for unit/integration tests and Playwright for browser checks

## Local development

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

Set `MOCK_SHEET=1` in `.dev.vars` to use the 170-person fixture without Google
credentials. Vite serves the SPA and Worker API from the same local origin.

Useful checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm check
pnpm check:sheets -- --no-write
```

## Worker configuration

Production secrets are stored with Wrangler, never committed:

| Secret | Purpose |
|---|---|
| `GOOGLE_SHEET_ID` | Spreadsheet ID from the Google Sheets URL |
| `GOOGLE_CREDENTIALS_JSON` | Complete service-account key JSON |
| `ADMIN_PASSPHRASE` | Passphrase for `/admin` |
| `ADMIN_SESSION_SECRET` | Random key used to sign admin session cookies |

For local development the same keys may be placed in `.dev.vars`. Event copy,
venue details, dietary options, and the canonical site URL live in
`src/shared/event-config.ts`.

The sheet has three tabs:

- `Guests`: `guest_id | name_th | name_en | group_id | table_id | seat_index | side | tags | token`
- `Groups`: `group_id | label_th | label_en | token`
- `RSVP`: `timestamp | group_id | guest_id | attending | dietary | message | submitted_by | lang`

RSVP writes are append-only. Current state is the last row per `guest_id`.

## Routes

| Route | Purpose |
|---|---|
| `/` | Animated Save the Date landing and calendar links; `?calendar=apple` swaps the chooser for the Apple download action |
| `/i/:guestToken` | Personal invitation |
| `/rsvp` | Guest-name search |
| `/rsvp/:groupToken` | Group invitation and RSVP |
| `/seat/:groupToken` | 3D seat reveal and 2D fallback |
| `/admin` | Passphrase-protected dashboard |
| `/admin/qr` | Printable group QR cards |
| `/debug/venue` | Venue geometry diagnostic |
| `/api/calendar/google` | Redirect to a prefilled Google Calendar event |
| `/api/calendar/download` | Download the wedding as a local `.ics` attachment |
| `/api/calendar/wedding.ics` | Legacy direct ICS endpoint kept for compatibility |

API endpoints live under `/api`. Static routes use Cloudflare's SPA fallback;
the Worker runs first only for `/api/*`.

## LINE and calendar handoff

Printable URLs from `/admin/qr` append `openExternalBrowser=1`. When a guest
scans one inside LINE, LINE opens the RSVP page in Safari or Chrome instead of
keeping the whole RSVP and calendar flow inside its embedded browser. Existing
bare `/rsvp/:groupToken` links remain valid.

Google Calendar uses a same-origin redirect endpoint. Apple Calendar is
intentionally different: opening a remote `.ics` URL on iPhone invokes the
subscription-calendar flow. The Apple option therefore opens the same Save the
Date page at `/?calendar=apple&lang=<lang>` in Safari. The artwork, monogram,
date, venue, and language control remain unchanged; only the calendar chooser is
replaced by a direct **Download calendar file** action and a short import hint.
That action downloads the single event from `/api/calendar/download` as an
attachment. The UI never sends Apple Calendar the Worker URL as a subscription
feed.

LIFF is optional. To enable the stronger LIFF handoff:

1. Configure a LIFF app, or a LINE MINI App with LIFF compatibility, whose
   endpoint URL is `https://warissara.thasarito.com`.
2. Set the public build-time variable `VITE_LIFF_ID` locally or as a GitHub
   Actions repository variable.
3. Share `https://liff.line.me/<LIFF_ID>/rsvp/<groupToken>` when a LIFF launch is
   preferred.

Inside the LIFF browser, the client initializes the LIFF SDK and opens Google or
the root Apple query mode with `liff.openWindow({ external: true })`. If LIFF is
not configured or initialization fails, the links degrade to ordinary browser
navigation.

## Deployment

```bash
pnpm wrangler login
pnpm deploy:cloudflare
```

`wrangler.jsonc` binds the Worker to `warissara.thasarito.com/*`. The hostname's
existing proxied Cloudflare DNS record supplies edge routing and TLS; the Worker
route intercepts requests before they reach the former origin.

GitHub Actions verifies pull requests without deploying them. Merges and direct
pushes to `main` can deploy when the repository has these secrets:

- `CLOUDFLARE_API_TOKEN` — token with Workers Scripts edit and zone DNS access
- `CLOUDFLARE_ACCOUNT_ID`

Set the optional non-secret repository variable `VITE_LIFF_ID` to include LIFF
support in production builds.

## Project layout

```text
src/client/     React application, routes, API adapters
src/components/ reusable wedding UI and 3D venue components
src/shared/     pure domain types, view builders, fixture data, venue geometry
src/worker/     Hono routes, auth, Google OAuth and Sheets REST client
scripts/        sheet setup and deterministic domain checks
```

The service-account key under `secrets/` and all `.env`/`.dev.vars` files are
gitignored.
