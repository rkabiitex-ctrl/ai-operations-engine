-- VEXT AI Paddle Billing (Cloudflare D1)
-- Apply this migration to the VEXT_DB database before deploying the Worker.

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  owner_user_id TEXT PRIMARY KEY,
  paddle_customer_id TEXT NOT NULL DEFAULT '',
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('Starter', 'Professional')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  price_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'paused', 'canceled', 'inactive')),
  next_billed_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
ON billing_subscriptions (status);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_received
ON billing_webhook_events (received_at);
