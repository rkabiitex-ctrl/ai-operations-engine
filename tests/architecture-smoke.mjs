import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("assets/css/app.css", "utf8");
const app = readFileSync("assets/js/app.js", "utf8");
const auth = readFileSync("assets/js/auth.js", "utf8");
const utilsSource = readFileSync("assets/js/core/utils.js", "utf8");
const crm = readFileSync("assets/js/features/crm.js", "utf8");
const management = readFileSync("assets/js/features/management.js", "utf8");
const automation = readFileSync("assets/js/features/automation.js", "utf8");
const salesIntelligence = readFileSync("assets/js/features/sales-intelligence.js", "utf8");
const crmAdvanced = readFileSync("assets/js/features/crm-advanced.js", "utf8");
const salesIntelligenceCss = readFileSync("assets/css/sales-intelligence.css", "utf8");
const lifeSuite = readFileSync("assets/js/features/life-suite.js", "utf8");
const lifeCss = readFileSync("assets/css/life-suite.css", "utf8");
const billing = readFileSync("assets/js/features/billing.js", "utf8");
const billingCss = readFileSync("assets/css/billing.css", "utf8");
const intelligenceContext = readFileSync("assets/js/core/intelligence-context.js", "utf8");
const worker = readFileSync("cloudflare-worker.js", "utf8");

assert.match(html, /\.\/assets\/css\/app\.css/, "HTML must load the extracted stylesheet");
assert.match(html, /data-page="sales-intelligence"/, "Business navigation must expose Sales Intelligence");
assert.match(html, /id="sales-intelligence"/, "Sales Intelligence page must be present");
assert.match(html, /sales-intelligence\.js" defer/, "Sales Intelligence module must load");
assert.ok(html.indexOf("sales-intelligence.js") < html.indexOf("./assets/js/app.js"), "Sales Intelligence module must load before app initialization");
assert.ok(app.includes("window.VEXTSalesIntelligence.init"), "Sales Intelligence must initialize in app.js");
assert.ok(app.includes("vextSalesIntelligence.render()"), "Sales Intelligence must render when opened");
assert.ok(salesIntelligence.includes("function scoreOf"), "Sales Intelligence must calculate explainable lead scores");
assert.ok(salesIntelligenceCss.length > 500, "Sales Intelligence must include responsive styles");
assert.match(html, /data-workspace-switch="business"/, "Sidebar must expose VEXT BUSINESS workspace switch");
assert.match(html, /data-workspace-switch="life"/, "Sidebar must expose VEXT LIFE workspace switch");
assert.match(html, /id="marketingDeliverable"/, "Marketing Studio must offer campaign deliverable types");
assert.match(html, /id="marketingRegion"/, "Marketing Studio must capture target market");
assert.match(html, /data-life-tab="planner"/, "VEXT LIFE must expose the Life Planner");
assert.match(html, /data-life-tab="learning"/, "VEXT LIFE must expose the Study Coach");
assert.match(html, /data-life-tab="career"/, "VEXT LIFE must expose the Career Coach");
assert.match(html, /data-life-tab="finance"/, "VEXT LIFE must expose Personal Finance");
assert.match(html, /data-life-tab="wellness"/, "VEXT LIFE must expose Wellness and Habits");
assert.match(html, /assets\/css\/life-suite\.css/, "VEXT LIFE suite stylesheet must load");
assert.match(html, /assets\/js\/features\/life-suite\.js" defer/, "VEXT LIFE suite module must load");
assert.ok(lifeSuite.includes("window.VEXTLifeRefresh"), "VEXT LIFE must refresh after account workspace hydration");
assert.ok(lifeCss.length > 1000, "VEXT LIFE suite must include its own responsive styles");
assert.match(html, /\.\/assets\/js\/core\/utils\.js" defer/, "HTML must load core utilities with defer");
assert.match(html, /\.\/assets\/js\/features\/crm\.js" defer/, "HTML must load CRM feature module with defer");
assert.match(html, /\.\/assets\/js\/app\.js" defer/, "HTML must load the application script with defer");
assert.match(html, /\.\/assets\/js\/features\/automation\.js" defer/, "HTML must load the automation module");
assert.ok(html.indexOf("./assets/js/features/automation.js") < html.indexOf("./assets/js/app.js"), "Automation module must load before app initialization");
assert.match(html, /\.\/assets\/js\/auth\.js" defer/, "HTML must load the auth script with defer");
assert.ok(html.indexOf("cdn.jsdelivr.net/npm/@supabase/supabase-js") < html.indexOf("./assets/js/app.js"), "Supabase client must load before app scripts");
assert.ok(html.indexOf("./assets/js/core/utils.js") < html.indexOf("./assets/js/features/crm.js"), "Core utilities must load before CRM");
assert.ok(html.indexOf("./assets/js/features/crm.js") < html.indexOf("./assets/js/app.js"), "CRM module must load before the application");
assert.ok(crm.includes("function renderLeads"), "CRM module must contain the customer directory renderer");
assert.ok(crm.includes("function renderClientProfile"), "CRM module must contain the customer profile renderer");
assert.match(html, /features\/crm-advanced\.js" defer/, "Smart CRM relationship module must load");
assert.ok(html.includes('id="crmRelationshipTitle"') && html.includes('id="crmRelationshipForm"'), "Smart CRM must expose its relationship hub");
assert.ok(app.includes("window.VEXTCRMAdvanced.init"), "Smart CRM relationship intelligence must initialize");
assert.ok(app.includes("window.VEXTCRMAdvanced.render()"), "Smart CRM relationship metrics must refresh with workspace renders");
assert.ok(crmAdvanced.includes("client.segment="), "Smart CRM must support customer segmentation");
assert.ok(crmAdvanced.includes("client.preferredChannel="), "Smart CRM must store preferred contact channels");
assert.ok(crmAdvanced.includes("client.activityLog.push"), "Smart CRM must record relationship interactions in the activity timeline");
assert.ok(crmAdvanced.includes("lastInteractionAt"), "Smart CRM must track last interaction for relationship insights");

assert.ok(!app.includes("function renderLeads"), "CRM renderer must not remain duplicated in app.js");
assert.ok(html.indexOf("./assets/js/app.js") < html.indexOf("./assets/js/auth.js"), "Application script must load before auth initialization");
assert.doesNotMatch(html, /<style>/i, "Styles must not be embedded in index.html");
assert.doesNotMatch(html, /<script>\s*["']use strict["'];/i, "Application script must not be embedded in index.html");
assert.ok(css.length > 10000, "Extracted stylesheet should contain the existing application styles");
assert.ok(html.indexOf("./assets/js/core/intelligence-context.js") < html.indexOf("./assets/js/app.js"), "Unified context engine must load before app.js");
assert.match(app, /window\.VEXTContext\.build/, "NEXUS must receive the unified workspace context");
const contextWindow = { Date, window: {} };
runInNewContext(intelligenceContext, contextWindow);
const sampleData = {
  invoices: [
    { amount: 100, currency: "USD", status: "Paid" },
    { amount: 50, currency: "USD", status: "Unpaid" },
    { amount: 900, currency: "EUR", status: "Paid" }
  ],
  leads: [{ salesStage: "Qualified", email: "private@example.com", notes: "private note" }],
  audit_reports: [{ issueCount: 2 }],
  management_actions: [
    { status: "Pending", dueDate: "2020-01-01", owner: "Finance", sourceNexusTaskId: "task-1" },
    { status: "In Progress", dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), owner: "" },
    { status: "Completed", dueDate: "2020-01-01", owner: "Operations" }
  ],
  nexus_tasks: [{ status: "Awaiting review" }]
};
const context = contextWindow.window.VEXTContext.build({
  read: key => sampleData[key] || [],
  currentCurrency: () => "USD",
  business: "Example Co",
  country: "UG"
});
assert.equal(context.financials.invoicedAmount, 150, "Context must aggregate only the selected currency");
assert.equal(context.financials.markedPaidAmount, 100, "Context must distinguish marked-paid totals");
assert.equal(context.customerPipeline.clientRecordCount, 1);
assert.equal(context.governance.latestAuditIssueCount, 2);
assert.equal(context.governance.actionExecution.activeCount, 2, "Completed actions must be excluded from active work");
assert.equal(context.governance.actionExecution.completedCount, 1);
assert.equal(context.governance.actionExecution.overdueCount, 1, "Overdue actions must be based on saved due dates");
assert.equal(context.governance.actionExecution.dueWithinSevenDaysCount, 1);
assert.equal(context.governance.actionExecution.unassignedActiveCount, 1);
assert.equal(context.governance.actionExecution.linkedToNexusCount, 1);
assert.equal(context.governance.actionExecution.completionRatePercent, 33);
assert.equal(context.governance.managementActionRecords.length, 3, "NEXUS must receive minimal action-level fields");
assert.equal(context.governance.managementActionRecords[0].owner, "Finance");
assert.equal(context.governance.managementActionRecords[0].dueDate, "2020-01-01");
assert.equal(context.governance.managementActionRecords[0].linkedToNexus, true);
assert.ok(!JSON.stringify(context.governance.managementActionRecords).includes("private@example.com"), "Action context must not expose customer data");
assert.equal(context.nexus.taskStatuses["Awaiting review"], 1);
const serializedContext = JSON.stringify(context);
assert.ok(!serializedContext.includes("private@example.com"), "Context must not expose customer contact details");
assert.ok(!serializedContext.includes("private note"), "Context must not expose private CRM notes");

assert.ok(app.includes("function renderNexus"), "NEXUS interface logic must remain present");
assert.match(app, /window\.VEXTUtils/, "Application must consume shared core utilities");
assert.doesNotMatch(app, /function (id|esc|formatMoney)\s*\(/, "Extracted helpers must not be duplicated in app.js");
const utilityContext = {};
runInNewContext(utilsSource, utilityContext);
assert.equal(utilityContext.VEXTUtils.esc("safe & sound"), "safe &amp; sound");
assert.equal(utilityContext.VEXTUtils.formatMoney(1234.5, "USD"), "$1,234.50");
assert.ok(utilityContext.VEXTUtils.id().length > 0);
assert.ok(app.includes("function workspaceSnapshot"), "Workspace snapshot logic must remain present");
assert.ok(auth.includes("createClient"), "Supabase authentication client must remain present");

const workspaceKeysMatch = app.match(/const VEXT_WORKSPACE_KEYS\s*=\s*\[([^\]]+)\]/);
assert.ok(workspaceKeysMatch, "Frontend workspace key registry must exist");
const frontendKeys = [...workspaceKeysMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const workerAllowedMatch = worker.match(/const allowed\s*=\s*\[([^\]]+)\]/);
assert.ok(workerAllowedMatch, "Worker workspace allowlist must exist");
const workerKeys = new Set([...workerAllowedMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
for (const key of frontendKeys) {
  assert.ok(workerKeys.has(key), `Worker workspace allowlist is missing frontend field: ${key}`);
}
assert.match(worker, /key === "nexus_tasks" \? 100/, "NEXUS task count must be bounded");
assert.match(worker, /key === "marketing_drafts"/, "Worker must validate marketing drafts");
assert.match(worker, /key === "management_actions" \? 1000/, "Management action count must be bounded");
assert.match(worker, /"management_actions", "nexus_tasks", "notifications"\]\.includes\(key\)/, "Worker must validate action and NEXUS task data as arrays");

assert.match(app, /data-nexus-create-action/, "Approved NEXUS tasks must expose the action bridge");
assert.match(app, /function extractNexusActionTitle/, "Action bridge must derive a reviewable action title");
assert.ok(management.includes("sourceNexusTaskId"), "Management actions created from NEXUS must retain their source task");
assert.ok(automation.includes("async function handleNewLead"), "Automation must process newly created client events");
assert.ok(automation.includes('persist("management_actions",actions)'), "Automation-created follow-ups must be persisted");
assert.ok(management.includes('sourceTask.status!=="Approved"'), "Only approved NEXUS tasks may create management actions");


const paddleMigration = readFileSync("paddle-billing-migration.sql", "utf8");
assert.ok(worker.includes("/api/billing/checkout"), "Worker must expose authenticated Paddle checkout creation");
assert.ok(worker.includes("/api/billing/status"), "Worker must expose account-owned billing status");
assert.ok(worker.includes("/api/billing/webhook"), "Worker must expose Paddle webhook handling");
assert.ok(worker.includes("verifyPaddleSignature") && worker.includes("Paddle-Signature"), "Webhook handler must verify Paddle signatures");
assert.ok(worker.includes("INSERT OR IGNORE INTO billing_webhook_events"), "Webhook processing must be idempotent");
assert.ok(worker.includes("sandbox-api.paddle.com"), "Checkout must use the Paddle Sandbox API");
assert.ok(paddleMigration.includes("CREATE TABLE IF NOT EXISTS billing_subscriptions"), "D1 migration must create subscription storage");
assert.ok(paddleMigration.includes("CREATE TABLE IF NOT EXISTS billing_webhook_events"), "D1 migration must create webhook idempotency storage");
console.log("VEXT architecture smoke checks passed.");

assert.match(app, /async function writeAndSync/, "Critical Management Action writes must support immediate cloud persistence");
assert.match(app, /if\(!Object\.prototype\.hasOwnProperty\.call\(workspace,name\)\)return/, "Older cloud snapshots must not delete newer local workspace fields");
assert.match(management, /await writeAndSync\("management_actions",actions\)/, "Management Action create and edit must await cloud persistence");
assert.match(app, /vext-ai-full-workspace-backup\.json/, "Full workspace backup export must be available");
assert.match(app, /function saveWorkspaceRecovery/, "Workspace recovery checkpoints must be retained locally");
assert.match(app, /Local data found before cloud refresh/, "Local records must be checkpointed before cloud refresh");
assert.match(app, /function restoreWorkspaceRecovery/, "Users must be able to restore a recovery checkpoint");
assert.ok(app.includes("if(!Object.prototype.hasOwnProperty.call(mergedRemote,name)&&"), "Missing cloud fields must be recovered from the local snapshot");
assert.ok(html.includes('id="workspaceRecoveryStatus"')&&html.includes('id="restoreWorkspaceRecovery"'), "Settings must expose the recovery status and restore control");

assert.match(html, /id="automationCondition"/, "Automation must expose conditional workflow rules");
assert.match(html, /id="automationRequireApproval"/, "Automation must expose human approval gates");
assert.match(html, /id="automationRetryCount"/, "Automation must expose bounded retry settings");
assert.match(automation, /async function executeRun/, "Automation must execute multi-step workflows");
assert.match(automation, /status==="awaiting_approval"/, "Automation runs must wait for human approval");
assert.match(automation, /maxRetries=Math\.min\(2/, "Automation retries must be bounded to two retries");
assert.match(automation, /sourceAutomationRunId/, "Workflow steps must be idempotent across retries");
assert.match(worker, /workflowEnabled: value\.workflowEnabled === true/, "Worker must validate advanced automation settings");

assert.match(html, /id="billingHistory"/, "Billing history must be visible");
assert.match(html, /id="billingEntitlements"/, "Plan feature access overview must be visible");
assert.match(html, /Request 1-day trial/, "Starter must offer a one-day trial request");
assert.match(html, /data-checkout="Starter"/, "Starter must expose Sandbox checkout");
assert.match(html, /data-checkout="Professional"/, "Professional must expose Sandbox checkout");
assert.ok(html.includes("cdn.paddle.com/paddle/v2/paddle.js"), "Paddle.js must load in the dashboard");
assert.doesNotMatch(html, /7-day free trial/, "Pricing must not advertise a seven-day trial");
assert.ok(html.includes("features/billing.js"), "Billing module must load before app initialization");
assert.ok(app.includes("billing_subscription") && app.includes("billing_events"), "Billing data must be included in workspace snapshots");
assert.ok(worker.includes('"billing_subscription", "billing_events"'), "Worker must allow only the billing workspace fields");
assert.match(worker, /value\.status === "request_pending" \? "request_pending" : "inactive"/, "Client data must never activate paid subscriptions");

assert.ok(billing.includes("request_pending") && billing.includes("Feature access is not enabled"), "Billing must not treat requests or checkout callbacks as paid entitlements");
assert.ok(billing.includes('Paddle.Environment.set("sandbox")') && billing.includes("Paddle.Checkout.open({transactionId"), "Billing must initialize Paddle Sandbox and open server-created transactions");
assert.ok(billing.includes("/api/billing/checkout") && billing.includes("/api/billing/status"), "Billing UI must use authenticated Worker checkout and status endpoints");
assert.ok(billing.includes("verified subscription update"), "Checkout completion must wait for verified subscription status");
assert.ok(billingCss.length > 500, "Billing UI must have dedicated responsive styling");
