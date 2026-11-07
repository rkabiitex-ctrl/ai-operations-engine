# VEXT AI: secure Cloudflare setup

This guide connects the VEXT AI dashboard to its Cloudflare Worker and D1 customer-support database. The dashboard uses Supabase sign-in for owner authentication. Customer website widgets remain public so visitors do not need VEXT AI accounts.

## Before you start

- Dashboard: https://rkabiitex-ctrl.github.io/ai-operations-engine/
- Worker: https://flat-star-50c3.rkabiitex.workers.dev
- Worker source: [cloudflare-worker.js](cloudflare-worker.js)
- New-database schema: [schema.sql](schema.sql)
- Existing-database migration: [business-ownership-migration.sql](business-ownership-migration.sql)
- Website widget: [customer-widget.js](customer-widget.js)

Never put an OpenAI key, Supabase secret/service-role key, or other private credential in GitHub or a customer website embed. The Supabase publishable key in the Worker source is intentionally public; it is used together with each user's private access token.

## 1. Keep the D1 database binding

In Cloudflare, open **Workers & Pages** and select the Worker at the URL above.

1. Open **Settings** → **Bindings**.
2. Confirm there is a D1 database binding named exactly `VEXT_DB`.
3. Confirm it points to the existing `vext-ai-db` database.

Do not create a second database if your existing one already contains the `businesses` and `support_leads` tables.

## 2. Apply the ownership migration once

Because this VEXT AI project already has a D1 database, add the owner column before deploying the updated Worker.

1. In Cloudflare, open **D1 SQL Database** → `vext-ai-db` → **Console**.
2. Open [business-ownership-migration.sql](business-ownership-migration.sql) in this repository.
3. Copy the complete SQL and run it **once only**.
4. Confirm that the `businesses` table now contains an `owner_user_id` column.

Do not run this migration a second time. The existing businesses will have no owner attached and will not be accessible through the new owner-only dashboard endpoints. Each account will create a new business ID when it saves its assistant.

For a brand-new D1 database, use `schema.sql` instead; it already includes the owner column. Do not run the existing-database migration on a database created from the updated schema.

## 3. Update the Cloudflare Worker

1. In Cloudflare, open **Workers & Pages** and select the existing VEXT AI Worker.
2. Choose **Edit code**.
3. Open [cloudflare-worker.js](cloudflare-worker.js) in GitHub.
4. Copy the entire file and replace the Worker editor contents.
5. Keep the existing `OPENAI_API_KEY` secret and the `VEXT_DB` binding.
6. Save and deploy.

The Worker asks the Supabase Auth server to validate the incoming user access token. It then uses the verified Supabase user ID to save a business and to check ownership before returning its cloud enquiries. It does not trust a user ID supplied in the request body.

The Worker source contains the VEXT AI Supabase project URL and its public publishable key. Never replace these with a Supabase secret or service-role key.

The old `VEXT_ADMIN_TOKEN` is no longer used after this Worker is deployed. Keep it until the new flow passes the tests below; then you can remove that old secret from the Worker settings.

## 4. Check the Worker

Open:

`https://flat-star-50c3.rkabiitex.workers.dev/health`

You should see:

```json
{"ok":true,"service":"VEXT AI Support API"}
```

This only confirms the Worker is running. It does not prove that the database migration or account authorization works.

## 5. Test the owner account

1. Open the VEXT AI dashboard and sign in.
2. Refresh the page.
3. Open **Customer Support**.
4. Enter the business name, website, greeting, and business information.
5. Select **Save assistant to cloud**.

The dashboard sends the access token from your Supabase session automatically. There is no shared admin-token field.

When the save succeeds, the website embed code appears. Copy it and install it in the business website just before its closing `</body>` tag.

To check customer enquiries, return to the VEXT AI dashboard, open **Customer Support**, and choose **Load cloud enquiries**. You can then choose **Import into clients** to copy those enquiries into Client Management in this browser.

## Important limits before public launch

- Dashboard records such as clients and invoices are currently stored in browser storage, separated by signed-in account. They do not yet sync between devices and are not yet protected by database-level policies. Move them into owner-scoped cloud tables before selling the platform as a multi-device business system.
- The Cloudflare D1 owner check protects the business assistant and its stored website enquiries. Public customer chat and lead-submission routes are intentionally public.
- The website Origin check is not authentication and can be spoofed by non-browser clients. Add Cloudflare rate limiting and Turnstile or equivalent abuse protection before public traffic.
- Publish a clear privacy notice describing what information is collected, why it is collected, who can access it, and how long it is retained.
- Do not collect passwords, payment-card details, national ID numbers, or sensitive legal/medical information through the support widget.
- Test each account with a separate business ID and confirm that one account cannot load another account's enquiries.
