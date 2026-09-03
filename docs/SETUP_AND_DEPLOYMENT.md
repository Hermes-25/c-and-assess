# Setup and deployment

This guide is for a future maintainer creating a fresh C&Assess instance.

## 1. Prerequisites

- Node.js 22.13 or newer
- npm
- Python 3 for the schema replay test
- a Cloudflare account if using Worker/D1/R2
- a Google Cloud project for OAuth

## 2. Install

    git clone https://github.com/Hermes-25/c-and-assess.git
    cd c-and-assess
    npm ci
    cp .env.example .env.local

Never commit .env.local.

## 3. Google OAuth

In Google Cloud:

1. Create an OAuth 2.0 Web application.
2. Add the app name, support email, homepage, privacy and terms URLs.
3. Request only openid, email and profile.
4. Add the local origin: http://localhost:3000.
5. Add the local callback: http://localhost:3000/api/auth/callback/google.
6. For production, add your HTTPS origin and callback, for example:
   - https://assess.example.org
   - https://assess.example.org/api/auth/callback/google
7. Put the client ID and secret in local/deployment secrets.

Generate AUTH_SECRET as a long random value. Use a different value for local, preview and production.

## 4. Local runtime

The application expects:

- a D1-compatible binding named DB;
- an object-storage binding named FILES.

Vinext and the Cloudflare Vite plugin provide the local Worker-style runtime. Start it with:

    npm run dev

Apply the SQL files in drizzle/ in numeric order before using database-backed pages. Migrations belong in deployment/setup, never in a candidate request.

## 5. Validate the source

    npm run typecheck
    npm run lint
    npm run test:scoring
    npm run test:schema
    npm run build
    npm audit --omit=dev

The shorthand is npm run check.

## 6. Sites-managed deployment

The current public release uses OpenAI Sites-managed infrastructure.

1. Create or select a Sites project.
2. Copy .openai/hosting.example.json to .openai/hosting.json.
3. Replace the project placeholder locally.
4. Confirm the control plane injects DB and FILES.
5. Add AUTH_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as deployment secrets.
6. Apply migrations during deployment.
7. Attach and verify the custom domain.

The real hosting file is ignored because it identifies an account-specific project.

## 7. Club-owned Cloudflare Worker deployment

This is the locked target architecture. Follow [Club Cloudflare cutover](DEPLOYMENT_CUTOVER.md) for the staged migration and rollback sequence.

1. Create a D1 database.
2. Create an R2 bucket when the club accepts the billing/account requirement.
3. Copy wrangler.example.jsonc to wrangler.production.jsonc.
4. Replace account, database, bucket and domain placeholders.
5. Add the three secrets through Wrangler or the Cloudflare dashboard.
6. Apply all D1 migrations remotely.
7. Build and deploy the exact version that passed CI.
8. Attach the production custom hostname.
9. Verify OAuth, DB rows, images and security headers.

Do not publish wrangler.production.jsonc if it contains account-specific identifiers.

## 8. Custom domain and existing C&A website

For the C&A deployment:

- caciitg.com remains the existing Cloudflare Pages project sourced from `caciitg/devops`;
- assess.caciitg.com points to the assessment application;
- the main site uses a normal link to the assessment subdomain.

This is simpler and safer than mounting a full server application below a GitHub Pages path. Candidates remain on a club-owned domain and never need a workers.dev URL.

## 9. Fresh-instance checklist

- [ ] Replace C&A logo/name if deploying for another organization.
- [ ] Create Google OAuth credentials and exact callbacks.
- [ ] Create DB and FILES bindings.
- [ ] Apply every migration once.
- [ ] Add organizer emails through a deliberate server-side configuration change.
- [ ] Run all checks.
- [ ] Create one synthetic organizer test.
- [ ] Register with a separate controlled candidate account.
- [ ] Verify image upload, attempt save, submit, batch result and release.
- [ ] Test rollback and database restore before a public event.

## 10. Production configuration rules

- Never share one AUTH_SECRET across unrelated environments.
- Never put secrets in source, screenshots or issue comments.
- Keep previews on a separate database.
- Keep production question images immutable per paper version.
- Use HTTPS only in production.
- Set edge rate limits before opening a broad public registration.
- Freeze code, DNS, OAuth and schema changes before test day.

