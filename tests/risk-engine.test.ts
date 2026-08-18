import assert from "node:assert/strict";
import test from "node:test";
import { scoreTransaction, validateRiskInput } from "../lib/risk-engine.ts";

test("scores a normal domestic card-present transaction as low risk", () => {
  const result = scoreTransaction({ amount: 42, country: "US", homeCountry: "US", channel: "card_present", newDevice: false, velocity3m: 1 });
  assert.equal(result.score, 7);
  assert.equal(result.level, "low");
  assert.equal(result.recommendation, "approve");
});

test("blocks an impossible-travel high-value velocity event", () => {
  const result = scoreTransaction({ amount: 8200, country: "SG", homeCountry: "US", channel: "card_not_present", newDevice: true, velocity3m: 12, distanceFromLastKm: 6800, minutesSinceLast: 40 });
  assert.equal(result.score, 99);
  assert.equal(result.level, "critical");
  assert.equal(result.recommendation, "block");
  assert.ok(result.reasons.some(reason => reason.code === "impossible_travel"));
});

test("rejects malformed and unbounded inputs", () => {
  const result = validateRiskInput({ amount: -1, country: "USA", channel: "wire", newDevice: "yes", velocity3m: -2 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.length >= 4);
});
