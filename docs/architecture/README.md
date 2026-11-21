# VEXT AI Architecture

## Current architecture (verified against the repository)

```text
Browser
  ├── index.html
  ├── assets/css/app.css
  ├── assets/js/app.js
  └── assets/js/auth.js
        │
        ├── Supabase Auth (account sessions)
        │
        └── Cloudflare Worker
              ├── verifies Supabase access tokens
              ├── calls the OpenAI Responses API
              ├── stores account workspace data in D1
              └── serves public website chat and lead-capture routes
```

The frontend keeps a local browser copy of selected workspace data and synchronizes supported fields to the Worker. The Worker uses the verified Supabase user ID as the owner key for workspace records.

## Phase 1 — Safe frontend asset separation

- Keep the existing single-page application and all existing DOM IDs.
- Move embedded styles to `assets/css/app.css`.
- Move the existing application script to `assets/js/app.js`.
- Move Supabase sign-in/session handling to `assets/js/auth.js`.
- Load the JavaScript files with `defer`, preserving their order after the Supabase client library.
- Do not change the user interface, business workflows, routes, or data format in this phase.

This is a low-risk structural step, not the final modular architecture. The application logic is still grouped in `app.js` and will be split by feature in later phases.

## Phase 1.1 — Workspace persistence correction

The frontend workspace snapshot includes `management_actions` and `nexus_tasks`. The Worker previously omitted both fields from its accepted workspace-field allowlist. The Worker now accepts them with explicit limits:

- `nexus_tasks`: maximum 100 records.
- `management_actions`: maximum 1,000 records.

Existing account ownership checks remain in place. This change does not migrate old browser-only data automatically; the normal authenticated workspace sync must run after deployment.

## Important backend boundaries

- Supabase Auth authenticates dashboard users.
- The Worker verifies the bearer token with Supabase before handling dashboard chat and admin routes.
- D1 stores the account workspace and business support records.
- The OpenAI API key must remain a Cloudflare Worker secret; it must never be placed in frontend assets.
- Public support-chat and lead-capture routes are intentionally unauthenticated for website visitors. Website Origin checks are not a substitute for abuse protection because non-browser clients can omit or forge Origin headers.

## Risks to address before a public launch

1. Add rate limiting and bot protection to public AI chat and lead-capture endpoints.
2. Add request-size and input validation consistently to every public route.
3. Review error responses so provider or infrastructure details are not exposed to visitors.
4. Add automated tests for authentication, account isolation, workspace validation, and public routes.
5. Move workspace JSON into normalized, indexed tables as usage and reporting requirements grow.
6. Add durable NEXUS task records, agent run records, approval history, and an orchestrator service before describing NEXUS as a multi-agent execution system.

## Planned migration sequence

1. **Frontend extraction:** completed in this branch; no feature behavior intentionally changed.
2. **Feature modules:** split state, navigation, CRM, invoicing, analytics, audit, marketing, and NEXUS into focused modules while preserving the current page.
3. **Core API:** formalize request validation, authorization, tenant scoping, error handling, and rate limits in the Worker.
4. **NEXUS orchestration:** add a server-side task lifecycle, agent delegation, bounded retries, result validation, and human approval gates.
5. **Data model:** migrate selected workspace records into versioned, account-scoped tables with audit history.
6. **Operations:** add automated tests, observability, deployment checks, backups, and recovery procedures.

## Release safety

All changes are proposed on a feature branch and should be reviewed and tested before merging to `main`. Keep the existing production deployment as the rollback point until login, workspace sync, AI chat, CRM, invoices, and NEXUS have been verified after deployment.


## Phase 2.1 — Shared core utilities

- Added `assets/js/core/utils.js` as a dependency-free browser utility layer.
- Moved the ID generator, HTML escaping helper, and currency formatter out of the application entry file.
- Exposed the helpers through frozen `window.VEXTUtils` to preserve classic-script compatibility and existing initialization.
- Loaded utilities before `app.js`; authentication remains after the app script.
- Added automated checks for escaping, currency formatting, script order, and utility usage.

Feature-specific code remains in `app.js` until its DOM dependencies and initialization boundaries are mapped and tested.


## Phase 2.2 — CRM feature module

- Extracted the customer relationship management helpers, follow-up reminders, directory rendering, customer profile rendering, and profile closing behavior into `assets/js/features/crm.js`.
- Loaded the CRM feature script after shared core utilities and before the application entry script.
- Kept the existing classic-script global function names so existing navigation, event handlers, and feature calls continue to resolve without changing stored data formats.
- Added architecture checks for CRM module presence, key renderer ownership, and script load order.

The CRM module continues to use the existing workspace storage helpers and data shape. No database schema or API routes changed.


## Phase 3.1 — Unified workspace context for NEXUS

- Added a shared context builder that summarizes CRM, invoice, audit, management-action and NEXUS records into one bounded business snapshot.
- NEXUS receives the snapshot with each assignment, allowing a specialist to reason across modules rather than relying only on the task prompt.
- The context includes aggregate counts, selected-currency invoice totals and workflow statuses; it excludes customer contact details, enquiry messages, private notes, invoice descriptions and full report contents.
- Currency totals remain separate. Marked-paid amounts are explicitly not represented as bank-verified collections, and invoiced amounts are not represented as profit or recognised revenue.
- The snapshot is generated from the currently loaded workspace data. It is not an independent verification of the business records.
- This phase does not create autonomous agents or permit NEXUS to execute business actions. Existing human-review controls remain unchanged.
