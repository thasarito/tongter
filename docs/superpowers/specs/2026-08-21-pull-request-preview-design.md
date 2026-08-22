# Pull Request Preview Deployments

## Goal

Publish a public Cloudflare Workers preview for each pull request without changing the production deployment at `warissara.thasarito.com`.

## Design

The existing verification job remains the required first stage for pushes and pull requests. After verification succeeds on a same-repository pull request, a new preview job builds the application and runs `wrangler versions upload` with the alias `pr-<number>`. Uploading a version creates a preview without shifting production traffic.

The Wrangler configuration explicitly enables preview URLs because the production Worker uses a custom route, which otherwise causes preview URLs to default to disabled. Because `wrangler versions upload` does not apply this service-level setting, the preview job also enables previews through Cloudflare's Worker subdomain API while keeping the public `workers.dev` production endpoint disabled. The existing production deploy job remains restricted to non-pull-request events and continues to deploy only after verification.

The preview job uses the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Pull requests from forks do not receive those secrets, so the job is limited to branches in `thasarito/tongter`.

After upload, the workflow extracts Wrangler's preview URL and creates or updates one bot-authored pull-request comment. Updating a stable comment avoids adding a new comment for every push while keeping the current preview easy to find.

The Worker enables `global_fetch_strictly_public` because Cloudflare's static-assets router invokes the API Worker across the same zone on a preview hostname; without that compatibility behavior, dynamic preview routes fail with Cloudflare error 1042. The workflow requests both the homepage and `/api/health` before publishing the alias URL, so an assets-only or broken Worker preview fails CI instead of being advertised.

## Failure Handling

Missing Cloudflare credentials, a failed build, a failed version upload, or a missing preview URL fails the preview job visibly. The production deployment remains unaffected. Verification still runs for forked pull requests even though their preview job is skipped.

## Verification

- Validate the workflow structure and expressions locally.
- Run lint, type checking, unit tests, and the production build.
- Push the workflow change to PR #1.
- Confirm the PR preview job succeeds and the PR receives a working `workers.dev` URL.
- Confirm the production deployment job remains skipped for the pull-request event.
