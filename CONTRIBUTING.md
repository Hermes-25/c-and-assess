# Contributing

Thanks for improving C&Assess. Keep changes easy for the next C&A team to understand and operate.

## Before coding

1. Search existing issues.
2. For a large product or schema change, open a proposal first.
3. Never use a real public assessment as a test environment.
4. Never add candidate records, OAuth credentials, cookies, database exports or production IDs to a commit.

## Local workflow

    npm ci
    cp .env.example .env.local
    npm run dev

Before opening a pull request:

    npm run check
    npm audit --omit=dev

## Change rules

- Database changes require a new forward-only migration in drizzle/.
- Scoring changes require a regression case in scripts/verify_scoring.mjs.
- Import changes require an example CSV and an explanation in docs/CSV_IMPORT_GUIDE.md.
- Candidate-facing changes must keep keyboard access, visible focus and readable contrast.
- Do not add an LLM to scoring, ranking, authentication or answer saving.
- Update documentation when an organizer workflow or deployment step changes.

## Pull requests

Keep one clear purpose per pull request. Explain the user problem, the change, how it was tested, screenshots for UI work and rollback/data impact. A maintainer should be able to reproduce the result without private context.
