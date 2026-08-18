# Contributing to Risk//OS

Risk//OS handles security-sensitive decision workflows. Contributions should be small, testable, explainable, and explicit about their effect on risk outcomes.

## Development workflow

1. Create a focused branch from `main`.
2. Install locked dependencies with `npm ci`.
3. Make the smallest coherent change.
4. Add or update tests for scoring and API behavior.
5. Run `npm run lint` and `npm run check`.
6. Open a pull request using the repository template.

## Engineering expectations

- Never commit credentials, real payment data, personal data, or production identifiers.
- Preserve strict input validation and server-side authorization boundaries.
- Keep scoring decisions deterministic and explainable unless a reviewed model contract replaces the baseline.
- Include a migration for every schema change; do not edit an applied migration.
- Document operational, privacy, or model-risk implications.
- Keep UI interactions keyboard accessible and responsive.

## Commit and pull-request style

Use a short imperative subject, such as `Add case escalation policy`. Pull requests should explain the user impact, architecture impact, validation performed, and rollout or rollback considerations.
