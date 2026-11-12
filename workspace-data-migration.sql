-- Create per-account cloud workspace storage.
-- Safe to run more than once.
CREATE TABLE IF NOT EXISTS workspace_data (
  owner_user_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspace_data_updated
ON workspace_data (updated_at);
