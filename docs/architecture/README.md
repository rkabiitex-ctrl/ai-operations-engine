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
