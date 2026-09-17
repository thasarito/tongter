# Administrator passcode

The dashboard, QR cards and Glass House Studio share `AdminPasscodeScreen`.
The cream-and-gold screen has four masked dots, ten circular keys, automatic
submission on the fourth digit and a bottom-right Cancel/Delete control.
Cancel (or Escape) returns to the public homepage. During a request, digits
are disabled but Cancel remains available; cancelling or leaving aborts the
request and late results do not reopen the protected route.

Physical digits, Backspace/Delete, Tab, Enter/Space button activation and an
exact four-digit paste are supported. Modified browser shortcuts are left
alone. No native text field is focused on mobile. Error messages distinguish
incorrect credentials from connection failures, preserve keypad geometry,
and announce progress without announcing the entered code. Reduced-motion
preferences disable the error shake and key transitions.

## Credential configuration

The requested credential is stored only as the fresh salted PBKDF2-SHA-256
verifier in `wrangler.jsonc`, using the existing server-side 100,000-iteration
format. The client sends the entered value to the existing HTTPS login API;
it does not contain a verifier, expected PIN, or client-side unlock condition.
`ADMIN_SESSION_SECRET` remains independent. Existing signed sessions retain
their existing lifetime; rotating the login verifier does not revoke them.

A configured `ADMIN_PASSPHRASE_HASH` takes precedence over `ADMIN_PASSPHRASE`.
The API retains plaintext-only environment compatibility, but the new screen
accepts exactly four digits. Local example/test environments explicitly clear
the deployed hash and use the synthetic PIN `1357`. Do not reuse that fixture
in deployment.

Set the GitHub Actions repository secret `STUDIO_PREVIEW_PASSPHRASE` to the
current administrator passcode when rotating the verifier. The preview
workflow no longer contains a hard-coded plaintext fallback. Its existing
live-sheet verification remains required and will fail when that secret is
missing or stale; a source change cannot update the repository secret.
Do not put the deployed PIN in tests, documentation, PR descriptions or logs.

A four-digit PIN has only 10,000 possibilities. Hashing does not make it a
strong credential or add rate limiting. This change keeps the existing auth
model; use edge access control/rate limiting for stronger protection.

## Verification

Regression tests cover all three entry points, masked partial input,
auto-submit, duplicate prevention, keyboard/paste input, error/retry states,
cancellation and late responses. Browser tests cover real local login,
320px phones, larger phones, landscape, desktop and reduced motion; captured
screenshots use only synthetic/local data. Existing studio browser tests use
the same keypad helper rather than bypassing authentication.
