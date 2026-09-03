# Limitations and roadmap

This page records what the platform does not yet claim, why that choice was made and what would change it.

| Current limitation | Why it exists | Present behaviour | Future path |
| --- | --- | --- | --- |
| Controlled pilots, not a certified 4,000-person production claim | Local emulation cannot reproduce final network, account quotas or event spikes | Logic and request shape were rehearsed locally | Stage 200, 500, 1,000 and 4,000 users on final infrastructure |
| Current runtime is Sites-managed | It allowed product validation before the club accepted separate storage billing and operations ownership | Live app uses managed DB and object bindings | Migrate to club Worker, D1 and R2 after ownership gates |
| R2 cutover is deferred | Activating club-owned storage may require billing details | Current images remain available in managed object storage | Create club bucket, copy with checksums and switch binding |
| Free-tier operating target | The project was designed for near-zero mandatory pilot cost | Batched saves and results reduce dynamic work | Upgrade for a large event; set budgets and alerts |
| Rate limiter is not globally distributed | An isolate-local map cannot coordinate every edge instance | It is only a final application backstop | Add Cloudflare edge rate limiting/Turnstile |
| One D1 database | Simplicity, SQL reporting and low operations cost matter more than premature sharding | Short queries and batched writes | Shard attempts only after measured D1 contention |
| Timed 2–4 minute checkpoint needs a longer live soak | The verified controlled attempt finished in 39 seconds | Final submission persistence is verified | Run a 10–15 minute attempt with disconnect/reload |
| No webcam, microphone or screen recording | These controls add privacy, consent, storage and support risk | Clear tab/full-screen rules and sparse events | Add only with policy/legal/accessibility review |
| No secure coding execution | Running untrusted code safely needs a separate sandbox service | Objective and typed-answer formats only | Add isolated runner, quotas, language images and abuse controls |
| Subjective responses are not fully auto-scored | Keyword grading can be unfair and LLM grading is non-deterministic | Store response and assist organizer review | Add rubric workflow, double review and appeal audit |
| No plagiarism or identity verification | Reliable detection needs data, policy and false-positive handling | Google identity plus declared integrity rules | Add only for a justified high-stakes use case |
| No file submissions or media responses | Object lifecycle, scanning and moderation are not yet implemented | Text and question images are supported | Add antivirus scanning, type/size limits and retention rules |
| Accessibility has not had an independent user audit | Engineering checks cannot replace tests with representative users | WCAG 2.2 AA is the design target | Keyboard, screen-reader, zoom and campus usability audit |
| OAuth consent links may need manual cleanup | Google Cloud metadata is outside application source | Sign-in works with the final callback | Verify privacy/terms links use the final domain |
| Results are deterministic, not LLM-generated | Marks and ranks must be reproducible and available during provider outages | Explainable rule-based recommendations | Optional narrative layer over fixed facts, never over scoring |

## Near-term roadmap

1. Finish the long checkpoint/reconnect soak test.
2. Add distributed edge abuse controls.
3. Add final-domain staged load tests and record telemetry.
4. Move infrastructure ownership to the club when billing and backup are accepted.
5. Complete an independent accessibility audit.
6. Add reusable question-bank templates and stronger paper review.
7. Add a rubric-based subjective evaluation workflow.

## Upgrade decision rule

Do not combine infrastructure migration with an active assessment. Move from the managed release only when the new environment has:

- verified data and image counts;
- OAuth on the final hostname;
- tested backup and rollback;
- named monitoring owners;
- staged load evidence;
- an unchanged, reviewed candidate experience.

## Cost philosophy

The goal is not “free at any scale.” The goal is to avoid per-candidate software fees and keep a small pilot affordable without hiding operational risk. Pay for capacity when a public event makes reliability more important than staying inside a free quota.
