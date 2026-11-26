-- VEXT AI Paddle webhook event-order guard (Cloudflare D1)
-- Apply this migration ONCE to VEXT_DB if paddle-billing-migration.sql
-- was already applied before last_event_at was added.
ALTER TABLE billing_subscriptions
ADD COLUMN last_event_at TEXT NOT NULL DEFAULT '';
