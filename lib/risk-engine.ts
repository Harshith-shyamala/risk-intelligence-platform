export type RiskInput = {
  amount: number;
  country: string;
  homeCountry?: string;
  channel: "card_present" | "card_not_present" | "bank_transfer";
  newDevice: boolean;
  velocity3m: number;
  distanceFromLastKm?: number;
  minutesSinceLast?: number;
};

export type RiskReason = { code: string; label: string; impact: number };
export type RiskResult = {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  recommendation: "approve" | "review" | "block";
  reasons: RiskReason[];
  modelVersion: string;
};

const HIGH_RISK_COUNTRIES = new Set(["NG", "KP", "IR", "SY"]);
export const MODEL_VERSION = "risk-rules-2.4.1";

export function scoreTransaction(input: RiskInput): RiskResult {
  const reasons: RiskReason[] = [];
  let score = 7;
  const add = (code: string, label: string, impact: number) => {
    score += impact;
    reasons.push({ code, label, impact });
  };

  if (input.amount >= 5000)
    add("high_amount", "Transaction exceeds $5,000", 22);
  else if (input.amount >= 1500)
    add("elevated_amount", "Transaction exceeds $1,500", 10);
  if (input.homeCountry && input.country !== input.homeCountry)
    add("cross_border", "Country differs from customer profile", 16);
  if (HIGH_RISK_COUNTRIES.has(input.country))
    add("high_risk_geo", "Higher-risk geography", 18);
  if (input.newDevice) add("new_device", "Previously unseen device", 13);
  if (input.velocity3m >= 10)
    add(
      "velocity_critical",
      `${input.velocity3m} attempts in three minutes`,
      26,
    );
  else if (input.velocity3m >= 5)
    add("velocity_high", `${input.velocity3m} attempts in three minutes`, 13);
  if (
    (input.distanceFromLastKm ?? 0) >= 4000 &&
    (input.minutesSinceLast ?? 999) <= 120
  )
    add("impossible_travel", "Implausible travel from prior activity", 28);
  if (input.channel === "card_not_present")
    add("cnp", "Card-not-present transaction", 6);
  if (reasons.length === 0)
    reasons.push({
      code: "baseline",
      label: "No elevated risk indicators",
      impact: 0,
    });

  score = Math.min(99, Math.max(1, score));
  const level =
    score >= 85
      ? "critical"
      : score >= 65
        ? "high"
        : score >= 35
          ? "medium"
          : "low";
  const recommendation =
    score >= 85 ? "block" : score >= 35 ? "review" : "approve";
  return {
    score,
    level,
    recommendation,
    reasons: reasons.sort((a, b) => b.impact - a.impact),
    modelVersion: MODEL_VERSION,
  };
}

export function validateRiskInput(
  value: unknown,
): { ok: true; data: RiskInput } | { ok: false; errors: string[] } {
  const candidate = value as Partial<RiskInput> | null;
  const errors: string[] = [];
  if (!candidate || typeof candidate !== "object")
    return { ok: false, errors: ["JSON object required"] };
  if (
    typeof candidate.amount !== "number" ||
    !Number.isFinite(candidate.amount) ||
    candidate.amount <= 0 ||
    candidate.amount > 10_000_000
  )
    errors.push("amount must be between 0 and 10,000,000");
  if (!candidate.country || !/^[A-Z]{2}$/.test(candidate.country))
    errors.push("country must be a two-letter ISO code");
  if (candidate.homeCountry && !/^[A-Z]{2}$/.test(candidate.homeCountry))
    errors.push("homeCountry must be a two-letter ISO code");
  if (
    !candidate.channel ||
    !["card_present", "card_not_present", "bank_transfer"].includes(
      candidate.channel,
    )
  )
    errors.push("channel is invalid");
  if (typeof candidate.newDevice !== "boolean")
    errors.push("newDevice must be boolean");
  if (
    !Number.isInteger(candidate.velocity3m) ||
    (candidate.velocity3m ?? -1) < 0 ||
    (candidate.velocity3m ?? 0) > 1000
  )
    errors.push("velocity3m must be an integer from 0 to 1000");
  return errors.length
    ? { ok: false, errors }
    : { ok: true, data: candidate as RiskInput };
}
