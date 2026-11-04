const DASHBOARD_ORIGIN = "https://rkabiitex-ctrl.github.io";
const DEFAULT_MODEL = "gpt-6-astra";

function headersFor(request, path) {
  const origin = request.headers.get("Origin") || "*";
  const admin = path.startsWith("/api/admin/");
  return {
    "Access-Control-Allow-Origin": admin ? DASHBOARD_ORIGIN : "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const cors = headersFor(request, path);

    if (request.method === "OPTIONS") {
      if (path.startsWith("/api/admin/") && request.headers.get("Origin") !== DASHBOARD_ORIGIN) {
        return json({ error: "Origin not allowed." }, 403, cors);
      }
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (path === "/health" && request.method === "GET") {
        return json({ ok: true, service: "VEXT AI Support API" }, 200, cors);
      }

      // Backward-compatible endpoint used by the existing VEXT AI Chat page.
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

      if (path.startsWith("/api/admin/") && request.headers.get("Origin") !== DASHBOARD_ORIGIN) {
        return json({ error: "Admin access is only allowed from the VEXT AI dashboard." }, 403, cors);
      }

      if (path.startsWith("/api/admin/")) {
        if (!env.VEXT_ADMIN_TOKEN || getToken(request) !== env.VEXT_ADMIN_TOKEN) {
          return json({ error: "Admin token is missing or incorrect." }, 401, cors);
        }
        if (!env.VEXT_DB) return json({ error: "D1 database binding VEXT_DB is not configured." }, 503, cors);

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
          await env.VEXT_DB.prepare(
            "INSERT INTO businesses (business_id, name, greeting, instructions, website, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(business_id) DO UPDATE SET name=excluded.name, greeting=excluded.greeting, instructions=excluded.instructions, website=excluded.website, updated_at=CURRENT_TIMESTAMP"
          ).bind(businessId, name, greeting || "Hello! How can we help you today?", instructions, website).run();
          return json({ ok: true, businessId }, 200, cors);
        }

        if (path === "/api/admin/leads" && request.method === "GET") {
          const businessId = clean(url.searchParams.get("businessId"), 80);
          if (!businessId) return json({ error: "Business ID is required." }, 400, cors);
          const result = await env.VEXT_DB.prepare(
            "SELECT id, customer_name, email, phone, message, created_at FROM support_leads WHERE business_id = ? ORDER BY created_at DESC LIMIT 200"
          ).bind(businessId).all();
          return json({ leads: result.results || [] }, 200, cors);
        }
      }

      if (!env.VEXT_DB) {
        return json({ error: "The support database is not configured yet. Add the VEXT_DB D1 binding." }, 503, cors);
      }

      if (path === "/api/public/business" && request.method === "GET") {
        const businessId = clean(url.searchParams.get("businessId"), 80);
        if (!businessId) return json({ error: "Business ID is required." }, 400, cors);
        const business = await env.VEXT_DB.prepare(
          "SELECT business_id, name, greeting, instructions FROM businesses WHERE business_id = ?"
        ).bind(businessId).first();
        if (!business) return json({ error: "Business was not found. Ask the business owner to finish setup." }, 404, cors);
        return json({ business }, 200, cors);
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
        const origin = request.headers.get("Origin");
        if (business.website && origin) {
          try {
            const allowedHost = new URL(business.website).hostname.replace(/^www\\./, "");
            const requestHost = new URL(origin).hostname.replace(/^www\\./, "");
            if (allowedHost !== requestHost) return json({ error: "This website is not registered for this business assistant." }, 403, cors);
          } catch { return json({ error: "The business website setting is invalid." }, 400, cors); }
        }
        const system = "You are the customer support assistant for " + business.name + ". Use only the business information below. Be polite, concise and accurate. Never invent prices, stock, policies, opening hours or delivery promises. If information is missing, say a team member must confirm it. Never request passwords, one-time codes or full payment-card details. Business information: " + business.instructions;
        const reply = await callAI(env, system, message);
        return json({ reply }, 200, cors);
      }

      if (path === "/api/public/leads" && request.method === "POST") {
        const body = await readJson(request);
        if (clean(body && body.website, 200)) return json({ ok: true }, 200, cors); // honeypot
        const businessId = clean(body && body.businessId, 80);
        const name = clean(body && body.name, 100);
        const email = clean(body && body.email, 150);
        const phone = clean(body && body.phone, 40);
        const message = clean(body && body.message, 1200);
        const consent = body && body.consent === true;
        if (!businessId || !name || (!email && !phone) || !consent) {
          return json({ error: "Name, email or phone, and permission to be contacted are required." }, 400, cors);
        }
        const business = await env.VEXT_DB.prepare(
          "SELECT website FROM businesses WHERE business_id = ?"
        ).bind(businessId).first();
        if (!business) return json({ error: "Business not found." }, 404, cors);
        // When the owner configures a website, only accept widget enquiries from that domain.
        const origin = request.headers.get("Origin");
        if (business.website && origin) {
          try {
            const allowedHost = new URL(business.website).hostname.replace(/^www\./, "");
            const requestHost = new URL(origin).hostname.replace(/^www\./, "");
            if (allowedHost !== requestHost) return json({ error: "This website is not registered for this business assistant." }, 403, cors);
          } catch { return json({ error: "The business website setting is invalid." }, 400, cors); }
        }
        const id = crypto.randomUUID();
        await env.VEXT_DB.prepare(
          "INSERT INTO support_leads (id, business_id, customer_name, email, phone, message, consent, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)"
        ).bind(id, businessId, name, email, phone, message).run();
        return json({ ok: true, id }, 201, cors);
      }

      return json({ error: "Route not found." }, 404, cors);
    } catch (error) {
      return json({ error: error && error.message ? error.message : "Unexpected server error." }, 500, cors);
    }
  }
};
