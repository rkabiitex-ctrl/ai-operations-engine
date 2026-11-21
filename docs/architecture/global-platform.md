# VEXT AI Global Platform Architecture

**Status:** Proposed architecture decision  
**Version:** 1.0  
**Date:** 2026-11-21

## 1. Product decision

VEXT AI will be one technology ecosystem delivered through two distinct products:

- **VEXT BUSINESS** — the operating platform for entrepreneurs, small businesses, teams and larger organisations.
- **VEXT LIFE** — the personal AI platform for individuals, students and professionals. The product name is provisional until brand and domain checks are completed.

Both products share platform services and the VEXT NEXUS intelligence layer. They must have distinct navigation, onboarding, permissions, data boundaries and product experiences. A user should not be forced to see business-management tools in a personal workspace or personal-learning tools in a business workspace.

**VEXT EVERYWHERE is a shared access capability, not a third product:** responsive web, mobile experiences, voice, multilingual support and low-bandwidth operation.

## 2. High-level architecture

```text
                         VEXT AI ECOSYSTEM
                   Intelligence Without Limits
                                  |
                 +----------------+----------------+
                 |                                 |
           VEXT BUSINESS                       VEXT LIFE
       Business operations                Personal intelligence
       Sales / CRM / Marketing             Personal assistant
       Finance / Analytics                 Learning / Tutoring
       Customer support                    Career / Productivity
       Business automation                 Personal workflows
                 |                                 |
                 +----------------+----------------+
                                  |
                           VEXT NEXUS
                 Shared intelligence orchestration
             Context / specialist routing / approvals
                bounded tools / audit / task status
                                  |
                       SHARED PLATFORM SERVICES
       Identity & access | AI gateway | data | files | billing
       notifications | integrations | usage limits | observability
                                  |
                       VEXT EVERYWHERE ACCESS
              Web | mobile | voice | languages | messaging
```

## 3. Product capability map

### VEXT BUSINESS

1. Business workspace and onboarding
2. Sales Agent and customer support
3. Client Management / CRM and follow-up workflows
4. Invoices and financial operations
5. Marketing Studio and campaign workflows
6. Business Analytics and Intelligence Centre
7. Audit Centre, Executive Reports and Management Actions
8. Automation Studio for approved business workflows
9. NEXUS business specialists and action governance
10. Website assistant and lead capture

Existing features are reused and strengthened. A feature is considered delivered only when its workflow is connected to real persisted data, validated, permission-checked and tested.

### VEXT LIFE

1. Personal AI assistant for chat, research, planning and everyday tasks
2. Document workspace for drafting, summarising and understanding user-provided files
3. Learning: tutoring, lessons, practice, assessment and progress
4. Career: CV/portfolio tools, interview practice, skill plans and application tracking
5. Personal productivity: tasks, goals, reminders and approved automations
6. Voice and multilingual experiences
7. Personal settings, privacy controls, data export and account deletion workflow

Learning and Career features must not make unsupported claims about qualifications, job placement or guaranteed outcomes. Career listings, if introduced, require reliable sources and freshness indicators.

### VEXT NEXUS

NEXUS is a shared intelligence and coordination service, not a claim that agents are independently autonomous. It should support:
- specialist routing by product and user intent;
- scoped context retrieval;
- structured task records and bounded tool permissions;
- explicit approval for consequential external actions;
- execution logs, failure states, retries with limits and usage accounting;
- separation of personal and business context.

## 4. Shared platform foundations

- **Identity:** Supabase Auth initially; explicit product entitlements and organisation membership.
- **API and AI gateway:** Cloudflare Workers; secrets remain server-side.
- **Data:** Supabase PostgreSQL is the proposed long-term source of truth. Existing Cloudflare D1 workspace data remains supported during a deliberate migration; no destructive migration or dual-write without reconciliation.
- **Files:** private object storage with signed access and per-user / per-tenant authorization.
- **Billing:** provider integration selected after supported countries, settlement, fees, tax and compliance are reviewed. Pricing pages are not payment processing.
- **Observability:** request IDs, redacted logs, error monitoring, cost/usage metering and operational alerts.
- **Security:** server-side authorization on every data operation, tenant isolation, input validation, rate limits, abuse controls, retention policies and export/deletion workflows.

## 5. Data isolation and account model

Every record must be scoped to an authenticated owner and, where applicable, an organisation/workspace. Business data must never be exposed to another business member without explicit role permissions. Personal data must remain separate from business workspaces unless the user deliberately imports or shares it.

Do not rely on frontend route hiding as authorization. Enforce access rules in the API and database. Define roles such as owner, administrator, manager and member for business workspaces, and keep personal accounts private by default.

Before moving existing records, create a migration inventory, backup, mapping, reconciliation checks and rollback plan. Preserve existing local recovery and JSON export safeguards during transition.

## 6. Delivery approach: parallel product tracks, sequential verification

The programme is coordinated as one architecture, but implementation is split into reviewable increments.

### Track A — Shared platform
- product-aware routing and entitlements;
- shared identity/session handling;
- versioned API contracts;
- secure context and storage boundaries;
- billing, usage limits and observability foundations.

### Track B — VEXT BUSINESS
- preserve and verify existing workflows;
- finish Sales Agent and CRM follow-ups;
- build Marketing Studio workflows;
- build Automation Studio with approvals;
- strengthen onboarding, pricing, customer journey and support.

### Track C — VEXT LIFE
- establish a separate product shell and onboarding;
- deliver Personal Assistant;
- add document workflows;
- deliver Learning foundations;
- deliver Career foundations;
- add personal productivity and voice/multilingual access.

### Track D — VEXT NEXUS
- separate personal and business specialist scopes;
- structured task lifecycle and audit events;
- human approval gates;
- bounded tool execution and cost controls.

Teams/tracks may develop in parallel against agreed contracts. Releases are enabled only after their own tests pass.

## 7. Release gates

A product capability is not marked complete until:
1. authenticated and unauthenticated states behave correctly;
2. account and tenant isolation tests pass;
3. create, edit, delete, refresh and cross-session persistence tests pass;
4. validation, failure and retry paths are tested;
5. privacy and data-export implications are reviewed;
6. accessibility and mobile layouts are checked;
7. AI outputs are evaluated for accuracy, safety and cost;
8. production deployment and rollback are verified.

## 8. Current repository baseline

The existing repository is a GitHub Pages single-page application with:
- `index.html` as the current VEXT Business entry point;
- classic JavaScript feature modules under `assets/js`;
- Supabase Auth in `assets/js/auth.js`;
- Cloudflare Worker API and D1 workspace persistence in `cloudflare-worker.js`;
- existing CRM, invoices, analytics, audit, management actions, notifications and NEXUS foundations;
- architecture smoke checks in `tests/architecture-smoke.mjs`.

The current application must remain operational while the new architecture is introduced. This document does not itself implement the proposed capabilities.

## 9. First implementation sequence

1. Verify PR #23 workspace recovery and current production deployment.
2. Add product-aware entry points while preserving the existing business URL and account data.
3. Establish shared identity, product entitlements and explicit workspace selection.
4. Build VEXT LIFE shell and Personal Assistant against the shared API contract.
5. In parallel, strengthen VEXT BUSINESS Sales Agent and CRM follow-ups.
6. Add Learning, Career, Marketing Studio and Automation Studio in independently testable modules.
7. Introduce NEXUS cross-product routing only after context isolation and permissions tests pass.
8. Add global payments, mobile/voice and multilingual capabilities after operational and compliance review.

## 10. Non-goals and guardrails

- Do not rewrite the current business application from scratch.
- Do not rename the overall VEXT AI brand.
- Do not expose one product's private context to the other by default.
- Do not describe prompt-routed specialists as autonomous agents.
- Do not claim global scale, billions of users, enterprise security certification or guaranteed financial outcomes before evidence exists.
- Do not launch placeholder modules as completed products.
