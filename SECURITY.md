# Security policy

## Supported version

The latest commit on `main` is the only supported version during active development.

## Reporting a vulnerability

Do not open a public GitHub issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository or contact the repository owner privately with:

- the affected route, component, or commit;
- reproduction steps and expected impact;
- any proof of concept with secrets and personal data removed;
- a suggested mitigation, if available.

Please allow reasonable time for triage and remediation before disclosure.

## Security boundary

The repository contains synthetic data only. Secrets, payment credentials, customer records, and production event payloads must never be committed. A production deployment requires the controls listed in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
