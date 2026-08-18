CREATE INDEX `idx_audit_entity` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_cases_status_priority` ON `cases` (`status`,`priority`);--> statement-breakpoint
CREATE INDEX `idx_transactions_risk_status` ON `transactions` (`risk_level`,`status`);--> statement-breakpoint
CREATE INDEX `idx_transactions_occurred_at` ON `transactions` (`occurred_at`);