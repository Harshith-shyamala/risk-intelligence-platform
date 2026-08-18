# Risk//OS

Risk//OS is a production-shaped financial risk intelligence workspace for real-time transaction scoring, explainable alerts, investigator decisions, case management, model-health visibility, and auditable operations.

> The included dataset is entirely synthetic. Risk//OS is a portfolio-ready reference implementation and must undergo regulatory, security, model-risk, and data-governance review before handling real financial decisions.

## Product capabilities

- Explainable transaction scoring with ranked risk factors and a versioned model
- Live investigator queue ordered by signal severity
- Approve, block, and create-case workflows with durable audit events
- Searchable transaction explorer and persistent case board
- Model precision, recall, feature-drift, and latency monitoring surfaces
- Strict input validation, request-size limits, authenticated writes, and private no-store responses
- Responsive operations UI with synthetic data labeling

## Architecture

- **Application:** React 19 and vinext on Cloudflare Workers
- **Persistence:** Cloudflare D1 / SQLite with Drizzle migrations
- **Identity:** Sites-provided authenticated user headers; local development uses an isolated demo identity
- **Scoring:** deterministic, versioned explainable-risk baseline in `lib/risk-engine.ts`
- **Operations:** health endpoint at `/api/health`; audit events stored for investigator actions

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for boundaries, threat controls, and the path to a regulated deployment.

## Local development

```bash
npm install
npm run dev
```

The local runtime creates and seeds an isolated D1 database automatically.

## Quality checks

```bash
npm run check
```

This runs unit tests, the deployment build, and server-render verification.

## API

`GET /api/risk` returns the authenticated operations dataset. `POST /api/risk` accepts three actions:

- `score` — validate and score a new synthetic transaction
- `decide` — approve or block a reviewed transaction
- `create_case` — open an attributed investigation

All production product-data routes require platform-authenticated identity.
