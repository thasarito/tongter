# Wedding RSVP — warissara.thasarito.com

Bilingual (Thai/English) RSVP site for a 170-guest wedding. Guests find
themselves by name or by a private QR link, RSVP for everyone in their group,
and are then walked to their seat in a 3D model of the hall.

- **Guest list**: a Google Sheet, live — there is no database
- **Access**: private per-group QR links *and* name search
- **Hosting**: Docker on this box, behind the Caddy that already serves
  `*.thasarito.com`
- **3D**: first-person walk from the entrance to the chair, with a plan-view
  fallback that works without WebGL or JavaScript

## Quick start

```bash
pnpm install
cp .env.example .env          # then fill it in — see Configuration
pnpm dev                      # http://localhost:3000
```

To click through the whole site before the Google Sheet exists, run against
generated fixture data:

```bash
MOCK_SHEET=1 pnpm dev
```

Mock mode gives 170 named guests in ~54 groups with readable tokens, so
`/rsvp/demo001`, `/rsvp/demo002`, … all work, and some groups have already
replied.

## Setting up the Google Sheet

`pnpm sheet` writes import-ready spreadsheets to `out/sheet/`:

| File | Use |
|---|---|
| `wedding-sheet-demo.xlsx` | All 170 seats filled with mock guests and some replies — import this to see the site working end to end |
| `wedding-sheet-blank.xlsx` | The same three tabs, with `table_id`/`seat_index` prefilled and names blank — use this for the real guest list |
| `demo-*.csv`, `blank-*.csv` | The same data, one file per tab |

Either import one of those, or start from an empty sheet and let the script fill
it. **You have to create the file yourself** — see the note below on why the
service account cannot.

**Option A — let the script build it (recommended)**

1. Open <https://sheets.new> and give it a name. It lands in *your* Drive, owned
   by you.
2. Share → paste the service account address → **Editor**:

   ```
   wedding-rsvp@warissara-wedding-rsvp.iam.gserviceaccount.com
   ```

3. Put the sheet ID from the URL into `GOOGLE_SHEET_ID` in `.env`.
4. `pnpm push:sheet --demo` — creates the three tabs, fills them, freezes the
   headers, sets column widths, adds a `bride`/`groom` dropdown, and marks the
   RSVP tab as protected. Use `pnpm push:sheet` (no flag) for the blank
   scaffold, and `--force` to overwrite rows that are already there.
5. `pnpm check:sheets` to confirm.

**Option B — import the workbook**

Upload `wedding-sheet-demo.xlsx` to Drive, open it with Google Sheets, then do
steps 2, 3 and 5 above.

> **Why not have the service account create it?** Service accounts get no Google
> Drive storage — `drive.about.get` reports `storageQuota.limit: 0` — so any
> attempt returns `storageQuotaExceeded`. Only a real user (or a Workspace
> shared drive) can own the file. This is the better arrangement regardless: the
> sheet stays in your Drive and survives the GCP project being deleted.

### Google Cloud (already provisioned)

| | |
|---|---|
| Project | `warissara-wedding-rsvp` ("Wedding RSVP") |
| APIs enabled | `sheets.googleapis.com`, `drive.googleapis.com` |
| Service account | `wedding-rsvp@warissara-wedding-rsvp.iam.gserviceaccount.com` |
| Key | `secrets/google-service-account.json` (gitignored) |

Permissions are `700` on `secrets/` and `644` on the key, not `600` on the key.
The container runs as uid 1001 while the file is owned by uid 1000, so a
mode-600 key locks the app out of its own credential; locking the directory
instead keeps it private on the host while the bind mount stays readable.

Two more things that catch people out:

- The service account deliberately holds **no project IAM roles**. Access to a
  spreadsheet comes *only* from sharing that spreadsheet with its address —
  granting it Editor on the project does nothing.
- `GOOGLE_APPLICATION_CREDENTIALS` in `.env` is the **container** path
  (`/app/secrets/...`). Scripts run on the host fall back to
  `secrets/google-service-account.json` automatically and say so.

To rotate the key:

```bash
gcloud iam service-accounts keys list --iam-account=wedding-rsvp@warissara-wedding-rsvp.iam.gserviceaccount.com
gcloud iam service-accounts keys create secrets/google-service-account.json --iam-account=...
gcloud iam service-accounts keys delete <OLD_KEY_ID> --iam-account=...
```

### Sheet schema

**`Guests`** — one row per seat, 170 rows:

`guest_id | name_th | name_en | group_id | table_id | seat_index | side | tags`

- `side`: `bride` or `groom` — drives the pink/blue colouring
- `tags`: comma-separated, optional

**`Groups`** — one row per group that RSVPs together:

`group_id | label_th | label_en | token`

- `token` is the secret in the QR link. Keep them unique; the app warns if not.

**`RSVP`** — written by the app, **append-only**:

`timestamp | group_id | guest_id | attending | dietary | message | submitted_by | lang`

Never edit or sort this tab. Two people in a group submitting at the same moment
can never clobber each other because rows are only ever appended; current state
is the *last row per `guest_id`*.

Column headers are matched case- and separator-insensitively, so `guest_id`,
`Guest ID` and `guestId` are all fine, and columns can be reordered.

### Seat numbering

Must match `docs/seat_plan.jpg`:

- **Long tables** (1–5): `1 … N/2` is the top row, left to right; `N/2+1 … N` is
  the bottom row, left to right — the order you read the chips in the plan.
- **Round tables** (6–10): `1 … 10` clockwise from the top.

Tables are 24, 18, 24, 30, 24 seats (long) and 10 each (round) = **170**.

## Configuration

All in `.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Public URL, used in QR codes and share metadata |
| `GOOGLE_SHEET_ID` | From the sheet URL |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the service account key |
| `GOOGLE_CREDENTIALS_JSON` | Alternative: the key JSON inline |
| `ADMIN_PASSPHRASE` | Gates `/admin`. Unset means the dashboard stays locked |
| `MOCK_SHEET` | `1` uses fixture data. Never set in production |

Event details (names, date, venue, dress code) live in `src/lib/config.ts` and
are currently **placeholders** — replace them before launch.

## Deploying

The app runs as a single container behind the **Caddy that already serves
`*.thasarito.com`** on this box. Caddy holds a Cloudflare API token and uses the
DNS-01 challenge, so it issues a certificate for a new subdomain automatically —
nothing to request or renew by hand.

```bash
docker compose up -d --build
```

That publishes the app on `172.23.0.1:3200` — the `risklab_default` bridge
gateway. It is reachable from the Caddy container and the host, but **not** from
the public internet, so all outside traffic has to come through Caddy on 443.

Two manual steps, both needing access this project does not have:

**1. Add the site to the Caddyfile** (`/home/risklab/risklab/infra/caddy/Caddyfile`,
owned by the `risklab` user). Same shape as the existing `poc` and `paperclip`
entries, which also proxy to host-level processes:

```caddyfile
warissara.thasarito.com {
	import tls_cloudflare
	# Wedding RSVP app, published on the risklab_default bridge gateway.
	reverse_proxy 172.23.0.1:3200
}
```

Then reload without dropping connections:

```bash
docker exec risklab-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

**2. Create the DNS record.** An `A` record for `warissara` → `5.223.57.196` on
the `thasarito.com` zone. There is no wildcard record, so each subdomain needs
its own.

Both proxy modes work, and this one is set up **proxied** (orange cloud), unlike
the other subdomains on this box which are all DNS-only:

- *Proxied* hides the origin IP and puts Cloudflare's edge in front. Visitors
  see Cloudflare's certificate; Cloudflare talks to Caddy over its Let's Encrypt
  certificate. This requires the zone SSL mode to be **Full** or **Full
  (strict)** — on *Flexible*, Cloudflare would call the origin on port 80, Caddy
  would redirect to 443, and you would get an infinite redirect loop.
- *DNS-only* points straight at the box and is what `p1`, `copin`, `poc` and
  `paperclip` use.

Because it is proxied, it is worth knowing that Cloudflare is **not** caching the
guest pages: Next.js sends `cache-control: private, no-store` on them and
Cloudflare reports `cf-cache-status: DYNAMIC`. If that ever changed, one guest's
RSVP page could be served to another — worth re-checking after any Cloudflare
cache-rule change.

> A Cloudflare Tunnel would also work and needs no Caddyfile access, but it is
> redundant here: Caddy already terminates TLS for this zone, and one more
> moving part on the wedding day is not worth it.

## Routes

| Route | Purpose |
|---|---|
| `/` | Invitation: hero, date, venue, dress code, countdown |
| `/rsvp` | Name search — Thai or romanised, sees through kinship prefixes |
| `/rsvp/[token]` | Group RSVP form; replays previous answers |
| `/seat/[token]` | 3D walk to the seat, plus the plan view |
| `/admin` | Passphrase-gated dashboard |
| `/admin/qr` | Printable QR card per group, four to a page |
| `/debug/venue` | Geometry check — no guest names, safe to leave reachable |

## How it holds up on the day

Google Sheets is the only store, which needs care under load:

- Reads go through **one `batchGet`** behind a **45-second process cache**.
  Sheets allows roughly 60 reads/min/user; 170 guests opening pages at once
  would blow past that uncached.
- If a refresh fails, the **last good snapshot** is served with a soft banner
  rather than erroring the page.
- Writes are **serialised and append-only**, with exponential backoff on 429.
- The admin **Sync now** button drops the cache after you edit the sheet.

Accepted risk: with no database, a Sheets outage means submissions fail for the
duration — reads keep working from cache. Adding SQLite as a write-through
mirror later is contained to `src/lib/sheets.ts`.

## The 3D walk

The camera walks at eye height from the entrance to the chair. It cannot take a
straight line, so `src/lib/walk-path.ts` builds an occupancy grid of the hall,
runs A* to the space just behind the target seat, straightens the result, and
smooths it into a curve. Obstacles are **inflated for planning and verified
against their true size**, so routes never scrape the furniture.

Gait comes from three details in `WalkCamera`: a trapezoidal speed profile, a
head bob locked to distance travelled rather than time, and a gaze that follows
the path ahead then turns to the chair on arrival.

Guests will be on mid-range phones, so: instanced chairs (two draw calls for all
170), no shadow maps, capped device pixel ratio, and `frameloop="demand"` once
the walk ends. three.js is dynamically imported, so it never loads for guests
who only open the invitation.

Escape hatches: a Skip button, `prefers-reduced-motion` jumps straight to the
seat, and the plan view is **server-rendered unconditionally** — a guest with
JavaScript blocked still sees exactly where they sit.

## Architecture: logic below, UI above

The UI is meant to be replaceable. Everything that decides *what something
means* lives in `src/lib`; components only decide how it looks.

```
src/lib/venue.ts        seat geometry            pure
src/lib/walk-path.ts    A* route to a seat       pure
src/lib/guest-list.ts   snapshot queries         pure
src/lib/search.ts       name matching            pure
src/lib/dietary.ts      multi-select parsing     pure
src/lib/rsvp-form.ts    the form's wire contract pure
src/lib/views/          view models per screen   pure
src/lib/sheets.ts       Google Sheets I/O        server-only
src/app/**              fetch + render           thin
src/components/**       presentation             dumb
```

**View models** (`src/lib/views/`) are the seam. Each builder takes a snapshot
and returns exactly what one screen needs — names already resolved to the right
language, hrefs already built, counts already totalled:

```ts
const snapshot = await getSnapshot();
const view = buildRsvpView(snapshot, token, { lang, dietaryOptions, allowDietaryOther });
if (view.kind === "not-found") return <NotFoundCard … />;
return <RsvpForm view={view} lang={lang} />;
```

A page is now a fetch, a builder call, and JSX. Rewriting the UI means writing
new components against the same view models — no logic moves.

**The form contract** (`src/lib/rsvp-form.ts`) owns the field names *and* the
parsing. The component reads `guest.fieldNames.attending` off the view model
rather than inventing `attending:${id}` in JSX, and the server action calls
`parseRsvpForm` rather than re-deriving the same strings. Both sides of the wire
are defined once, so a new form cannot silently disagree with the parser.

**Copy stays in i18n.** View models carry data — names, numbers, states — never
sentences. Components call `t(lang)` for wording. So a redesign changes layout
without touching translations, and a copy change never touches logic.

All of it is exercised by `pnpm check:views` without rendering a single
component.

## Dietary requirements

A multi-select whose options live in `src/lib/config.ts`:

```ts
export const dietaryOptions = [
  { id: "vegetarian", label: { th: "มังสวิรัติ", en: "Vegetarian" } },
  …
];
export const allowDietaryOther = true;   // also offer a free-text box
```

Answers are stored in the sheet's existing `dietary` column as a comma-separated
list — `halal, no-pork, แพ้ผงชูรส` — which keeps the schema unchanged and stays
readable to anyone scanning the spreadsheet.

Two rules make this safe to change later:

- **Ids are permanent.** Renaming one orphans every answer already given against
  it. The labels are free to change; the ids are not.
- **Unknown values are kept, not dropped.** Anything that does not match a
  configured id is surfaced as free text. So removing an option never erases
  what a guest already told you, and entries typed before the options existed
  still show up. Set `dietaryOptions` to `[]` to fall back to a plain text box.

## Checks

```bash
pnpm check          # everything below
pnpm typecheck
pnpm check:venue    # 170 seats, no collisions, walkable aisles, chair facing
pnpm check:logic    # search, token lookup, append-only log collapse
pnpm check:views    # dietary parsing, form contract, view models
pnpm check:walk     # routes all 170 seats and asserts none clip furniture
pnpm check:sheets   # credentials, sharing, tabs, headers, data, write access
```

`check:venue` and `check:walk` both print ASCII plan views — compare them
against `docs/seat_plan.jpg`.

## Layout is code, people are data

The venue never changes, so it lives in `src/lib/venue.ts`, not the sheet.
East–west table positions are traced from the screenshot; north–south positions
are assigned to named rows with spacing derived from real furniture, because the
plan is a schematic that packs rows tighter than chairs allow — tracing it
directly puts tables 3 and 4 only 0.40 m apart.
