# Pull Request Preview Deployments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a stable Cloudflare Workers preview URL for every same-repository pull request without changing production traffic.

**Architecture:** The existing workflow continues to verify all pull requests. A separate same-repository PR job uploads an undeployed Worker version under a `pr-<number>` preview alias, extracts the URL from Wrangler output, and updates one marker-tagged PR comment; the production deploy job remains excluded from pull requests.

**Tech Stack:** GitHub Actions, Wrangler 4, Cloudflare Workers version previews, `actions/github-script`.

---

### Task 1: Enable Worker preview URLs

**Files:**
- Modify: `wrangler.jsonc`

- [x] **Step 1: Add a configuration assertion**

Run this before changing the file:

```bash
node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("wrangler.jsonc","utf8")); if(c.preview_urls!==true) process.exit(1)'
```

Expected: exit code 1 because preview URLs are not explicitly enabled.

- [x] **Step 2: Enable previews explicitly**

Add the top-level setting after `main`:

```json
"preview_urls": true,
```

- [x] **Step 3: Re-run the configuration assertion**

Run:

```bash
node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync("wrangler.jsonc","utf8")); if(c.preview_urls!==true) process.exit(1)'
```

Expected: exit code 0.

### Task 2: Upload and report PR previews

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [x] **Step 1: Add a failing workflow assertion**

Run this before changing the workflow:

```bash
node -e 'const fs=require("fs"); const y=fs.readFileSync(".github/workflows/deploy.yml","utf8"); for(const x of ["preview:","versions upload --preview-alias", "pull-requests: write", "actions/github-script@v7"]) if(!y.includes(x)) process.exit(1)'
```

Expected: exit code 1 because the preview job is absent.

- [x] **Step 2: Permit PR comments**

Extend the workflow permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
```

- [x] **Step 3: Add the same-repository preview job**

Add a `preview` job after `verify` with this behavior:

```yaml
preview:
  if: >-
    github.event_name == 'pull_request' &&
    github.event.pull_request.head.repo.full_name == github.repository
  needs: verify
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm build
    - name: Enable Cloudflare preview URLs
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      run: |
        curl --silent --show-error --fail-with-body \
          --request POST \
          --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
          --header "Content-Type: application/json" \
          --data '{"enabled":false,"previews_enabled":true}' \
          "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/warissara-wedding/subdomain" \
          --output /dev/null
    - name: Upload Cloudflare preview
      id: preview
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        command: versions upload --preview-alias pr-${{ github.event.pull_request.number }}
    - name: Find preview URL
      id: preview-url
      env:
        WRANGLER_OUTPUT: ${{ steps.preview.outputs.command-output }}
      run: |
        url="$(printf '%s\n' "$WRANGLER_OUTPUT" | sed -n 's/^Version Preview URL: //p' | tail -n 1)"
        test -n "$url"
        printf 'url=%s\n' "$url" >> "$GITHUB_OUTPUT"
    - name: Comment preview URL
      uses: actions/github-script@v7
      env:
        PREVIEW_URL: ${{ steps.preview-url.outputs.url }}
      with:
        script: |
          const marker = '<!-- cloudflare-preview -->';
          const body = `${marker}\nCloudflare preview: ${process.env.PREVIEW_URL}`;
          const { owner, repo } = context.repo;
          const issue_number = context.issue.number;
          const comments = await github.paginate(github.rest.issues.listComments, {
            owner, repo, issue_number, per_page: 100,
          });
          const existing = comments.find(
            (comment) => comment.user?.type === 'Bot' && comment.body?.includes(marker),
          );
          if (existing) {
            await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
          } else {
            await github.rest.issues.createComment({ owner, repo, issue_number, body });
          }
```

- [x] **Step 4: Re-run the workflow assertion**

Run the command from Step 1.

Expected: exit code 0.

- [x] **Step 5: Run repository verification**

Run:

```bash
pnpm lint && pnpm check
```

Expected: all checks and the production build pass.

- [ ] **Step 6: Commit implementation**

```bash
git add -- wrangler.jsonc .github/workflows/deploy.yml docs/superpowers/plans/2026-08-21-pull-request-preview.md
git commit -m "ci: publish Cloudflare previews for pull requests"
```

### Task 3: Validate the live PR preview

**Files:**
- No local file changes.

- [ ] **Step 1: Push the PR branch**

```bash
git push origin feat/save-the-date-landing
```

- [ ] **Step 2: Watch the PR checks**

```bash
gh pr checks 1 --repo thasarito/tongter --watch
```

Expected: `verify` and `preview` pass; production `deploy` remains skipped.

- [ ] **Step 3: Verify the comment and URL**

Use `gh api` to find the comment containing `<!-- cloudflare-preview -->`, request its URL, and confirm `/api/health` returns HTTP 200 with `{ "ok": true }`.
