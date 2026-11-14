const DASHBOARD_ORIGIN = "https://rkabiitex-ctrl.github.io";
const SUPABASE_URL = "https://nakydtwssxlbtpocxmwh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jOxJl50SORuiYbTZ2Gq7yw_KiySZ56e";
const DEFAULT_MODEL = "gpt-6-astra";

function isDashboardPath(path) {
  return path === "/" || path === "/api/chat" || path.startsWith("/api/admin/");
}

function headersFor(path) {
  const dashboard = isDashboardPath(path);
  return {
    "Access-Control-Allow-Origin": dashboard ? DASHBOARD_ORIGIN : "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function getToken(request) {
  return (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function authenticateUser(request) {
  const accessToken = getToken(request);
  if (!accessToken) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    method: "GET",
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": "Bearer " + accessToken
    }
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && typeof user.id === "string" ? user : null;
}

async function callAI(env, instructions, message) {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured in Worker secrets.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
      instructions,
      input: message,
      max_output_tokens: 700
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error && data.error.message ? data.error.message : "AI request failed.";
    throw new Error(detail);
  }
  let reply = typeof data.output_text === "string" ? data.output_text : "";
  if (!reply && Array.isArray(data.output)) {
    for (const item of data.output) {
      for (const part of (item.content || [])) {
        if (part.type === "output_text" && typeof part.text === "string") reply += part.text;
      }
    }
  }
  if (!reply.trim()) throw new Error("The AI service returned an empty response.");
  return reply.trim();
}

function checkWebsiteOrigin(request, website) {
  const origin = request.headers.get("Origin");
  if (!website || !origin) return null;
  try {
    const allowedHost = new URL(website).hostname.replace(/^www\./, "");
    const requestHost = new URL(origin).hostname.replace(/^www\./, "");
    if (allowedHost !== requestHost) return "This website is not registered for this business assistant.";
    return null;
  } catch {
    return "The business website setting is invalid.";
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cors = headersFor(path);
    const dashboard = isDashboardPath(path);

    if (request.method === "OPTIONS") {
      if (dashboard && request.headers.get("Origin") !== DASHBOARD_ORIGIN) {
        return json({ error: "Origin not allowed." }, 403, cors);
      }
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (path === "/health" && request.method === "GET") {
        return json({ ok: true, service: "VEXT AI Support API" }, 200, cors);
      }

      const needsUser = ((path === "/" || path === "/api/chat") && request.method === "POST")
        || path.startsWith("/api/admin/");
      let user = null;
      if (needsUser) {
        if (request.headers.get("Origin") !== DASHBOARD_ORIGIN) {
          return json({ error: "Dashboard origin not allowed." }, 403, cors);
        }
        user = await authenticateUser(request);
        if (!user) return json({ error: "Your VEXT AI session is missing or expired. Please sign in again." }, 401, cors);
      }

      if ((path === "/" || path === "/api/chat") && request.method === "POST") {
        const body = await readJson(request);
        const message = clean(body && body.message, 8000);
        if (!message) return json({ error: "Please provide a message." }, 400, cors);
        const reply = await callAI(
          env,
          "You are VEXT AI, a helpful business assistant. Give clear, practical and responsible guidance.",
          message
        );
        return json({ reply }, 200, cors);
      }

      if (path.startsWith("/api/admin/")) {
        if (!env.VEXT_DB) return json({ error: "D1 database binding VEXT_DB is not configured." }, 503, cors);

        if (path === "/api/admin/workspace" && request.method === "GET") {
          const row = await env.VEXT_DB.prepare(
            "SELECT data_json, updated_at FROM workspace_data WHERE owner_user_id = ?"
          ).bind(user.id).first();
          let workspace = {};
          if (row && typeof row.data_json === "string") {
            try { workspace = JSON.parse(row.data_json) || {}; } catch { workspace = {}; }
          }
          return json({ workspace, updatedAt: row ? row.updated_at : null }, 200, cors);
        }

        if (path === "/api/admin/workspace" && request.method === "PUT") {
          const contentLength = Number(request.headers.get("Content-Length") || 0);
          if (contentLength > 500000) return json({ error: "Workspace data is too large (500 KB maximum)." }, 413, cors);
          const body = await readJson(request);
          if (!body || !body.workspace || typeof body.workspace !== "object" || Array.isArray(body.workspace)) {
            return json({ error: "A workspace object is required." }, 400, cors);
          }
          const allowed = ["leads", "invoices", "logs", "currency", "business", "country", "support_settings", "support_business_id", "chat_history"];
          const workspace = {};
          for (const key of allowed) {
            if (!Object.prototype.hasOwnProperty.call(body.workspace, key)) continue;
            const value = body.workspace[key];
            if (["leads", "invoices", "logs", "chat_history"].includes(key)) {
              if (!Array.isArray(value)) return json({ error: key + " must be an array." }, 400, cors);
              const maxItems = key === "chat_history" ? 60 : 5000;
              if (value.length > maxItems) return json({ error: key + " contains too many items." }, 400, cors);
              workspace[key] = value;
            } else if (key === "support_settings") {
              if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "support_settings must be an object." }, 400, cors);
              workspace[key] = {
                business: clean(value.business, 100),
                website: clean(value.website, 300),
                greeting: clean(value.greeting, 500),
                instructions: clean(value.instructions, 5000)
              };
            } else {
              if (typeof value !== "string") return json({ error: key + " must be text." }, 400, cors);
              const limit = key === "business" ? 100 : key === "country" ? 100 : key === "currency" ? 5 : 80;
              workspace[key] = clean(value, limit);
            }
          }
          const serialized = JSON.stringify(workspace);
          if (serialized.length > 450000) return json({ error: "Workspace data is too large (450 KB maximum)." }, 413, cors);
          await env.VEXT_DB.prepare(
            "INSERT INTO workspace_data (owner_user_id, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(owner_user_id) DO UPDATE SET data_json=excluded.data_json, updated_at=CURRENT_TIMESTAMP"
          ).bind(user.id, serialized).run();
          return json({ ok: true, updatedAt: new Date().toISOString() }, 200, cors);
        }

        if (path === "/api/admin/business" && request.method === "POST") {
          const body = await readJson(request);
          const businessId = clean(body && body.businessId, 80);
          const name = clean(body && body.name, 100);
          const greeting = clean(body && body.greeting, 500);
          const instructions = clean(body && body.instructions, 5000);
          const website = clean(body && body.website, 300);
          if (!businessId || !name || !instructions) {
            return json({ error: "Business ID, business name and business information are required." }, 400, cors);
          }
          const saved = await env.VEXT_DB.prepare(
            "INSERT INTO businesses (business_id, owner_user_id, name, greeting, instructions, website, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(business_id) DO UPDATE SET name=excluded.name, greeting=excluded.greeting, instructions=excluded.instructions, website=excluded.website, updated_at=CURRENT_TIMESTAMP WHERE businesses.owner_user_id = excluded.owner_user_id"
          ).bind(businessId, user.id, name, greeting || "Hello! How can we help you today?", instructions, website).run();
          if (saved.meta && saved.meta.changes === 0) {
            return json({ error: "This business ID is already in use or belongs to an older unowned record. Refresh your VEXT AI dashboard to create a new account-owned business ID." }, 409, cors);
          }
          return json({ ok: true, businessId }, 200, cors);
        }

        if (path === "/api/admin/leads" && request.method === "PATCH") {
          const body = await readJson(request);
          const businessId = clean(body && body.businessId, 80);
          const leadId = clean(body && body.leadId, 80);
          const status = clean(body && body.status, 30);
          const nextAction = clean(body && body.nextAction, 500);
          const allowedStatuses = ["new", "qualified", "contacted", "proposal", "won", "lost"];
          if (!businessId || !leadId || !allowedStatuses.includes(status)) {
            return json({ error: "Business ID, lead ID and a valid sales status are required." }, 400, cors);
          }
          const ownedBusiness = await env.VEXT_DB.prepare(
            "SELECT business_id FROM businesses WHERE business_id = ? AND owner_user_id = ?"
          ).bind(businessId, user.id).first();
          if (!ownedBusiness) return json({ error: "This business assistant does not belong to your VEXT AI account." }, 404, cors);
          const updatedLead = await env.VEXT_DB.prepare(
            "UPDATE support_leads SET status = ?, next_action = ? WHERE id = ? AND business_id = ?"
          ).bind(status, nextAction, leadId, businessId).run();
          if (!updatedLead.meta || updatedLead.meta.changes === 0) return json({ error: "Lead not found." }, 404, cors);
          return json({ ok: true, leadId, status, nextAction }, 200, cors);
        }

        if (path === "/api/admin/leads" && request.method === "GET") {
          const businessId = clean(url.searchParams.get("businessId"), 80);
          if (!businessId) return json({ error: "Business ID is required." }, 400, cors);
          const ownedBusiness = await env.VEXT_DB.prepare(
            "SELECT business_id FROM businesses WHERE business_id = ? AND owner_user_id = ?"
          ).bind(businessId, user.id).first();
          if (!ownedBusiness) return json({ error: "This business assistant does not belong to your VEXT AI account." }, 404, cors);
          const result = await env.VEXT_DB.prepare(
            "SELECT id, customer_name, email, phone, message, status, intent, lead_score, next_action, created_at FROM support_leads WHERE business_id = ? ORDER BY created_at DESC LIMIT 200"
          ).bind(businessId).all();
          return json({ leads: result.results || [] }, 200, cors);
        }
        return json({ error: "Route not found." }, 404, cors);
      }

      if (!env.VEXT_DB) {
        return json({ error: "The support database is not configured yet. Add the VEXT_DB D1 binding." }, 503, cors);
      }

      if (path === "/api/public/business" && request.method === "GET") {
        const businessId = clean(url.searchParams.get("businessId"), 80);
        if (!businessId) return json({ error: "Business ID is required." }, 400, cors);
        const business = await env.VEXT_DB.prepare(
          "SELECT business_id, name, greeting FROM businesses WHERE business_id = ?"
        ).bind(businessId).first();
        if (!business) return json({ error: "Business was not found. Ask the business owner to finish setup." }, 404, cors);
        return json({ business }, 200, cors);
      }

      if (path === "/api/public/sales-chat" && request.method === "POST") {
        const body = await readJson(request);
        const businessId = clean(body && body.businessId, 80);
        const message = clean(body && body.message, 2000);
        if (!businessId || !message) return json({ error: "Business ID and message are required." }, 400, cors);
        const business = await env.VEXT_DB.prepare(
          "SELECT name, instructions, website FROM businesses WHERE business_id = ?"
        ).bind(businessId).first();
        if (!business) return json({ error: "This business sales assistant is not configured yet." }, 404, cors);
        const originError = checkWebsiteOrigin(request, business.website);
        if (originError) return json({ error: originError }, 403, cors);
        const system = "You are the VEXT AI Sales Agent for " + business.name + ". Your job is to help visitors understand the business and decide whether its products or services fit their needs. Be helpful, consultative, concise and never pushy. Use only the verified business information below. Never invent prices, stock, discounts, policies, availability, guarantees or delivery promises. Ask at most one useful question at a time. If information is missing, say a team member must confirm it. Do not claim a purchase or booking is complete. Do not request passwords, one-time codes or payment-card details. At the end of your response, append a compact machine-readable marker on a new line in exactly this format: [VEXT_SALES intent=low|medium|high score=0|1|2|3|4|5 next=ask_need|share_info|offer_contact|human_followup]. Choose intent and score based only on the visitor's expressed buying interest; use low/0 when unclear. Business information: " + business.instructions;
        const rawReply = await callAI(env, system, message);
        const marker = rawReply.match(/\n?\[VEXT_SALES intent=(low|medium|high) score=([0-5]) next=(ask_need|share_info|offer_contact|human_followup)\]\s*$/);
        const reply = marker ? rawReply.slice(0, marker.index).trim() : rawReply;
        const intent = marker ? marker[1] : "unknown";
        const score = marker ? Number(marker[2]) : 0;
        const nextAction = marker ? marker[3] : "human_followup";
        return json({ reply, intent, score, nextAction }, 200, cors);
      }

      if (path === "/api/public/chat" && request.method === "POST") {
        const body = await readJson(request);
        const businessId = clean(body && body.businessId, 80);
        const message = clean(body && body.message, 2000);
        if (!businessId || !message) return json({ error: "Business ID and message are required." }, 400, cors);
        const business = await env.VEXT_DB.prepare(
          "SELECT name, instructions, website FROM businesses WHERE business_id = ?"
        ).bind(businessId).first();
        if (!business) return json({ error: "This business support assistant is not configured yet." }, 404, cors);
        const originError = checkWebsiteOrigin(request, business.website);
        if (originError) return json({ error: originError }, 403, cors);
        const system = "You are the customer support assistant for " + business.name + ". Use only the business information below. Be polite, concise and accurate. Never invent prices, stock, policies, opening hours or delivery promises. If information is missing, say a team member must confirm it. Never request passwords, one-time codes or full payment-card details. Business information: " + business.instructions;
        const reply = await callAI(env, system, message);
        return json({ reply }, 200, cors);
      }

      if (path === "/api/public/leads" && request.method === "POST") {
        const body = await readJson(request);
        if (clean(body && body.website, 200)) return json({ ok: true }, 200, cors);
        const businessId = clean(body && body.businessId, 80);
        const name = clean(body && body.name, 100);
        const email = clean(body && body.email, 150);
        const phone = clean(body && body.phone, 40);
        const message = clean(body && body.message, 1200);
        const consent = body && body.consent === true;
        const intent = ["low", "medium", "high"].includes(body && body.salesIntent) ? body.salesIntent : "unknown";
        const leadScore = Number.isInteger(body && body.leadScore) && body.leadScore >= 0 && body.leadScore <= 5 ? body.leadScore : 0;
        const nextAction = clean(body && body.nextAction, 40);
        if (!businessId || !name || (!email && !phone) || !consent) {
          return json({ error: "Name, email or phone, and permission to be contacted are required." }, 400, cors);
        }
        const business = await env.VEXT_DB.prepare(
          "SELECT website FROM businesses WHERE business_id = ?"
        ).bind(businessId).first();
        if (!business) return json({ error: "Business not found." }, 404, cors);
        const originError = checkWebsiteOrigin(request, business.website);
        if (originError) return json({ error: originError }, 403, cors);
        const id = crypto.randomUUID();
        await env.VEXT_DB.prepare(
          "INSERT INTO support_leads (id, business_id, customer_name, email, phone, message, consent, status, intent, lead_score, next_action, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, 'new', ?, ?, ?, CURRENT_TIMESTAMP)"
        ).bind(id, businessId, name, email, phone, message, intent, leadScore, nextAction).run();
        return json({ ok: true, id }, 201, cors);
      }

      return json({ error: "Route not found." }, 404, cors);
    } catch (error) {
      return json({ error: error && error.message ? error.message : "Unexpected server error." }, 500, cors);
    }
  }
};
