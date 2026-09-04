# Club Cloudflare cutover

This runbook moves C&Assess from the temporary Sites-managed release to infrastructure owned by the Consulting & Analytics Club. Keep the existing release available as a rollback target until the new Worker passes the complete rehearsal.

## Locked architecture

~~~text
caciitg/devops --Cloudflare GitHub App--> Cloudflare Pages --> caciitg.com
                                                               |
                                                         Take Assessment
                                                               v
Hermes-25/c-and-assess --GitHub Actions--> Club Cloudflare Worker
                                                               |
                                                        assess.caciitg.com
                                                           /   |   \
                                                          D1  R2* Google OAuth
~~~

The repositories deploy independently. The main site contains only a normal HTTPS link to C&Assess. No iframe, reverse proxy or shared build is required.

R2 is optional and deferred by the owner. With no bucket configured, the club Worker is text-only. The existing Sites-managed deployment is not changed by this staging setup. See [Free-tier operation](FREE_TIER.md) before any public cutover.

## One-time Cloudflare and GitHub setup

1. Keep the existing `caciitg` Pages project connected to `caciitg/devops` on `main`.
2. Upgrade that Pages project from Build Image v1 to v3 before Cloudflare removes v1.
3. Use the existing D1 database `caciitg-assess-production` or create a replacement before the first real event.
4. Leave R2 inactive for now. Do not supply `CLOUDFLARE_R2_BUCKET`. Only after separate billing approval, create private buckets and add that setting to enable images.
5. Create a narrowly scoped Cloudflare API token for GitHub Actions. It needs Worker Scripts edit, D1 edit, Workers Routes edit and account read for this account. Do not use the Global API Key.
6. Create GitHub environments named `staging` and `production` in `Hermes-25/c-and-assess`. Require a reviewer for `production`.
7. Add the settings below to both environments. Prefer separate staging resources.

| GitHub setting | Kind | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Environment secret | Narrow Cloudflare deploy token |
| `CLOUDFLARE_ACCOUNT_ID` | Environment variable | Club Cloudflare account ID |
| `CLOUDFLARE_D1_DATABASE_ID` | Environment variable | Target D1 database UUID |
| `CLOUDFLARE_D1_DATABASE_NAME` | Environment variable | `caciitg-assess-production` |
| `CLOUDFLARE_R2_BUCKET` | Optional environment variable | Leave unset for text-only mode; later use a private bucket |
| `CLOUDFLARE_CUSTOM_DOMAIN` | Production variable | `assess.caciitg.com` |

Google credentials and `AUTH_SECRET` are Worker runtime secrets. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `AUTH_SECRET` directly to the Worker; do not pass them through the deploy workflow.

## Staged release

1. Run `Deploy C&Assess Worker` with `staging` selected. This deploys to `workers.dev` without touching the production hostname.
2. Add staging-only OAuth credentials and test the temporary URL. Use a separate staging database where possible.
3. Verify public pages, sign-in, organizer authorization, CSV plus image publishing, registration, attempt recovery, submission, result generation, release and candidate analysis.
4. Record D1 row counts and R2 object counts. Run the 200-user rehearsal, then 500 and 1,000. Run 4,000 only after the smaller stages stay healthy.
5. Back up D1 and record the last-known-good Worker deployment.

## Production cutover

1. Freeze application, schema, OAuth and DNS changes.
2. Confirm `/privacy` and `/terms` load on staging.
3. Set Google OAuth branding to C&Assess, use the final public legal URLs, request only `openid`, `email` and `profile`, and publish the External app when ready.
4. Confirm the callback is exactly `https://assess.caciitg.com/api/auth/callback/google`.
5. Remove the old DNS-only CNAME to `custom-domains.chatgpt.site` only when the workflow is ready to attach the Worker custom domain.
6. Run the workflow with `production` selected.
7. Perform the complete organizer-to-analysis rehearsal on the final hostname with controlled organizer and candidate accounts.
8. Add or update the “Take Assessment” link in `caciitg/devops`, open a pull request, and let Cloudflare Pages deploy after merge.

## Rollback

1. Stop organizer lifecycle changes and public registrations.
2. Roll the Worker back to the recorded last-known-good deployment when the problem is application-only.
3. If the new infrastructure cannot serve safely, remove the Worker custom domain and restore the previous CNAME to the temporary release.
4. Restore D1 only from a verified backup. Never overwrite newer attempts until the incident owner reconciles the data.
5. Record the impact window, affected attempt IDs and remediation before reopening.

## Hard gates

- [ ] Storage mode is tested: text-only with no image references, or separately approved private R2 with all required images migrated.
- [ ] Worker runtime secrets are set without exposing them in GitHub or logs.
- [ ] D1 migrations complete outside candidate requests.
- [ ] Staging passes the full lifecycle rehearsal.
- [ ] OAuth callback and public consent links use the final domain.
- [ ] Production requires human approval.
- [ ] Cutover and rollback are rehearsed.
- [ ] The main-site pull request links to `https://assess.caciitg.com`.
- [ ] An exam-day monitoring owner and backup owner are named.
