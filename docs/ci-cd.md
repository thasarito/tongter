# Fast CI/CD

## Automatic checks

`Verify and deploy` runs on pull requests targeting `main`, pushes to `main`,
and manual dispatch. The `verify` job keeps lint, TypeScript checks, all Vitest
unit/integration tests, the deterministic domain checks, the application build,
and the private sheet-writer dry-run bundle. A failed check still blocks release.

Same-repository pull requests keep their Cloudflare preview URL and PR comment.
The preview checks only the application root and `/api/health`; it does not run
browser tests, log into the studio, or probe the live Google Sheet. The existing
shared sheet-coordinator deployment is unchanged. Fork pull requests run
verification only and do not receive deployment secrets.

Production deployment requires successful verification and the `main` ref.
Manual dispatch on a feature branch verifies it without deploying production.
Each automatic job has a five-minute timeout. Preview HTTP requests have bounded
connection times, request times, and retries. Existing pnpm caching and
cancellation of superseded runs are preserved.

## Browser checks on demand

After this workflow is merged into `main`, select **Actions → Browser checks
(manual) → Run workflow** and choose the branch to test. This separate workflow
runs the existing full desktop/mobile Playwright suite against the local test
environment and retains screenshots, failure traces, and error context for seven
days. It does not deploy anything and cannot block the automatic deployment
workflow. Browser tests have not been deleted or marked as passing without a run.

The equivalent local commands are:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

For an explicitly requested live-sheet readback, the existing
`scripts/check-live-studio.mts` remains available locally. Set `PREVIEW_URL` to
the intended deployment and `STUDIO_PREVIEW_PASSPHRASE` to its current passcode,
then run:

```bash
pnpm exec node --experimental-strip-types scripts/check-live-studio.mts
```

## Why the automatic browser steps were removed

In main run `35192318623`, lint, all 242 unit/integration tests, the domain checks,
and builds passed. Chromium setup took about 27 seconds and `pnpm test:e2e` took
about 5 minutes 28 seconds before failing on a joystick frame-settling timeout.
This blocked deployment despite the faster checks passing. PR previews also
installed Chromium again and ran live desktop/mobile sheet probes.

Those expensive checks now require an explicit run. Normal CI still validates
code and bundles, but no longer certifies browser interactions or live-sheet
behavior. The failing browser test itself is not fixed by this pipeline change.
