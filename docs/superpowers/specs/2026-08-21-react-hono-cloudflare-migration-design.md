# React + Hono Cloudflare Migration Design

Date: 2026-08-21
Status: Approved for implementation planning

## Objective

Migrate the wedding application from Next.js to a Cloudflare-native React single-page application with a Hono API, while preserving the existing guest journey, RSVP, seating, administration, bilingual content, Google Sheets persistence, and public URLs. Deploy the result as one Cloudflare Worker with static assets at `https://warissara.thasarito.com` and automatically deploy verified changes from the GitHub `main` branch.

## Why Migrate

The application is primarily an interactive client-side journey. Next.js currently supplies routing, server actions, cookies, and server-side data loading, but it also requires the OpenNext adapter on Cloudflare. A React and Vite frontend paired with a Hono Worker maps more directly to the product:

- Cloudflare serves versioned frontend assets without invoking the Worker.
- Only `/api/*` requests consume Worker compute.
- The frontend and backend deploy as one versioned unit.
- Hono RPC preserves end-to-end TypeScript inference without adding tRPC.
- The deployment does not depend on a Next.js compatibility adapter.

## Scope

### Included

- Preserve the visual guest journey and all Three.js behavior.
- Preserve the current public paths: `/`, `/i/:guestToken`, `/rsvp`, `/rsvp/:token`, `/seat/:token`, `/admin`, `/admin/qr`, and `/debug/venue`.
- Replace Next.js App Router pages with React Router routes.
- Replace Next.js server actions and route handlers with Hono endpoints.
- Preserve Google Sheets as the only persistent data store.
- Preserve bilingual Thai and English behavior.
- Preserve secure administrator login and logout.
- Deploy the SPA and API together on Cloudflare Workers.
- Configure `warissara.thasarito.com`, TLS, secrets, and continuous deployment from GitHub.

### Excluded

- Redesigning the approved user interface or venue experience.
- Changing the spreadsheet schema or migrating data to another database.
- Adding tRPC, server-side rendering, or search-engine optimization work.
- Adding new wedding product features unrelated to the migration.

## Architecture

### Client

The client is a React 19 SPA built with Vite. React Router owns browser routing and provides route parameters for guest and group tokens. Existing reusable React and Three.js components move with minimal behavioral changes. Next-specific imports and boundaries are replaced with browser equivalents.

Suggested boundaries:

```text
src/
  client/
    app/
    routes/
    components/
    api/
  worker/
    routes/
    middleware/
    services/
    index.ts
  shared/
    contracts/
    domain/
```

The language choice is client-owned and persisted in a cookie so existing behavior remains durable across sessions. Navigation uses React Router rather than server redirects.

### Worker

A single Hono application handles `/api/*`. It contains route handlers, request validation, administrator authentication, Google service-account authentication, Sheets access, and cache coordination. Cloudflare static asset routing uses `not_found_handling: "single-page-application"`; navigation requests that do not match an asset receive `index.html`, while `/api/*` runs Worker code.

### Shared Contracts

Domain types and validation schemas live under `src/shared`. Hono exports its composed route type, and the browser uses Hono's `hc` client. Input schemas validate route parameters, query strings, and JSON bodies. Successful and unsuccessful responses use explicit status codes and JSON shapes so the client can infer both branches.

tRPC is intentionally omitted. Hono RPC already provides compile-time request and response types for this API surface. A client query library may be added later if cache invalidation or optimistic updates become complex; it is not required for this migration.

## Route and API Mapping

The browser routes preserve the current URLs and render equivalent screens. Data access moves to these API groups:

- `GET /api/health`: deployment health without exposing configuration values.
- `GET /api/search?q=...`: token-safe guest search results used by the home screen.
- `GET /api/journey/:guestToken`: personal identity, group, and journey bootstrap data.
- `GET /api/rsvp/:groupToken`: group membership, options, and latest RSVP values.
- `POST /api/rsvp/:groupToken`: validated append-only RSVP submission.
- `GET /api/seat/:groupToken`: group attendance and seat-view data.
- `POST /api/admin/login`: validates the passphrase and issues an administrator cookie.
- `POST /api/admin/logout`: expires the administrator cookie.
- `GET /api/admin/summary`: authenticated dashboard data.
- `GET /api/admin/qr`: authenticated QR-card data.

Endpoint payloads expose only the fields needed by their screens. Personal and group tokens remain opaque route credentials and are never listed in bulk through a public endpoint.

## Google Sheets Access

The Worker uses the Google Sheets REST API directly instead of bundling the Node-oriented `googleapis` package. It creates a short-lived OAuth access token from the service-account JSON using Web Crypto, caches that token in the Worker isolate until shortly before expiry, and sends authenticated `fetch` requests to Sheets.

Runtime configuration:

- `GOOGLE_SHEET_ID`: encrypted Worker secret.
- `GOOGLE_CREDENTIALS_JSON`: encrypted Worker secret containing the complete service-account JSON.
- `ADMIN_PASSPHRASE`: encrypted Worker secret.
- `NEXT_PUBLIC_SITE_URL`: build-time public value set to `https://warissara.thasarito.com` until the name is migrated to a framework-neutral key.

The filesystem-based `GOOGLE_APPLICATION_CREDENTIALS` path remains usable only by local data-generation scripts. Production never depends on a credential file.

The current append-only RSVP model remains unchanged. Reads use one batch request and a short-lived in-isolate snapshot. A successful prior snapshot can be served as stale when a refresh fails. Writes are serialized as far as the isolate permits and use append semantics so concurrent submissions do not overwrite existing rows.

## Authentication and Security

Administrator authentication uses an HTTP-only, Secure, SameSite cookie scoped to the application. The cookie contains a signed, expiring session value derived with Web Crypto; the raw administrator passphrase is never stored in the cookie or returned to the client. Protected Hono middleware validates the signature before serving dashboard or QR data.

Public mutations validate content type, payload size, group membership, token ownership, allowed dietary identifiers, and text length. Responses do not reveal whether unrelated tokens exist. Cloudflare secrets are never committed to GitHub or placed in the frontend bundle.

## Errors and User Experience

API errors use a stable envelope with a machine-readable code and safe user-facing message. The frontend distinguishes:

- Invalid or unknown invitation links: render the existing not-found experience.
- Temporary Sheets read failure with cached data: render data and a non-blocking stale warning where relevant.
- Temporary write failure: retain form values, show a retry action, and never navigate to the success screen.
- Authentication failure: return `401`, clear invalid local admin state, and show the login screen.
- Unexpected failure: show a recoverable generic error and log structured diagnostic context without credentials or guest data.

## Build and Deployment

Vite and the Cloudflare Vite plugin build the React client and Hono Worker together. Wrangler defines the Worker name, current compatibility date, static SPA fallback, `/api/*` Worker-first routing, observability, and the custom domain.

GitHub Actions runs on pushes to `main`:

1. Install the pinned pnpm version and dependencies.
2. Run type checking, domain checks, API tests, linting, and the production build.
3. Deploy with Wrangler only when verification succeeds.

GitHub stores a scoped Cloudflare API token and account ID as repository secrets. Application secrets remain Worker secrets and are not copied into GitHub unless CI requires them at build time. Cloudflare creates and renews TLS for `warissara.thasarito.com`; the existing Cloudflare-managed zone supplies the DNS record through the Worker custom-domain configuration.

## Migration Sequence

1. Introduce Vite, React Router, Hono, shared contracts, and Cloudflare configuration.
2. Move pure domain modules and their existing checks without changing behavior.
3. Implement Sheets REST authentication and adapter tests against mocked fetch responses.
4. Implement Hono routes and endpoint tests.
5. Move route screens and replace server actions with the typed Hono client.
6. Remove Next.js-only files and dependencies after route parity is established.
7. Run local Worker-runtime and browser smoke tests.
8. Deploy to a temporary `workers.dev` hostname and verify production secrets and Sheets access.
9. Attach `warissara.thasarito.com`, verify DNS and TLS, then enable automatic `main` deployment.

The migration should remain one coherent branch, but commits should separate infrastructure, API, client routing, and cleanup so failures can be isolated.

## Verification

Completion requires fresh evidence from:

- Unit checks for guest, RSVP, venue, view, walk, and seated-look behavior.
- Hono route tests covering valid, invalid, unauthorized, stale-read, and failed-write paths.
- Sheets adapter tests with mocked Google OAuth and Sheets responses.
- Type checking and linting.
- A production Vite and Worker build.
- A local Workers-runtime smoke test for SPA fallback and `/api/health`.
- Browser smoke tests for home search, invitation journey, RSVP, seat reveal, language persistence, administrator login, and QR data.
- Post-deployment checks for the `workers.dev` preview, custom hostname, TLS, health endpoint, and a reversible Sheets read/write test.

## Rollback

The current Next.js commit remains available in Git history. Before the custom-domain cutover, the Hono deployment is verified on its temporary hostname. If the production cutover fails, remove or roll back the Worker custom-domain route and restore the previous DNS target. Cloudflare deployment versions permit rolling the Worker back without reverting repository history.

## Acceptance Criteria

- Every current user-facing and administrator route remains reachable at the same path.
- Guest search, invitation identity, RSVP read/write, seating, admin login, summary, and QR data work against Google Sheets.
- Existing visual and 3D checks continue to pass.
- No service-account or administrator secret appears in Git, build artifacts, logs, or browser responses.
- The application deploys as a React SPA and Hono API in one Cloudflare Worker.
- `https://warissara.thasarito.com` serves a valid TLS certificate and the deployed application.
- A verified push to `main` automatically deploys; a failed check does not deploy.
