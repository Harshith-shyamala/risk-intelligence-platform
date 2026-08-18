import { env } from "cloudflare:workers";

export function getD1() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

let initialization: Promise<void> | null = null;

export async function ensureRiskDatabase() {
  if (!initialization) initialization = initialize();
  return initialization;
}

async function initialize() {
  const db = getD1();
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', merchant TEXT NOT NULL, country TEXT NOT NULL, channel TEXT NOT NULL, device_id TEXT NOT NULL, risk_score INTEGER NOT NULL, risk_level TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', decision TEXT, reasons TEXT NOT NULL DEFAULT '[]', model_version TEXT NOT NULL, occurred_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, transaction_id TEXT REFERENCES transactions(id), title TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', owner TEXT NOT NULL DEFAULT 'Unassigned', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    ),
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_id ON transactions(id)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_transactions_risk_status ON transactions(risk_level, status)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_transactions_occurred_at ON transactions(occurred_at)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_cases_status_priority ON cases(status, priority)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id)`,
    ),
  ]);
  const count = await db
    .prepare("SELECT COUNT(*) AS count FROM transactions")
    .first<{ count: number }>();
  if (!count?.count) await seedDemoData();
  await db.prepare("PRAGMA optimize").run();
}

async function seedDemoData() {
  const db = getD1();
  const rows = [
    [
      "TXN-8F21",
      "CUS-1042",
      842000,
      "Aurum Electronics",
      "SG",
      "card_not_present",
      "DEV-91X",
      94,
      "critical",
      "pending",
      null,
      ["Impossible travel", "New device", "High amount"],
      "2026-08-18T14:42:00Z",
    ],
    [
      "TXN-4A77",
      "CUS-8821",
      12800,
      "Cloud Games",
      "US",
      "card_not_present",
      "DEV-66Q",
      89,
      "critical",
      "pending",
      null,
      ["14 attempts in three minutes", "New device"],
      "2026-08-18T14:37:00Z",
    ],
    [
      "TXN-2C09",
      "CUS-3901",
      842000,
      "Northwind Travel",
      "GB",
      "card_not_present",
      "DEV-20N",
      76,
      "high",
      "pending",
      null,
      ["High amount", "Cross-border transaction"],
      "2026-08-18T14:32:00Z",
    ],
    [
      "TXN-7B14",
      "CUS-2140",
      245000,
      "Metro Jewelry",
      "US",
      "card_present",
      "DEV-14A",
      71,
      "high",
      "pending",
      null,
      ["Elevated amount", "Velocity spike"],
      "2026-08-18T14:26:00Z",
    ],
    [
      "TXN-1D88",
      "CUS-9077",
      387500,
      "Global Transfer",
      "NG",
      "bank_transfer",
      "DEV-45K",
      86,
      "critical",
      "pending",
      null,
      ["Higher-risk geography", "New device"],
      "2026-08-18T14:19:00Z",
    ],
    [
      "TXN-9E31",
      "CUS-1128",
      9800,
      "Urban Market",
      "US",
      "card_present",
      "DEV-72V",
      12,
      "low",
      "cleared",
      "approve",
      ["No elevated indicators"],
      "2026-08-18T14:11:00Z",
    ],
    [
      "TXN-3F50",
      "CUS-5520",
      47600,
      "Online Media",
      "CA",
      "card_not_present",
      "DEV-18C",
      43,
      "medium",
      "pending",
      null,
      ["Cross-border transaction", "Card not present"],
      "2026-08-18T14:06:00Z",
    ],
    [
      "TXN-6H03",
      "CUS-7714",
      120500,
      "Lumen Hotels",
      "MX",
      "card_not_present",
      "DEV-62J",
      58,
      "medium",
      "pending",
      null,
      ["New device", "Cross-border transaction"],
      "2026-08-18T13:58:00Z",
    ],
  ] as const;
  await db.batch(
    rows.map((row) =>
      db
        .prepare(
          "INSERT INTO transactions (id, customer_id, amount_cents, currency, merchant, country, channel, device_id, risk_score, risk_level, status, decision, reasons, model_version, occurred_at) VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'risk-rules-2.4.1', ?)",
        )
        .bind(
          row[0],
          row[1],
          row[2],
          row[3],
          row[4],
          row[5],
          row[6],
          row[7],
          row[8],
          row[9],
          row[10],
          JSON.stringify(row[11]),
          row[12],
        ),
    ),
  );
  await db.batch([
    db
      .prepare(
        "INSERT INTO cases (id, transaction_id, title, priority, status, owner, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "CASE-104",
        "TXN-1D88",
        "Potential cross-border account takeover",
        "critical",
        "investigating",
        "Harshith Shyamala",
        "Verify beneficiary and device history.",
      ),
    db
      .prepare(
        "INSERT INTO cases (id, transaction_id, title, priority, status, owner, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        "CASE-103",
        "TXN-7B14",
        "Unusual merchant and velocity pattern",
        "high",
        "open",
        "Unassigned",
        "Awaiting investigator review.",
      ),
  ]);
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
