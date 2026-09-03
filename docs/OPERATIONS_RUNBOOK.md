# Operations runbook

This is the minimum safe procedure for a real assessment.

## Named ownership

Every event needs:

- release and monitoring owner;
- backup owner;
- organizer responsible for paper correctness;
- incident channel visible to candidates.

One person may hold more than one role for a small pilot, but the names must be written down.

## Before registration

- [ ] CI and local checks pass on the exact release.
- [ ] Production migrations are already applied.
- [ ] OAuth works for one organizer and one normal candidate.
- [ ] Organizer preview shows every prompt, option, mark, solution and image.
- [ ] Registration/test/result dates use the expected timezone.
- [ ] Edge rate limits and monitoring are active for a broad event.
- [ ] A database export exists and a previous deployable version is identified.
- [ ] No real candidate data appears in logs, fixtures or screenshots.

## Full dry run

Use a clearly named synthetic assessment and accounts owned by the testers:

1. Create the assessment.
2. Upload CSV and image ZIP.
3. Validate and inspect the preview.
4. Publish the paper.
5. Open registration.
6. Register and start as a separate candidate.
7. Answer, navigate, refresh, recover and submit.
8. End the assessment.
9. Generate cohort results in batches.
10. Review exclusions and question metrics.
11. Release scores, then solutions.
12. Open the report from the candidate desk and receipt.

Delete or archive synthetic records only after evidence has been captured and the target has been checked.

## Deployment freeze

Freeze application, migration, DNS and OAuth changes 24 hours before a major test. Keep the freeze until all attempts are submitted and the database is backed up.

An emergency change must record:

- incident and user impact;
- current and previous source version;
- latest verified database export;
- owner and rollback decision.

## Exam-day sequence

### Two hours before

- verify domain, TLS, OAuth and health;
- verify one candidate can start, save and submit;
- record Worker/D1/storage usage;
- confirm monitoring and backup owners.

### During

- watch 5xx, auth errors, checkpoint failures and D1 overload;
- do not change bindings or deploy routine improvements;
- keep existing sessions active during an OAuth incident;
- communicate extensions before changing a window.

### At close

- wait for active final submissions;
- export the database;
- end the candidate start window;
- run the result job;
- inspect exclusions, ties and suspicious question metrics;
- release only after organizer sign-off;
- export again after release.

## Suggested incident thresholds

| Signal | Response |
| --- | --- |
| 5xx above 1% for two minutes | Stop new starts; inspect before deploying |
| Save/submit failures above 0.5% | Tell candidates to remain on page; investigate |
| D1 overload or quota above 70% | Increase checkpoint interval or pause new starts |
| Multi-user OAuth failure | Keep sessions; extend registration/test window |
| Wrong answer key | Pause release; version the correction and re-evaluate |

These are starting thresholds, not universal guarantees. Tune them after real telemetry.

## Backup and rollback

- Export D1 before a public test, before result generation and before an emergency migration.
- Store exports in restricted club storage and record a checksum.
- Test-import into a separate recovery database.
- Roll back application code to the last verified version.
- Do not reverse a schema migration during an active test.
- Never overwrite the only production database when testing recovery.

## Result controls

An organizer should be able to:

- exclude a clearly identified attempt with an audited reason;
- exclude or correct a broken question;
- re-run versioned scoring;
- preview the effect before public release;
- release scores separately from solutions;
- retain the original response and audit history.

## Post-event

- capture availability/error and submission counts;
- document candidate issues;
- close the deployment freeze only after backups verify;
- convert recurring issues into GitHub issues;
- never publish candidate-level exports in this repository.
