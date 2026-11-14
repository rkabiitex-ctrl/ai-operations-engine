-- VEXT AI Sales Agent migration
-- Run once in the Cloudflare D1 SQL console for the VEXT_DB database.
ALTER TABLE support_leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE support_leads ADD COLUMN intent TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE support_leads ADD COLUMN lead_score INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 5);
ALTER TABLE support_leads ADD COLUMN next_action TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_support_leads_business_status_created
ON support_leads (business_id, status, created_at DESC);
