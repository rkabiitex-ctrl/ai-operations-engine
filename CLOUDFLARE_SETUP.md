# VEXT AI Customer Support: Cloudflare setup

This guide activates the public website chat widget and cloud enquiry inbox. The dashboard code and widget are in this repository, but the Cloudflare Worker and D1 database still need to be configured in your Cloudflare account.

## Before you start

- Worker URL: `https://flat-star-50c3.rkabiitex.workers.dev`
- Dashboard origin: `https://rkabiitex-ctrl.github.io`
- Worker source in this repository: [cloudflare-worker.js](cloudflare-worker.js)
- Database SQL in this repository: [schema.sql](schema.sql)
- Website widget script: [customer-widget.js](customer-widget.js)

Do not put an OpenAI API key or the VEXT admin token in a website embed snippet, public GitHub file, or customer-facing code.

## 1. Create the D1 database

1. Sign in to Cloudflare.
2. Open **Workers & Pages** and find **D1 SQL Database** (or **D1** in the left menu).
3. Create a database named `vext-ai-db`.
4. Open its **Console**.
5. Copy the complete contents of `schema.sql` from this repository and run it in the console.
6. Confirm that the `businesses` and `support_leads` tables exist.

## 2. Update the existing Worker

1. Open **Workers & Pages** and select the Worker currently served at `flat-star-50c3.rkabiitex.workers.dev`.
2. Choose **Edit code**.
3. Open [cloudflare-worker.js](cloudflare-worker.js) in this GitHub repository.
4. Copy the complete file contents and replace the Worker editor contents with it.
5. Do not remove your existing `OPENAI_API_KEY` secret.
6. Save/deploy the Worker after completing the bindings and secrets below.

The new Worker keeps the existing `POST /` chat endpoint working for the VEXT AI Chat page and adds the customer-support API routes.

## 3. Add the D1 binding

In the Worker settings:

1. Open **Settings** → **Bindings**.
2. Add a **D1 database** binding.
3. Set the variable name to exactly `VEXT_DB`.
4. Select the `vext-ai-db` database.
5. Save the binding.

The binding name must be exactly `VEXT_DB` because the Worker source uses `env.VEXT_DB`.

## 4. Add the private admin token

In the Worker settings, open **Variables and Secrets**:

1. Add a secret named exactly `VEXT_ADMIN_TOKEN`.
2. Use a long, unique random value (at least 32 random characters). Generate it in a password manager.
3. Save it as a **Secret**, not a plain text variable.
4. Keep it private. Do not send it to ChatGPT or add it to GitHub.

Keep your existing `OPENAI_API_KEY` secret. The Worker uses it on the server and never places it in the customer website code. The model defaults to `gpt-6-astra`; you can override that with a Worker variable named `OPENAI_MODEL` if your account uses a different model.

## 5. Deploy and check the Worker

Deploy the Worker, then open:

`https://flat-star-50c3.rkabiitex.workers.dev/health`

You should see a small JSON response confirming that the VEXT AI Support API is running. This health check does not confirm that D1 is bound; the dashboard save test checks that.

## 6. Configure the assistant in VEXT AI

1. Open the VEXT AI dashboard and refresh it.
2. Open **Customer Support**.
3. Enter your business name.
4. Enter the exact website domain where the widget will appear, for example `https://example.com`. This enables a basic browser-origin check for chat and lead requests.
5. Add accurate business information: products, prices, service areas, opening hours, policies and contact details.
6. Enter the `VEXT_ADMIN_TOKEN` into the password field in the dashboard. Do not share this token.
7. Select **Save assistant to cloud**.
8. When the save succeeds, the website installation code appears. Copy it.

## 7. Install the website widget

Paste the copied script tag into the business website HTML just before the closing `</body>` tag, then publish the website. The widget opens a chat bubble in the bottom-right corner and lets customers:

- ask questions using the business information you supplied;
- request a callback;
- provide their name and an email address or phone number;
- explicitly agree to be contacted about their enquiry.

The widget sends enquiries to D1. In VEXT AI, enter the admin token again, select **Load cloud enquiries**, and then **Import into clients** to copy new enquiries into the current browser's Client Management records.

## Important launch safeguards

This is an initial cloud-connected prototype, not a finished enterprise support service. Before using it with real customer traffic:

- Add Cloudflare rate limiting and Turnstile or another anti-abuse control to public chat and lead routes. The sample Worker does basic input checks and a honeypot, but does not implement a complete rate limiter.
- Publish a clear privacy notice explaining what customer details are collected, why they are used, who can access them, and how long they are kept.
- Test the registered website domain check, customer consent flow, and lead retrieval.
- Do not collect passwords, payment-card details, national ID numbers, or sensitive legal/medical information through this widget.
- Keep the admin token private and only enter it on a trusted device. The current static dashboard has not yet been upgraded with a full user-login and role-based access system.
- Have a person review uncertain answers and handle complaints, refunds, emergencies, and other sensitive matters.

The website widget is public by design. Only the dashboard admin routes require the admin token. The website domain check is a useful basic control, not strong authentication; add Cloudflare abuse protection before a public launch.
