# Security policy

## Report a vulnerability

Please do not open a public issue for an authentication, authorization, data-exposure or exam-integrity vulnerability.

Email **work.abhishekdas@gmail.com** with:

- the affected page or API route;
- the smallest safe reproduction;
- the impact you observed;
- screenshots or logs with tokens, cookies and candidate data removed.

You should receive an acknowledgement within 72 hours. Do not test against a live assessment, access another candidate's data or publish exploit details before a fix is available.

## Supported version

Security fixes target the current main branch and the live version identified by the maintainers. Old forks and historical deployments are not supported.

## Secrets

Real values for AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, Cloudflare account IDs and database IDs must stay outside Git. Use deployment secrets and ignored local files.
