-- Run once against the existing VEXT D1 database.
-- Existing rows remain unowned and are intentionally inaccessible through the
-- new account-scoped dashboard until they are recreated under an authenticated account.
ALTER TABLE businesses ADD COLUMN owner_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_businesses_owner
ON businesses (owner_user_id);
