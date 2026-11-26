-- VEXT AI Business Memory (Cloudflare D1)
-- Apply this migration to the VEXT_DB database before deploying the Business Memory Worker routes.

CREATE TABLE IF NOT EXISTS business_memory (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'website', 'document', 'meeting', 'other')),
  source_label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_memory_owner_business_updated
ON business_memory (owner_user_id, business_id, updated_at DESC);
