(()=>{"use strict";
const PLANS=[
 {name:"Starter",monthly:29,yearly:290,features:["Business dashboard","AI workspace","Client and invoice management","Business activity overview","Core NEXUS tools"]},
 {name:"Professional",monthly:79,yearly:790,features:["Everything in Starter","AI customer support tools","Cloud enquiry collection","Sales Intelligence and Smart CRM","Marketing Studio and Automation Network","Business analytics"]},
 {name:"Enterprise",monthly:null,yearly:null,features:["Everything in Professional","Custom onboarding","Team and access controls","Custom usage and support options"]}
];
const PADDLE_TOKEN="test_52856a19bb79296d438dd0393c0";
const WORKER_ENDPOINT="https://flat-star-50c3.rkabiitex.workers.dev/";
const PRICE_IDS={Starter:{monthly:"pri_01m81ctxbshk75rmh3etwkb5yd",yearly:"pri_01m81d5thh8va7r1w2k8dh9npm"},Professional:{monthly:"pri_01m81dhxp5adphpthn3dtqrcpc",yearly:"pri_01m81dpr7xav513e0z80796p48"}};
function init({$,read,write,writeAndSync,getAccessToken}){
 let billingPeriod="monthly",paddleReady=false,serverSubscription=null,statusLoading=false,lastStatusCheck=0;
 const safeEvents=()=>{const events=read("billing_events",[]);return Array.isArray(events)?events:[]};
 const localProfile=()=>{const value=read("billing_subscription",{});return value&&typeof value==="object"&&!Array.isArray(value)?value:{plan:"none",status:"inactive",billingPeriod:"monthly",provider:"not_connected"}};
 const money=value=>value===null?"Custom":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function render(){
  const current=serverSubscription||localProfile(),events=safeEvents(),plan=PLANS.find(p=>p.name===current.plan),status=current.status||"inactive";
  const labels={inactive:"Not subscribed",request_pending:"Request submitted · awaiting setup",active:"Active subscription",trialing:"Trial active",past_due:"Payment past due",paused:"Subscription paused",canceled:"Subscription canceled"};
  $("billingCurrentPlan").textContent=plan?plan.name:"No active plan";
  $("billingCurrentState").textContent=labels[status]||"Status unavailable";
  $("billingNextDate").textContent=current.nextBilledAt?new Date(current.nextBilledAt).toLocaleDateString():"—";
  $("billingProviderState").textContent=serverSubscription?"Paddle · Sandbox":"Paddle Sandbox · awaiting confirmation";
  $("billingStatus").textContent=status.replaceAll("_"," ").toUpperCase();
  $("billingAccountNote").textContent=serverSubscription
   ?((status==="active"||status==="trialing")?"Paddle has confirmed this subscription. Feature access remains in preview until server-side entitlements are completed.":"Paddle reports: "+(labels[status]||status)+".")
   :"Checkout is available in Sandbox. Subscription status updates only after Paddle sends a verified webhook; no paid access is activated by the checkout screen.";
  document.querySelectorAll("[data-billing]").forEach(button=>{const active=button.dataset.billing===billingPeriod;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  document.querySelectorAll(".plan-price").forEach(el=>{const p=PLANS.find(item=>item.name===el.closest(".plan-card").querySelector(".plan-name").textContent.trim());el.textContent=p?money(p[billingPeriod]):"—";});
  document.querySelectorAll("[data-saving]").forEach(el=>el.textContent=billingPeriod==="yearly"?el.dataset.saving:"");
  document.querySelectorAll(".plan-period").forEach((el,index)=>{el.textContent=index===2?"custom quotation":billingPeriod==="yearly"?"per year":"per month";});
  const history=$("billingHistory");history.replaceChildren();
  if(!events.length){const empty=document.createElement("p");empty.className="muted small";empty.textContent="No billing requests or invoices have been recorded.";history.append(empty);}
  events.slice().sort((a,b)=>new Date(b.requestedAt||0)-new Date(a.requestedAt||0)).forEach(event=>{
   const row=document.createElement("div");row.className="billing-history-row";const detail=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small"),state=document.createElement("span");
   title.textContent=event.type==="trial_request"?"One-day Starter trial request":event.type==="enterprise_contact"?"Enterprise sales request":event.plan+" plan request";
   meta.textContent=new Date(event.requestedAt).toLocaleString()+" · "+(event.billingPeriod||"monthly");state.textContent="PENDING";detail.append(title,meta);row.append(detail,state);history.append(row);
  });
  const entitlements=$("billingEntitlements");entitlements.replaceChildren();(plan||PLANS[0]).features.forEach(feature=>{const row=document.createElement("div");row.className="billing-entitlement-row";const label=document.createElement("span"),value=document.createElement("small");label.textContent=feature;value.textContent="Preview only";row.append(label,value);entitlements.append(row);});
  const note=document.createElement("p");note.className="billing-note";note.textContent="Feature access is not enabled by a browser checkout result. Verified subscription events and server-side entitlement controls are required.";entitlements.append(note);
  if(!serverSubscription)void refreshStatus();
 }
 async function refreshStatus(force=false){
  if(statusLoading||(!force&&Date.now()-lastStatusCheck<30000))return;statusLoading=true;lastStatusCheck=Date.now();
  try{const token=await getAccessToken(),response=await fetch(WORKER_ENDPOINT+"api/billing/status",{headers:{Authorization:"Bearer "+token}}),data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Could not retrieve billing status.");serverSubscription=data.subscription||{plan:"none",status:"inactive"};render();
  }catch(error){$("billingAccountNote").textContent="Billing status could not be verified yet: "+(error.message||"Please try again later.")+" Checkout status is never assumed from the browser.";}
  finally{statusLoading=false;}
 }
 function initializePaddle(){
  if(paddleReady)return true;
  if(!window.Paddle||!window.Paddle.Environment||!window.Paddle.Checkout)throw new Error("Paddle Checkout did not load. Refresh the page and try again.");
  window.Paddle.Environment.set("sandbox");
  window.Paddle.Initialize({token:PADDLE_TOKEN,eventCallback:event=>{
   if(event&&event.name==="checkout.completed"){
    $("pricingActionStatus").textContent="Checkout completed in Sandbox. Waiting for Paddle's verified subscription update…";
    (async()=>{for(let attempt=0;attempt<8;attempt++){await wait(1500);await refreshStatus(true);if(serverSubscription&&["active","trialing","past_due","paused","canceled"].includes(serverSubscription.status))break;}})();
   }
  }});
  paddleReady=true;return true;
 }
 async function startCheckout(name){
  const priceId=PRICE_IDS[name]&&PRICE_IDS[name][billingPeriod];if(!priceId)return;
  const buttons=[...document.querySelectorAll("[data-checkout]")];buttons.forEach(button=>button.disabled=true);$("pricingActionStatus").textContent="Preparing secure Paddle Sandbox checkout…";
  try{initializePaddle();const token=await getAccessToken(),response=await fetch(WORKER_ENDPOINT+"api/billing/checkout",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({priceId})}),data=await response.json().catch(()=>({}));
   if(!response.ok||!data.transactionId)throw new Error(data.error||"Checkout could not be created.");$("pricingActionStatus").textContent="Opening Paddle's secure Sandbox checkout…";window.Paddle.Checkout.open({transactionId:data.transactionId});
  }catch(error){$("pricingActionStatus").textContent="Checkout could not start: "+(error.message||"Please try again.");}
  finally{buttons.forEach(button=>button.disabled=false);}
 }
 async function requestPlan(name){
  const plan=PLANS.find(item=>item.name===name);if(!plan)return;const events=safeEvents();
  if(events.some(event=>event.status==="request_pending"&&event.plan===name&&event.billingPeriod===billingPeriod)){$("pricingActionStatus").textContent="A request for this plan is already awaiting setup. No payment has been taken.";return;}
  const now=new Date().toISOString(),event={id:"bill_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),type:name==="Starter"?"trial_request":"enterprise_contact",plan:name,billingPeriod,requestedAt:now,status:"request_pending"},nextEvents=[event,...events].slice(0,100),nextProfile={plan:name,status:"request_pending",billingPeriod,requestedAt:now,provider:"not_connected",updatedAt:now};
  $("pricingActionStatus").textContent="Saving your request…";write("billing_events",nextEvents);write("billing_subscription",nextProfile);
  const saved=await writeAndSync("billing_events",nextEvents),profileSaved=await writeAndSync("billing_subscription",nextProfile);
  $("pricingActionStatus").textContent=saved&&profileSaved?(name==="Starter"?"Your one-day trial request has been saved. It is not active yet; no payment has been taken.":"Your Enterprise contact request has been saved. No payment has been taken."):"Your request is saved on this device, but cloud sync needs attention. No payment has been taken.";render();
 }
 document.querySelectorAll("[data-billing]").forEach(button=>button.addEventListener("click",()=>{billingPeriod=button.dataset.billing;render();}));
 $("pricing").addEventListener("click",event=>{const checkout=event.target.closest("[data-checkout]");if(checkout){startCheckout(checkout.dataset.checkout);return;}const button=event.target.closest("[data-plan]");if(button)requestPlan(button.dataset.plan).catch(error=>{$("pricingActionStatus").textContent="Could not save request: "+(error.message||"Please try again.");});});
 return {render,refreshStatus};
}
window.VEXTBilling={init};
})();