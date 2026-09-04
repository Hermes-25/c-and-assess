# Free-tier operation and later upgrades

## Current decision

On 4 September 2026, the owner approved deployment access but declined R2 activation. Keep Workers on Free and R2 inactive. Do not activate subscriptions or use a saved card without fresh approval.

The existing live Sites-managed deployment remains in place until an explicit, tested cutover. Creating a club database or storing a deployment credential does not move existing candidates, attempts, or image files.

## Text-only club Worker

Leave `CLOUDFLARE_R2_BUCKET` unset. The deployment renderer then emits no R2 binding, even when the build configuration contains one. D1 is still required.

- Text-only CSV papers, registrations, attempts, scores and analysis can use the existing D1-backed implementation. A full staging rehearsal is still required before claiming readiness.
- Leave every CSV `Image` cell blank. ZIP uploads and image-bearing imports receive a clear error instead of publishing a broken paper.
- Image uploads need private object storage. We do not silently discard image references or put confidential question images in a public GitHub folder.
- Do not migrate an image-based live assessment into text-only mode. Preserve the existing release or wait for image storage approval.
- Free plans have usage limits, not unlimited exam capacity. Do not run the 4,000-candidate load test or advertise that capacity on Free without a separately reviewed load budget. Do not enable automatic paid upgrades.

## Later R2 upgrade

1. Obtain separate approval for the subscription and possible usage charges.
2. Create separate private staging and production buckets. Do not enable public bucket access.
3. Add each bucket name as `CLOUDFLARE_R2_BUCKET` in its GitHub environment, then redeploy. The renderer adds the `FILES` binding automatically.
4. If the deployment tool needs additional R2 permissions, approve and rotate the narrowly scoped deployment token; it currently has no R2 or billing access.
5. Migrate existing objects without changing their keys. Compare D1 image references against the copied objects.
6. Rehearse ZIP import, organizer preview, candidate delivery and results review before switching the public domain.

No scoring schema rewrite is required for this upgrade. Existing image routes and access checks remain in the code.

## Deployment credential

The account-owned deployment token expires on 4 December 2026. It has Workers Scripts write, D1 write, Account Settings read, and Workers Routes write restricted to `caciitg.com`. It has no Pages, R2, billing or account-member edit permission. Store it only in encrypted GitHub environment secrets. Rotate it before expiry; do not paste it into source, issues or documentation.

Account-level Workers and D1 permissions can affect more than staging resources. Separate databases prevent accidental data mixing but do not turn this token into a staging-only security boundary. Require human approval for production deployments.
