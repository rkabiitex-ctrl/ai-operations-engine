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
const intelligenceContext = readFileSync("assets/js/core/intelligence-context.js", "utf8");
const worker = readFileSync("cloudflare-worker.js", "utf8");

assert.match(html, /\.\/assets\/css\/app\.css/, "HTML must load the extracted stylesheet");
assert.match(html, /data-workspace-switch="business"/, "Sidebar must expose VEXT BUSINESS workspace switch");
assert.match(html, /data-workspace-switch="life"/, "Sidebar must expose VEXT LIFE workspace switch");
assert.match(html, /id="marketingDeliverable"/, "Marketing Studio must offer campaign deliverable types");
assert.match(html, /id="marketingRegion"/, "Marketing Studio must capture target market");
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
assert.ok(automation.includes("writeAndSync(\"management_actions\",actions)"), "Automation-created follow-ups must be persisted");
assert.ok(management.includes('sourceTask.status!=="Approved"'), "Only approved NEXUS tasks may create management actions");

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
