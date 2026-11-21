import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("assets/css/app.css", "utf8");
const app = readFileSync("assets/js/app.js", "utf8");
const auth = readFileSync("assets/js/auth.js", "utf8");
const worker = readFileSync("cloudflare-worker.js", "utf8");

assert.match(html, /\.\/assets\/css\/app\.css/, "HTML must load the extracted stylesheet");
assert.match(html, /\.\/assets\/js\/app\.js" defer/, "HTML must load the application script with defer");
assert.match(html, /\.\/assets\/js\/auth\.js" defer/, "HTML must load the auth script with defer");
assert.ok(html.indexOf("cdn.jsdelivr.net/npm/@supabase/supabase-js") < html.indexOf("./assets/js/app.js"), "Supabase client must load before app scripts");
assert.ok(html.indexOf("./assets/js/app.js") < html.indexOf("./assets/js/auth.js"), "Application script must load before auth initialization");
assert.doesNotMatch(html, /<style>/i, "Styles must not be embedded in index.html");
assert.doesNotMatch(html, /<script>\s*["']use strict["'];/i, "Application script must not be embedded in index.html");
assert.ok(css.length > 10000, "Extracted stylesheet should contain the existing application styles");
assert.ok(app.includes("function renderNexus"), "NEXUS interface logic must remain present");
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
assert.match(worker, /key === "management_actions" \? 1000/, "Management action count must be bounded");

console.log("VEXT architecture smoke checks passed.");
