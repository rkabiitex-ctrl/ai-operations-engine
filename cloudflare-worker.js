const DASHBOARD_ORIGIN = "https://rkabiitex-ctrl.github.io";
const SUPABASE_URL = "https://nakydtwssxlbtpocxmwh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jOxJl50SORuiYbTZ2Gq7yw_KiySZ56e";
const DEFAULT_MODEL = "gpt-6-astra";

function isDashboardPath(path) {
  return path === "/" || path === "/api/chat" || path === "/api/billing/checkout" || path === "/api/billing/status" || path.startsWith("/api/admin/");
}

function headersFor(path) {
  const dashboard = isDashboardPath(path);
  return {
    "Access-Control-Allow-Origin": dashboard ? DASHBOARD_ORIGIN : "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
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

async function callAI(env, instructions, input, maxOutputTokens = 700) {
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
      input,
      max_output_tokens: maxOutputTokens
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


const PADDLE_PRICE_MAP = {
 "pri_01m81ctxbshk75rmh3etwkb5yd": {plan:"Starter",period:"monthly"},
 "pri_01m81d5thh8va7r1w2k8dh9npm": {plan:"Starter",period:"yearly"},
 "pri_01m81dhxp5adphpthn3dtqrcpc": {plan:"Professional",period:"monthly"},
 "pri_01m81dpr7xav513e0z80796p48": {plan:"Professional",period:"yearly"}
};
async function verifyPaddleSignature(raw, header, secret) {
 if (!header || !secret) return false;
 const parts = {};
 for (const part of header.split(";")) { const at=part.indexOf("="); if(at>0) parts[part.slice(0,at).trim()]=part.slice(at+1).trim(); }
 if (!parts.ts || !parts.h1 || !/^\d+$/.test(parts.ts)) return false;
 if (Math.abs(Date.now()/1000-Number(parts.ts))>300) return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(parts.ts+":"+raw)));
 const expected=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 if(expected.length!==parts.h1.length)return false;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^parts.h1.charCodeAt(i);
 return diff===0;
}
async function handlePaddleWebhook(request,env) {
 if(!env.VEXT_DB||!env.PADDLE_WEBHOOK_SECRET)return json({error:"Billing webhook is not configured."},503);
 const raw=await request.text();if(raw.length>200000)return json({error:"Webhook payload too large."},413);
 if(!await verifyPaddleSignature(raw,request.headers.get("Paddle-Signature"),env.PADDLE_WEBHOOK_SECRET))return json({error:"Invalid webhook signature."},401);
 let event;try{event=JSON.parse(raw)}catch{return json({error:"Invalid webhook JSON."},400)}
 const eventId=clean(event&&event.event_id,80),type=clean(event&&event.event_type,80),data=event&&event.data;
 if(!eventId||!type||!data)return json({error:"Incomplete webhook event."},400);
 const types=["subscription.created","subscription.updated","subscription.activated","subscription.trialing","subscription.past_due","subscription.paused","subscription.resumed","subscription.canceled"];
 if(!types.includes(type))return json({ok:true,ignored:true},200);
 const userId=clean(data.custom_data&&data.custom_data.vext_user_id,80),subId=clean(data.id,80);
 if(!userId||!subId.startsWith("sub_"))return json({error:"Missing VEXT account reference."},400);
 const first=Array.isArray(data.items)?data.items[0]:null,priceId=clean(first&&first.price&&first.price.id,80),plan=PADDLE_PRICE_MAP[priceId];
 if(!plan)return json({error:"Unrecognised VEXT price."},400);
 const now=new Date().toISOString();
 try{
  const inserted=await env.VEXT_DB.prepare("INSERT OR IGNORE INTO billing_webhook_events (event_id,event_type,received_at) VALUES (?,?,?)").bind(eventId,type,now).run();
  if(inserted.meta&&inserted.meta.changes===0)return json({ok:true,duplicate:true},200);
  const status=["active","trialing","past_due","paused","canceled"].includes(data.status)?data.status:"inactive";
  await env.VEXT_DB.prepare("INSERT INTO billing_subscriptions (owner_user_id,paddle_customer_id,paddle_subscription_id,plan,billing_period,price_id,status,next_billed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_user_id) DO UPDATE SET paddle_customer_id=excluded.paddle_customer_id,paddle_subscription_id=excluded.paddle_subscription_id,plan=excluded.plan,billing_period=excluded.billing_period,price_id=excluded.price_id,status=excluded.status,next_billed_at=excluded.next_billed_at,updated_at=excluded.updated_at").bind(userId,clean(data.customer_id,80),subId,plan.plan,plan.period,priceId,status,clean(data.next_billed_at,40),now).run();
  return json({ok:true},200);
 }catch(error){await env.VEXT_DB.prepare("DELETE FROM billing_webhook_events WHERE event_id=?").bind(eventId).run().catch(()=>{});throw error}
}
\nfunction checkWebsiteOrigin(request, website) {
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


      if (path === "/api/billing/webhook" && request.method === "POST") return await handlePaddleWebhook(request,env);
      if (path === "/api/billing/checkout" && request.method === "POST") {
        if(request.headers.get("Origin")!==DASHBOARD_ORIGIN)return json({error:"Dashboard origin not allowed."},403,cors);
        const billingUser=await authenticateUser(request);
        if(!billingUser)return json({error:"Your VEXT AI session is missing or expired. Please sign in again."},401,cors);
        if(!env.PADDLE_API_KEY)return json({error:"Paddle Sandbox API key is not configured."},503,cors);
        const body=await readJson(request),priceId=clean(body&&body.priceId,80),selected=PADDLE_PRICE_MAP[priceId];
        if(!selected)return json({error:"Choose a valid VEXT AI plan and billing period."},400,cors);
        const response=await fetch("https://sandbox-api.paddle.com/transactions",{method:"POST",headers:{"Authorization":"Bearer "+env.PADDLE_API_KEY,"Content-Type":"application/json","Paddle-Version":"1"},body:JSON.stringify({items:[{price_id:priceId,quantity:1}],collection_mode:"automatic",custom_data:{vext_user_id:billingUser.id,plan:selected.plan,billing_period:selected.period}})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.data||!result.data.id)return json({error:"Paddle could not create checkout. "+clean(result.error&&result.error.detail,300)},502,cors);
        return json({transactionId:result.data.id,plan:selected.plan,billingPeriod:selected.period},200,cors);
      }
      if (path === "/api/billing/status" && request.method === "GET") {
        if(request.headers.get("Origin")!==DASHBOARD_ORIGIN)return json({error:"Dashboard origin not allowed."},403,cors);
        const billingUser=await authenticateUser(request);
        if(!billingUser)return json({error:"Your VEXT AI session is missing or expired. Please sign in again."},401,cors);
        if(!env.VEXT_DB)return json({error:"Billing database is not configured."},503,cors);
        const row=await env.VEXT_DB.prepare("SELECT plan,billing_period,status,next_billed_at,updated_at FROM billing_subscriptions WHERE owner_user_id=?").bind(billingUser.id).first();
        return json({subscription:row?{plan:row.plan,billingPeriod:row.billing_period,status:row.status,nextBilledAt:row.next_billed_at,updatedAt:row.updated_at}:{plan:"none",billingPeriod:"monthly",status:"inactive",nextBilledAt:null}},200,cors);
      }
\n      const needsUser = ((path === "/" || path === "/api/chat") && request.method === "POST")
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
        const suppliedHistory = Array.isArray(body && body.history) ? body.history : [];
        const conversation = suppliedHistory.slice(-12).map(item => ({
          role: item && item.role === "assistant" ? "assistant" : "user",
          content: clean(item && item.content, 3000)
        })).filter(item => item.content);
        if (!conversation.length || conversation[conversation.length - 1].role !== "user" ||
            conversation[conversation.length - 1].content !== message) {
          conversation.push({ role: "user", content: message });
        }
        const requestedOutputTokens = Number(body && body.maxOutputTokens);
        const maxOutputTokens = Number.isFinite(requestedOutputTokens)
          ? Math.min(2400, Math.max(700, Math.floor(requestedOutputTokens)))
          : 700;
        const reply = await callAI(
          env,
          "You are VEXT AI, a helpful business assistant. Use the recent conversation messages to understand follow-up questions and references. Stay within the current conversation; do not invent missing details. Give clear, practical and responsible guidance.",
          conversation,
          maxOutputTokens
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
          const allowed = ["leads", "invoices", "logs", "currency", "business", "country", "support_settings", "support_business_id", "chat_history", "chat_conversations", "active_chat_id", "audit_reports", "business_analysis_reports", "management_actions", "nexus_tasks", "notifications", "automation_settings", "automation_runs", "marketing_drafts", "life_tasks", "life_goals", "life_study", "life_career", "life_finance", "life_habits", "life_chat", "life_reflection", "life_budget", "billing_subscription", "billing_events"];
          const workspace = {};
          for (const key of allowed) {
            if (!Object.prototype.hasOwnProperty.call(body.workspace, key)) continue;
            const value = body.workspace[key];
            if (key === "marketing_drafts") {
               if (!Array.isArray(value) || value.length > 30) return json({ error: "marketing_drafts must be an array of up to 30 drafts." }, 400, cors);
               workspace[key] = value.map(draft => ({ title: clean(draft && draft.title, 100), content: clean(draft && draft.content, 30000), createdAt: clean(draft && draft.createdAt, 40) })).filter(draft => draft.content);
             } else if (["life_tasks", "life_goals", "life_study", "life_career", "life_finance", "life_habits", "life_chat"].includes(key)) {
              if (!Array.isArray(value)) return json({ error: key + " must be an array." }, 400, cors);
              const limits = { life_tasks: 300, life_goals: 100, life_study: 100, life_career: 100, life_finance: 500, life_habits: 100, life_chat: 60 };
              if (value.length > limits[key]) return json({ error: key + " contains too many items." }, 400, cors);
              if (key === "life_chat") {
                workspace[key] = value.map(item => ({ role: item && item.role === "assistant" ? "assistant" : "user", content: clean(item && item.content, 5000) })).filter(item => item.content);
              } else {
                workspace[key] = value;
              }
            } else if (key === "life_reflection") {
              if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "life_reflection must be an object." }, 400, cors);
              workspace[key] = Object.fromEntries(Object.entries(value).slice(-60).map(([day, note]) => [clean(day, 10), clean(note, 1000)]).filter(([day, note]) => day && note));
            } else if (key === "billing_subscription") {
              if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "billing_subscription must be an object." }, 400, cors);
              const status = value.status === "request_pending" ? "request_pending" : "inactive";
              const plan = ["none", "Starter", "Professional", "Enterprise"].includes(value.plan) ? value.plan : "none";
              const period = ["monthly", "yearly"].includes(value.billingPeriod) ? value.billingPeriod : "monthly";
              workspace[key] = { plan, status, billingPeriod: period, requestedAt: clean(value.requestedAt, 40), provider: "not_connected", updatedAt: clean(value.updatedAt, 40) };
            } else if (key === "billing_events") {
              if (!Array.isArray(value) || value.length > 100) return json({ error: "billing_events must be an array of up to 100 records." }, 400, cors);
              workspace[key] = value.map(event => ({
                id: clean(event && event.id, 100),
                type: ["trial_request", "plan_request", "enterprise_contact"].includes(event && event.type) ? event.type : "plan_request",
                plan: ["Starter", "Professional", "Enterprise"].includes(event && event.plan) ? event.plan : "Starter",
                billingPeriod: ["monthly", "yearly"].includes(event && event.billingPeriod) ? event.billingPeriod : "monthly",
                status: "request_pending",
                requestedAt: clean(event && event.requestedAt, 40)
              })).filter(event => event.id && event.requestedAt);
            } else if (key === "life_budget") {
              if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "life_budget must be an object." }, 400, cors);
              const amount = Number(value.amount);
              workspace[key] = { amount: Number.isFinite(amount) && amount > 0 ? amount : 0, currency: clean(value.currency, 5), month: clean(value.month, 7) };
            } else if (["leads", "invoices", "logs", "chat_history", "chat_conversations", "audit_reports", "business_analysis_reports", "management_actions", "nexus_tasks", "notifications"].includes(key)) {
              if (!Array.isArray(value)) return json({ error: key + " must be an array." }, 400, cors);
              const maxItems = key === "nexus_tasks" ? 100 : key === "management_actions" ? 1000 : (key === "chat_history" || key === "audit_reports" || key === "business_analysis_reports") ? 50 : key === "notifications" ? 150 : 5000;
              if (value.length > maxItems) return json({ error: key + " contains too many items." }, 400, cors);
              workspace[key] = value;
            } else if (key === "automation_runs") {
              if (!Array.isArray(value)) return json({ error: "automation_runs must be an array." }, 400, cors);
              if (value.length > 100) return json({ error: "automation_runs contains too many items." }, 400, cors);
              workspace[key] = value;
            } else if (key === "automation_settings") {
              if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "automation_settings must be an object." }, 400, cors);
              workspace[key] = {
                newLeadFollowup: value.newLeadFollowup === true,
                workflowEnabled: value.workflowEnabled === true || value.newLeadFollowup === true,
                condition: ["any", "has_interest", "high_value"].includes(value.condition) ? value.condition : "any",
                steps: Array.isArray(value.steps) ? value.steps.filter(step => ["create_task", "log_activity"].includes(step)).slice(0, 2) : (value.newLeadFollowup ? ["create_task"] : []),
                requireApproval: value.requireApproval !== false,
                maxRetries: Number.isInteger(value.maxRetries) ? Math.min(2, Math.max(0, value.maxRetries)) : 2,
                updatedAt: clean(value.updatedAt, 40)
              };
            } else if (key === "active_chat_id") {
              workspace[key] = clean(value, 100);
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
        const system = "You are the VEXT AI Sales Agent for " + business.name + ". Read the full conversation transcript in the visitor message as persistent conversation history. Remember all details already supplied, including product, budget, preferences, purchase timing, name, email, phone and consent. Never ask again for information already provided. Ask at most one useful missing question at a time. If the visitor has already supplied an email or phone and explicitly agreed to be contacted, acknowledge that and do not ask for contact details or consent again; continue helping with the product request. Be helpful, consultative, concise and never pushy. Use only the verified business information below. Never invent prices, stock, discounts, policies, availability, guarantees or delivery promises. If information is missing, say a team member must confirm it. Do not claim a purchase or booking is complete. Do not request passwords, one-time codes or payment-card details. At the end of your response, append a compact machine-readable marker on a new line in exactly this format: [VEXT_SALES intent=low|medium|high score=0|1|2|3|4|5 next=ask_need|share_info|offer_contact|human_followup]. Assess intent and score from the entire conversation, not only its latest message. A clear product, budget and near-term purchase plan should normally be high intent; never reduce a previously clear buying signal just because the latest message contains contact details. Business information: " + business.instructions;
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
