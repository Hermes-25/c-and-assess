# Architecture

This document explains how C&Assess works without requiring knowledge of the original build conversation.

## One application, two experiences

The same Next.js application serves:

- candidates: discover, register, attempt, submit and review;
- organizers: create, publish, schedule, monitor, evaluate and release.

Server routes enforce the role boundary. Hiding organizer links in the interface is not treated as authorization.

## Request flow

~~~mermaid
sequenceDiagram
    participant U as Browser
    participant W as Edge application
    participant A as Google OAuth
    participant D as D1
    participant F as Object storage

    U->>W: Open assessment
    W->>A: Sign-in request
    A-->>W: Verified identity callback
    W->>D: Create or update user/session
    W-->>U: Signed session cookie

    U->>W: Register and start
    W->>D: Check schedule, registration and attempt
    W-->>U: Paper snapshot + server expiry

    loop Every few answers or 2–4 minutes
        U->>W: Batched checkpoint
        W->>D: Replace compact answer snapshot
    end

    U->>W: Final submission
    W->>D: Score once and seal attempt
    W-->>U: Submission receipt

    U->>W: Request released analysis
    W->>D: Read precomputed cohort metrics
    W->>F: Read protected question image
    W-->>U: Personal report and solutions
~~~

## Current production shape

The public domain is assess.caciitg.com. Cloudflare handles DNS. The current release runs through an OpenAI Sites-managed Cloudflare runtime with:

- D1 exposed to the application as DB;
- object storage exposed as FILES;
- Google OAuth credentials stored as deployment secrets.

The existing caciitg.com website remains an independent Cloudflare Pages project sourced from `caciitg/devops` and links to the assessment subdomain. Sharing a DNS zone does not merge their deployments.

## Prepared future shape

The locked target is a club-owned Cloudflare Worker deployed from `Hermes-25/c-and-assess` by GitHub Actions, with a club D1 database and private R2 bucket. That cutover is a change of infrastructure ownership, not a product rewrite. Binding names stay DB and FILES.

The move is deliberately gated by R2 activation, a narrowly scoped deploy token, data migration, backup, monitoring and final-infrastructure load tests. The exact sequence is in [Club Cloudflare cutover](DEPLOYMENT_CUTOVER.md).

## Application layers

| Layer | Responsibility |
| --- | --- |
| App Router pages | Candidate and organizer interfaces |
| Server/API routes | Authentication, validation, lifecycle commands and result access |
| Domain stores in lib/ | Assessments, candidates, scoring and analytics |
| Drizzle schema in db/ | Typed access to D1 |
| SQL in drizzle/ | Forward-only database migrations |
| FILES binding | Question-image objects |
| Browser state | Immediate answers, navigation and temporary unsaved work |

## Main route families

| Route family | Purpose | Access |
| --- | --- | --- |
| Home and assessments | Discovery and candidate desk | Public / signed candidate |
| Attempt and submission | Exam and receipt | Attempt owner |
| Results | Released analysis and demos | Attempt owner or demo |
| Organizer | Operations workspace | Allowlisted organizer |
| Auth API | OAuth and session lifecycle | Public callback / current user |
| Assessment API | Assessment setup and status | Organizer for writes |
| Question API | Import, image and paper management | Organizer; protected reads |
| Registration API | Candidate registration | Signed candidate |
| Attempt API | Start, checkpoint, submit and error labels | Attempt owner |
| Result API | Batch generation, release and report data | Organizer writes; owner reads |

## Data model

- users: Google identity and assigned role.
- assessments: schedule, duration, status, rules and active paper version.
- assessment_sections: optional paper structure.
- questions and question_versions: published content and version history.
- question_imports and question_import_rows: validation/audit trail.
- registrations: candidate eligibility and registration state.
- attempts: one answer snapshot, timing, status, score and released analytics per candidate.
- proctor_events: sparse declared events such as tab switches.
- question_metrics: cohort aggregates per question.
- result_jobs and result_runs: progress and audit state for batch result work.
- organizer_audit_log: important lifecycle actions.

Question images are objects, not database blobs. The database stores only a safe object key.

## Reliability choices

1. The browser updates an answer immediately.
2. Checkpoints batch several changes to reduce write pressure.
3. A final submission is a separate, explicit and idempotency-aware operation.
4. The server owns expiry time and scoring rules.
5. The paper version is attached to the attempt so a later edit cannot silently change an active candidate's paper.
6. Cohort analytics run as a batch job after the test instead of being recomputed inside each candidate request.

## Security boundaries

- Google proves identity; the application still decides the role.
- Organizer access uses an exact server-side email allowlist.
- Mutation routes validate same-origin request context.
- Session cookies are signed, HTTP-only and secure in production.
- Security headers deny framing and unnecessary device permissions.
- Object keys and database IDs are not authorization.
- Runtime schema migration is not performed during candidate requests.

The in-process rate limiter is only a backstop. A large public event still needs Cloudflare edge rate limits or equivalent distributed controls.

## Scaling model

D1 is intentionally the first database because the workload is small-row SQL and the project values low operational cost. The design reduces hot writes through checkpoint batching and post-test analytics jobs.

The included 4,000-candidate rehearsal validates application logic and request shape on a local Worker+D1 emulator. It does not prove internet latency, regional behaviour or final-account quotas. Run staged tests at 200, 500, 1,000 and 4,000 candidates on the final infrastructure before claiming that capacity.

