# VEXT AI Payments & Subscriptions — implementation boundary

## Current release
- USD catalogue: Starter $29/month or $290/year; Professional $79/month or $790/year; Enterprise by quotation.
- Starter has a one-day trial request, not an automatically activated trial.
- Authenticated workspace stores plan requests under the signed-in account's existing Cloudflare D1 workspace snapshot.
- Billing history currently lists plan/trial requests only. It does not create invoices or claim a payment.
- Feature access panel is informational. It does not grant paid access and is not a security boundary.
- No checkout, recurring charge, refund, cancellation, or provider webhook is active.
- No payment-card or bank credentials are collected or stored.

## Provider activation still required
Choose a provider and configure its API credentials and webhook signing secret as Cloudflare Worker secrets. Never put secrets in GitHub, browser JavaScript, workspace data, or chat. Implement server-created checkout sessions, provider customer/subscription identifiers, verified webhook signatures, idempotent event processing, and server-authoritative entitlement state before activating access. Only verified provider events may mark an invoice paid or a subscription active.

## Required end-to-end acceptance
1. Trial request is stored only for the authenticated owner.
2. Checkout session is created server-side for the correct plan and amount.
3. Webhook signature failure is rejected.
4. Duplicate webhook events are idempotent.
5. Paid/failed/cancelled/refunded events update the correct account only.
6. Server-side feature gates reject inactive or mismatched entitlements.
7. No full card data is logged or persisted.


## Paddle Sandbox integration (first backend slice)
- The Worker maps only four fixed Paddle Sandbox price IDs to Starter/Professional monthly/yearly plans. The browser cannot supply an amount or arbitrary price.
- Authenticated `POST /api/billing/checkout` creates an automatically-collected Paddle transaction using the private `PADDLE_API_KEY` Worker secret and attaches the authenticated Supabase user ID as `custom_data.vext_user_id`.
- Authenticated `GET /api/billing/status` reads the server-side subscription record from D1.
- `POST /api/billing/webhook` verifies the raw request body against the notification destination's `Paddle-Signature` using HMAC-SHA256, rejects stale signatures, and deduplicates event IDs.
- Subscription state is stored in `billing_subscriptions`; processed notification IDs are stored in `billing_webhook_events`.
- Apply `paddle-billing-migration.sql` to the Cloudflare D1 database bound as `VEXT_DB` before deploying this Worker.
- Add `PADDLE_WEBHOOK_SECRET` as a Cloudflare Worker Secret after creating the Sandbox notification destination. Never put either secret in source control or browser code.
- Sandbox API base: `https://sandbox-api.paddle.com`. Live billing is not enabled by this integration.
- This backend slice does not yet connect the pricing buttons to Paddle.js or provide server-side paid-feature gates. Do not advertise checkout as ready or grant paid features until the frontend flow, webhook configuration, and end-to-end Sandbox tests are complete.
