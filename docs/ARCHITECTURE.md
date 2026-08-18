# Risk//OS architecture and production boundary

## Trust boundaries

The browser never supplies identity or authorization claims. The hosting dispatcher authenticates the visitor and forwards stable user headers. Every product-data API checks those server-side headers; localhost receives a clearly isolated demo identity only. D1 is authoritative for transactions, cases, decisions, and audit events.

## Scoring lifecycle

1. The API validates bounded numeric values, ISO country codes, channel enums, and boolean types.
2. `risk-rules-2.4.1` calculates a deterministic score from value, geography, device novelty, transaction velocity, channel, and travel plausibility.
3. The result includes a ranked reason list and an approve/review/block recommendation.
4. The transaction and its model version are persisted atomically with an audit event.
5. Investigator decisions and case creation append additional attributed audit events.

The deterministic engine is intentionally transparent and replaceable. A learned model should implement the same typed contract and run in shadow mode before becoming authoritative.

## Data controls

- Synthetic seed data only; no production account numbers or payment credentials
- Prepared SQL statements for all runtime values
- Indexed queue, chronology, case, and audit lookup paths
- Private, non-cacheable operational responses
- 16 KB request limit and strict field validation
- Human review for all non-low-risk recommendations
- Reversible investigator decisions in this reference implementation

## Before processing real financial data

- Complete SOC 2 / PCI DSS scoping, privacy review, and data-retention design
- Add tenant isolation, role-based permissions, dual control, and managed secrets
- Add a durable rate limiter, idempotency keys, encrypted event transport, and SIEM export
- Validate model calibration, bias, drift thresholds, and adverse-action explainability
- Run penetration, disaster-recovery, load, and failover tests
- Establish model registry approval and champion/challenger rollback procedures
