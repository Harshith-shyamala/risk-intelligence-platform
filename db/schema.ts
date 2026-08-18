import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    merchant: text("merchant").notNull(),
    country: text("country").notNull(),
    channel: text("channel").notNull(),
    deviceId: text("device_id").notNull(),
    riskScore: integer("risk_score").notNull(),
    riskLevel: text("risk_level").notNull(),
    status: text("status").notNull().default("pending"),
    decision: text("decision"),
    reasons: text("reasons").notNull().default("[]"),
    modelVersion: text("model_version").notNull(),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_transactions_risk_status").on(table.riskLevel, table.status),
    index("idx_transactions_occurred_at").on(table.occurredAt),
  ],
);

export const cases = sqliteTable(
  "cases",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").references(() => transactions.id),
    title: text("title").notNull(),
    priority: text("priority").notNull(),
    status: text("status").notNull().default("open"),
    owner: text("owner").notNull().default("Unassigned"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_cases_status_priority").on(table.status, table.priority),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_audit_entity").on(table.entityType, table.entityId)],
);
