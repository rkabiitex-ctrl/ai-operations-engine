(function () {
  "use strict";
  const script = document.currentScript;
  if (!script) return;
  const api = (script.dataset.apiBase || "https://flat-star-50c3.rkabiitex.workers.dev").replace(/\/$/, "");
  const businessId = script.dataset.businessId || "";
  if (!businessId) { console.error("VEXT AI Support: missing data-business-id."); return; }

  const style = document.createElement("style");
  style.textContent = `
    .vext-widget-launch{position:fixed;right:22px;bottom:22px;z-index:2147483000;border:0;border-radius:999px;padding:14px 18px;background:linear-gradient(110deg,#38bdf8,#22d3ee);color:#071323;font:700 14px Arial;box-shadow:0 8px 28px #0008;cursor:pointer}
    .vext-widget-panel{position:fixed;right:22px;bottom:82px;width:min(365px,calc(100vw - 28px));height:min(570px,calc(100vh - 120px));z-index:2147483000;background:#0c1729;color:#f1f5f9;border:1px solid #2b405c;border-radius:16px;box-shadow:0 18px 60px #0009;display:none;overflow:hidden;font:14px Arial,sans-serif}
    .vext-widget-panel.open{display:flex;flex-direction:column}
    .vext-widget-head{padding:15px;background:#13243b;border-bottom:1px solid #2b405c;display:flex;justify-content:space-between;align-items:center;gap:10px}
    .vext-widget-title{font-weight:700}.vext-widget-sub{font-size:11px;color:#9db1c8;margin-top:4px}
    .vext-widget-close{background:transparent;color:#fff;border:0;font-size:22px;cursor:pointer}
    .vext-widget-messages{padding:12px;overflow:auto;flex:1}
    .vext-widget-msg{max-width:88%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;padding:10px 12px;margin:9px 0;border-radius:12px;background:#172b46}
    .vext-widget-msg.user{margin-left:auto;background:#12405b}
    .vext-widget-form{padding:10px;border-top:1px solid #2b405c;display:flex;gap:7px}
    .vext-widget-form textarea{flex:1;resize:none;min-width:0;height:43px;padding:10px;border-radius:8px;border:1px solid #38506b;background:#091426;color:#fff;font:13px Arial}
    .vext-widget-form button,.vext-widget-lead button{border:0;border-radius:8px;padding:10px 12px;background:#38bdf8;color:#071323;font-weight:700;cursor:pointer}
    .vext-widget-actions{padding:0 12px 10px;display:flex;gap:8px;flex-wrap:wrap}
    .vext-widget-link{border:1px solid #38506b;border-radius:7px;padding:7px 9px;background:#17243a;color:#d8f4ff;font-size:11px;cursor:pointer}
    .vext-widget-lead{display:none;padding:12px;border-top:1px solid #2b405c;overflow:auto}
    .vext-widget-lead.open{display:block}
    .vext-widget-lead input,.vext-widget-lead textarea{display:block;width:100%;box-sizing:border-box;margin:7px 0;padding:10px;background:#091426;border:1px solid #38506b;border-radius:7px;color:#fff;font:13px Arial}
    .vext-widget-lead label{font-size:11px;color:#cbd5e1;display:block;margin:8px 0}
    .vext-widget-status{font-size:11px;color:#9db1c8;padding:0 12px 8px;min-height:14px}
    @media(max-width:480px){.vext-widget-launch{right:14px;bottom:14px}.vext-widget-panel{right:8px;bottom:72px;width:calc(100vw - 16px);height:calc(100vh - 92px)}}
  `;
  document.head.appendChild(style);

  const launch = document.createElement("button");
  launch.className = "vext-widget-launch";
  launch.type = "button";
  launch.textContent = "Talk to our Sales Agent";
  launch.setAttribute("aria-label", "Open VEXT AI Sales Agent");

  const panel = document.createElement("section");
  panel.className = "vext-widget-panel";
  panel.innerHTML = '<div class="vext-widget-head"><div><div class="vext-widget-title">VEXT AI Sales Agent</div><div class="vext-widget-sub">Product guidance · sales assistance</div></div><button class="vext-widget-close" type="button" aria-label="Close">×</button></div><div class="vext-widget-messages" aria-live="polite"></div><div class="vext-widget-actions"><button class="vext-widget-link" type="button">Talk to our sales team</button></div><div class="vext-widget-status"></div><form class="vext-widget-form"><textarea maxlength="2000" aria-label="Your message" placeholder="Type your question..."></textarea><button type="submit">Send</button></form><form class="vext-widget-lead"><strong>Request a callback</strong><input name="name" maxlength="100" required placeholder="Your name"><input name="email" maxlength="150" type="email" placeholder="Email address"><input name="phone" maxlength="40" placeholder="Phone number"><textarea name="message" maxlength="1200" placeholder="What would you like us to help with?"></textarea><input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><label><input name="consent" type="checkbox" required> I agree to be contacted about this enquiry.</label><button type="submit">Send enquiry</button><button class="vext-widget-link vext-widget-cancel" type="button">Back to chat</button></form>';
  document.body.append(launch, panel);

  const messages = panel.querySelector(".vext-widget-messages");
  const status = panel.querySelector(".vext-widget-status");
  const chatForm = panel.querySelector(".vext-widget-form");
  const leadForm = panel.querySelector(".vext-widget-lead");
  const input = chatForm.querySelector("textarea");
  let config = { name: "Sales Assistant", greeting: "Hello! What are you looking for today?" };
  const conversation = [];
  let lastSalesAssessment = { intent: "unknown", score: 0, nextAction: "human_followup" };

  function bubble(text, who) {
    const el = document.createElement("div");
    el.className = "vext-widget-msg" + (who === "user" ? " user" : "");
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }
  function showPanel(open) {
    panel.classList.toggle("open", open);
    if (open) input.focus();
  }
  launch.addEventListener("click", () => showPanel(!panel.classList.contains("open")));
  panel.querySelector(".vext-widget-close").addEventListener("click", () => showPanel(false));
  panel.querySelector(".vext-widget-link").addEventListener("click", () => {
    chatForm.style.display = "none"; leadForm.classList.add("open");
  });
  panel.querySelector(".vext-widget-cancel").addEventListener("click", () => {
    leadForm.classList.remove("open"); chatForm.style.display = "flex";
  });

  async function loadConfig() {
    try {
      const r = await fetch(api + "/api/public/business?businessId=" + encodeURIComponent(businessId));
      const data = await r.json();
      if (!r.ok || !data.business) throw new Error(data.error || "Assistant is not configured.");
      config = data.business;
      panel.querySelector(".vext-widget-title").textContent = config.name || "Customer Support";
      bubble(config.greeting || "Hello! What are you looking for today?");
      conversation.push({ role: "assistant", content: config.greeting || "Hello! What are you looking for today?" });
    } catch (e) {
      bubble("This support assistant is not available yet. Please contact the business directly.");
      status.textContent = e.message || "Setup incomplete.";
      chatForm.querySelector("button").disabled = true;
    }
  }

  chatForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    bubble(message, "user");
    conversation.push({ role: "user", content: message });
    input.value = "";
    const button = chatForm.querySelector("button");
    button.disabled = true; status.textContent = "Thinking...";
    try {
      const conversationText = conversation.slice(-10).map(item => (item.role === "user" ? "Visitor: " : "Sales Agent: ") + item.content).join("\n");
      const r = await fetch(api + "/api/public/sales-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, message: conversationText })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "The assistant could not reply.");
      bubble(data.reply, "assistant");
      conversation.push({ role: "assistant", content: data.reply });
      lastSalesAssessment = { intent: data.intent || "unknown", score: Number.isInteger(data.score) ? Math.max(0, Math.min(5, data.score)) : 0, nextAction: data.nextAction || "human_followup" };
      status.textContent = data.intent === "high" ? "Ready to help you take the next step." : "";
    } catch (e) { bubble("Sorry, I couldn't connect just now. Please try again or request a callback."); status.textContent = e.message || "Connection problem."; }
    finally { button.disabled = false; input.focus(); }
  });

  leadForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(leadForm).entries());
    if (!values.email.trim() && !values.phone.trim()) { status.textContent = "Please add an email address or phone number."; return; }
    const button = leadForm.querySelector('button[type="submit"]');
    button.disabled = true; status.textContent = "Sending your enquiry...";
    try {
      const r = await fetch(api + "/api/public/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, name: values.name, email: values.email, phone: values.phone, message: values.message, consent: leadForm.querySelector('[name="consent"]').checked, website: values.website, salesIntent: lastSalesAssessment.intent, leadScore: lastSalesAssessment.score, nextAction: lastSalesAssessment.nextAction })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "We could not save your enquiry.");
      leadForm.reset(); leadForm.classList.remove("open"); chatForm.style.display = "flex";
      status.textContent = "Thank you. Your enquiry has been sent to the business.";
    } catch (e) { status.textContent = e.message || "Connection problem."; }
    finally { button.disabled = false; }
  });

  loadConfig();
})();