# AI-assisted development

## What “AI-assisted” means here

AI was used as a product and engineering collaborator while building C&Assess. It helped:

- turn screenshots and organizer feedback into product requirements;
- compare user journeys and identify missing states;
- draft and review implementation approaches;
- find edge cases in authentication, imports, scoring and result release;
- generate test ideas and documentation structure;
- accelerate repetitive code and copy work.

Abhishek Das remained responsible for product decisions, source review, secrets, deployment, testing and release approval.

## What AI does not control

The live critical path does not require an LLM:

- Google OAuth establishes identity.
- Server code enforces organizer access.
- Versioned rules score objective responses.
- SQL computes stored cohort statistics.
- Organizers control result and solution release.

This keeps the assessment reproducible and avoids adding model latency, cost and output variance to test day.

## Current “personalized analysis”

Recommendations are generated from observable facts such as:

- accuracy;
- attempted versus skipped questions;
- time on correct and incorrect responses;
- topic and difficulty breakdown;
- cohort success rate;
- error labels saved by the candidate.

Rules translate those facts into suggestions. A maintainer can inspect why a suggestion appeared.

## Review safeguards

AI-generated work was not accepted only because it looked plausible. The build used:

1. source inspection;
2. typed interfaces and compiler checks;
3. deterministic scoring tests;
4. database migration replay;
5. browser checks of complete journeys;
6. controlled production rehearsal;
7. explicit documentation of unverified claims.

Secrets and candidate data are outside prompts, fixtures and public source.

## Responsible future LLM use

An optional LLM layer could turn fixed analysis facts into clearer natural-language coaching or summarize an organizer's question-quality review.

It should:

- receive only the minimum de-identified facts;
- never change marks, rank, eligibility or integrity outcomes;
- produce structured output with a deterministic fallback;
- show that its wording is generated;
- be measured for cost, latency and unsafe advice;
- allow organizers/candidates to use the report without it.

## Recruiter summary

The AI contribution is not “called an API.” It is the disciplined use of AI across discovery, design, engineering and quality while keeping high-stakes decisions explainable and human-owned.
