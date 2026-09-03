# Product guide

## Candidate journey

### 1. Find an assessment

The assessment desk shows the test status, registration window, test window, duration, question count, marks and integrity rules. A released attempt shows a direct results-and-analysis action in the same card.

### 2. Sign in and register

Candidates use Google OAuth. The platform does not create another password. After registration, a small confirmation offers a shareable assessment link without blocking the next action.

### 3. Read the rules

Before the timer starts, the candidate sees:

- duration and server-controlled expiry;
- tab-switch limit;
- full-screen expectation;
- copy/paste/right-click behaviour;
- autosave and connection-recovery behaviour.

The candidate must acknowledge the rules before beginning.

### 4. Attempt

The runner provides a timer, question number, section/type/marks, options or typed response, mark-for-review action, previous/next controls, save state and a question palette.

Answers change locally at once. The app checkpoints in batches and performs a final save during submission. A navigation guard warns when background work or unsaved changes are still active.

### 5. Submit

Submission uses a confirmation step so a candidate does not end the test accidentally. The receipt records the attempt reference and released score state. If results are live, it links directly to the report.

### 6. Learn from the report

The report contains:

- overview: score, rank, percentile, accuracy, attempt rate and time;
- question review: response, answer, award, cohort success, time and solution;
- topic and difficulty: strengths and gaps;
- across mocks: trend over released attempts;
- leaderboard: privacy-safe cohort position;
- private error labels and recommended practice.

## Organizer journey

The normal workflow is:

New test → Assessment rules → CSV/image ZIP → Validate → Publish → Registration → Live test → End → Generate → Review → Release

### Create

Set the name, description, registration/test windows, duration, marks, negative marking, tab-switch limit, shuffle behaviour and result policy.

### Publish the paper

Download the CSV template, add questions, optionally add exact image filenames, upload a ZIP and validate. Nothing replaces the current paper until the complete candidate paper passes validation.

The organizer preview shows prompts, options, answers, solutions, marks, topic fields and images. A green state confirms that the paper is validated and ready.

### Manage registrations

Open/close registration, search participants and export the current list. Scheduling can replace repetitive manual open/start/end clicks when the assessment setup is complete.

### Conduct

Start or schedule the test, monitor starts/submissions and end the window. Extending a window should be an audited organizer action; changing questions after candidate activity is intentionally more restricted.

### Generate and release results

Start a result job after submissions close. The job advances in batches, exposes progress and can be resumed safely. Review exclusions and question issues before releasing scores or solutions.

Releasing scores and releasing solutions are separate decisions so organizers can support an appeal window.

## Status meanings

| Status | Candidate meaning | Organizer action |
| --- | --- | --- |
| Draft | Not visible | Complete rules and paper |
| Registration open | Can register | Monitor registrations |
| Scheduled | Registered; waiting | Final preflight |
| Live | Can start/continue | Monitor saves/submissions |
| Ended | Cannot start | Generate and review results |
| Results released | Can open analysis | Handle questions/appeals |

## What organizers should never need to edit

Routine assessments should not require source code, database consoles, deployment settings or OAuth settings. Those surfaces are for platform maintenance, not test operation.
