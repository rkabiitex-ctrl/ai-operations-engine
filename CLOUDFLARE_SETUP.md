# VEXT AI: Cloud workspace and Worker setup

## What this adds

VEXT AI uses Supabase to authenticate each account. The Cloudflare Worker verifies the user's access token with Supabase Auth. Cloudflare D1 then stores that user's workspace under their verified Supabase user ID.

Workspace data includes clients, invoices, activity, currency, business details, customer-support settings and VEXT AI chat history. Each account has its own cloud record. The browser also keeps a local copy for responsiveness and offline fallback.

## Existing Cloudflare resources

- Dashboard: https://rkabiitex-ctrl.github.io/ai-operations-engine/
- Worker: https://flat-star-50c3.rkabiitex.workers.dev
- Existing D1 database: `vext-ai-db`
- Required D1 binding: `VEXT_DB`
- Worker source: [cloudflare-worker.js](cloudflare-worker.js)
- Existing ownership migration: [business-ownership-migration.sql](business-ownership-migration.sql)
- Workspace migration: [workspace-data-migration.sql](workspace-data-migration.sql)

Do not create another D1 database if `vext-ai-db` already exists.

## Step 1 — Create the workspace table

1. Open Cloudflare → **D1 SQL Database** → `vext-ai-db` → **Console**.
2. Open [workspace-data-migration.sql](workspace-data-migration.sql) in GitHub.
3. Copy the complete SQL file and run it in the D1 Console.
4. Confirm that a table named `workspace_data` exists.

This migration uses `CREATE TABLE IF NOT EXISTS`, so it is safe to run again.

## Step 2 — Update the Cloudflare Worker

1. Open Cloudflare → **Workers & Pages** → your existing VEXT AI Worker.
2. Select **Edit code**.
3. Open [cloudflare-worker.js](cloudflare-worker.js) in GitHub and select **Raw**.
4. Copy the entire file and replace the code in Cloudflare's editor.
5. Keep the existing `VEXT_DB` binding and `OPENAI_API_KEY` secret.
6. Click **Deploy**.

The old `VEXT_ADMIN_TOKEN` is not used by the updated Worker. Keep it until dashboard and customer-widget tests pass; then it can be removed from Worker secrets.

## Step 3 — Test cloud workspace sync

1. Open VEXT AI and sign in.
2. Wait until the status beside the currency selector says **Cloud synced**.
3. Open **Client Management** and add a test client.
4. Open **Invoices** and create a test invoice.
5. Wait for **Cloud synced**.
6. Sign out and sign in to the same account from another browser or device.
7. Confirm the test client and invoice appear there.

Then test a second account and confirm that it sees only its own clients and invoices.

## Important limitations before launch

- Cloud workspace data is stored as one JSON document per account. This is suitable for the current prototype but should later move to normalized tables with database constraints and audit history as usage grows.
- The public support widget is intentionally accessible without a VEXT AI account. Add Cloudflare rate limiting and Turnstile before public traffic; the website Origin header is not authentication.
- Publish a privacy notice explaining collected customer information, its purpose, who can access it and retention time.
- Do not collect passwords, payment-card details, national ID numbers or sensitive legal/medical information through the support widget.
- Keep email confirmation enabled before public registration.
