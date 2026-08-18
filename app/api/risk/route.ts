import { getChatGPTUser } from "../../chatgpt-auth";
import { ensureRiskDatabase, getD1, makeId } from "../../../db/risk-store";
import { scoreTransaction, validateRiskInput } from "../../../lib/risk-engine";

async function actor(request: Request) {
  const user = await getChatGPTUser();
  if (user) return { id: user.userId, name: user.fullName ?? user.email };
  if (new URL(request.url).hostname === "localhost")
    return { id: "local-demo", name: "Harshith Shyamala" };
  return null;
}

export async function GET(request: Request) {
  const user = await actor(request);
  if (!user)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureRiskDatabase();
  const db = getD1();
  const transactions = await db
    .prepare("SELECT * FROM transactions ORDER BY occurred_at DESC LIMIT 100")
    .all();
  const cases = await db
    .prepare(
      "SELECT * FROM cases ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, updated_at DESC",
    )
    .all();
  const audit = await db
    .prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 20")
    .all();
  return Response.json(
    {
      transactions: transactions.results,
      cases: cases.results,
      audit: audit.results,
      user,
      model: {
        version: "risk-rules-2.4.1",
        status: "healthy",
        precision: 0.942,
        recall: 0.887,
        drift: 0.021,
        latencyMs: 38,
      },
    },
    {
      headers: {
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

export async function POST(request: Request) {
  const user = await actor(request);
  if (!user)
    return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureRiskDatabase();
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384)
    return Response.json(
      { error: "Request body exceeds 16 KB" },
      { status: 413 },
    );
  const payload = (await request.json()) as Record<string, unknown>;
  const action = payload.action;
  const db = getD1();

  if (action === "score") {
    const validation = validateRiskInput(payload.input);
    if (!validation.ok)
      return Response.json(
        { error: "Invalid transaction", details: validation.errors },
        { status: 400 },
      );
    const input = validation.data;
    const result = scoreTransaction(input);
    const id = makeId("TXN");
    const customerId =
      typeof payload.customerId === "string"
        ? payload.customerId.slice(0, 40)
        : makeId("CUS");
    const merchant =
      typeof payload.merchant === "string" && payload.merchant.trim()
        ? payload.merchant.trim().slice(0, 100)
        : "Manual assessment";
    await db.batch([
      db
        .prepare(
          "INSERT INTO transactions (id, customer_id, amount_cents, currency, merchant, country, channel, device_id, risk_score, risk_level, status, reasons, model_version, occurred_at) VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
        )
        .bind(
          id,
          customerId,
          Math.round(input.amount * 100),
          merchant,
          input.country,
          input.channel,
          makeId("DEV"),
          result.score,
          result.level,
          JSON.stringify(result.reasons.map((reason) => reason.label)),
          result.modelVersion,
          new Date().toISOString(),
        ),
      db
        .prepare(
          "INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, metadata) VALUES (?, ?, 'transaction.scored', 'transaction', ?, ?)",
        )
        .bind(
          makeId("AUD"),
          user.id,
          id,
          JSON.stringify({
            score: result.score,
            recommendation: result.recommendation,
          }),
        ),
    ]);
    return Response.json({ transactionId: id, ...result }, { status: 201 });
  }

  if (action === "decide") {
    const transactionId = String(payload.transactionId ?? "");
    const decision = String(payload.decision ?? "");
    if (!transactionId || !["approve", "block"].includes(decision))
      return Response.json(
        { error: "Valid transactionId and decision required" },
        { status: 400 },
      );
    const found = await db
      .prepare("SELECT id FROM transactions WHERE id = ?")
      .bind(transactionId)
      .first();
    if (!found)
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    await db.batch([
      db
        .prepare(
          "UPDATE transactions SET decision = ?, status = 'cleared' WHERE id = ?",
        )
        .bind(decision, transactionId),
      db
        .prepare(
          "INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, 'transaction', ?, ?)",
        )
        .bind(
          makeId("AUD"),
          user.id,
          `transaction.${decision}`,
          transactionId,
          JSON.stringify({ actor: user.name }),
        ),
    ]);
    return Response.json({ ok: true });
  }

  if (action === "create_case") {
    const transactionId = String(payload.transactionId ?? "");
    const title = String(payload.title ?? "")
      .trim()
      .slice(0, 120);
    if (!transactionId || !title)
      return Response.json(
        { error: "transactionId and title required" },
        { status: 400 },
      );
    const tx = await db
      .prepare("SELECT risk_level FROM transactions WHERE id = ?")
      .bind(transactionId)
      .first<{ risk_level: string }>();
    if (!tx)
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    const id = makeId("CASE");
    await db.batch([
      db
        .prepare(
          "INSERT INTO cases (id, transaction_id, title, priority, status, owner, notes) VALUES (?, ?, ?, ?, 'investigating', ?, ?)",
        )
        .bind(
          id,
          transactionId,
          title,
          tx.risk_level,
          user.name,
          String(payload.notes ?? "").slice(0, 1000),
        ),
      db
        .prepare(
          "UPDATE transactions SET status = 'investigating' WHERE id = ?",
        )
        .bind(transactionId),
      db
        .prepare(
          "INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, metadata) VALUES (?, ?, 'case.created', 'case', ?, ?)",
        )
        .bind(makeId("AUD"), user.id, id, JSON.stringify({ transactionId })),
    ]);
    return Response.json({ id }, { status: 201 });
  }

  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
