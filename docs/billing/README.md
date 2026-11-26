# VEXT AI Payments & Subscriptions — implementation boundary

## Current release
- USD catalogue: Starter $29/month or $290/year; Professional $79/month or $790/year; Enterprise by quotation.
- Starter has a one-day trial request, not an automatically activated trial.
- Paddle checkout UI and server-created transactions are configured for **Sandbox only**.
- Signed Paddle subscription notifications can be persisted to Cloudflare D1 after the migration and Worker secrets are configured.
- The billing page shows provider-confirmed subscription status; it does not grant paid feature access.
- Transaction notification events are currently acknowledged and ignored. They do not mark invoices paid or grant entitlements.
- No Live charges or production paid-feature gates are enabled.
- VEXT AI does not collect or store card data.

## Sandbox configuration
- The Worker maps only four fixed Paddle Sandbox price IDs to Starter/Professional monthly/yearly plans. The browser cannot supply an amount or arbitrary price.
- Authenticated `POST /api/billing/checkout` creates an automatically-collected Paddle transaction using the private `PADDLE_API_KEY` Worker secret and attaches the authenticated Supabase user ID as `custom_data.vext_user_id`.
- Authenticated `GET /api/billing/status` reads the server-side subscription record from D1.
- `POST /api/billing/webhook` verifies the raw request body against the notification destination's `Paddle-Signature` using HMAC-SHA256 and rejects signatures older than five minutes.
- Subscription events are deduplicated by event ID and stored in `billing_subscriptions`; event IDs are recorded in `billing_webhook_events`.
- The subscription record stores Paddle's `occurred_at` timestamp. An event older than the last accepted subscription event is acknowledged as stale and cannot overwrite newer status.
- Transaction events such as `transaction.completed`, `transaction.paid`, and `transaction.payment_failed` currently return `{ "ok": true, "ignored": true }`. They are not processed for accounting or access.

## D1 migrations
- For a new D1 database, apply `paddle-billing-migration.sql`.
- If the original billing migration was already applied, apply `paddle-billing-event-order-migration.sql` **once** to add the provider event timestamp. Do not run the incremental `ALTER TABLE` migration more than once.
- The database must be bound to the Worker as `VEXT_DB`.

## Worker secrets
- Add `PADDLE_API_KEY` as a Cloudflare Worker Secret using a Sandbox API key.
- Add `PADDLE_WEBHOOK_SECRET` as a Cloudflare Worker Secret from the Sandbox notification destination.
- Never put either secret in source control, browser JavaScript, workspace data, or chat.
- Sandbox API base: `https://sandbox-api.paddle.com`. Live billing is not enabled.

## Required end-to-end acceptance before paid access
1. Authenticated checkout creates a transaction for the selected fixed price.
2. Sandbox checkout completes and Paddle emits a subscription event with the VEXT account reference.
3. Valid signed subscription events persist the correct account, plan, billing period, and status.
4. Invalid signatures are rejected; duplicate event IDs are idempotent.
5. Out-of-order events cannot roll subscription state backward.
6. Cancellation, pause, resume, and past-due transitions are verified.
7. Server-side feature gates reject inactive or mismatched entitlements.
8. No full card data is logged or persisted.

Do not switch to Live or enable paid features until merchant approval, payout configuration, end-to-end Sandbox tests, event ordering, and server-side entitlement enforcement are complete.
