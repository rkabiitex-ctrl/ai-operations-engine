(()=>{"use strict";
const PLANS=[
 {name:"Starter",monthly:19,yearly:190,features:["Business dashboard","AI workspace","Client and invoice management","Business activity overview","Core NEXUS tools"]},
 {name:"Professional",monthly:49,yearly:490,features:["Everything in Starter","AI customer support tools","Cloud enquiry collection","Sales Intelligence and Smart CRM","Marketing Studio and Automation Network","Business analytics"]},
 {name:"Enterprise",monthly:null,yearly:null,features:["Everything in Professional","Custom onboarding","Team and access controls","Custom usage and support options"]}
];
function init({$,read,write,writeAndSync}){
 let billingPeriod="monthly";
 const safeEvents=()=>{const events=read("billing_events",[]);return Array.isArray(events)?events:[]};
 const profile=()=>{const value=read("billing_subscription",{});return value&&typeof value==="object"&&!Array.isArray(value)?value:{plan:"none",status:"inactive",billingPeriod:"monthly",provider:"not_connected"}};
 const money=value=>value===null?"Custom":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
 function render(){
  const current=profile(),events=safeEvents(),plan=PLANS.find(p=>p.name===current.plan);
  const statusLabels={inactive:"Not subscribed",request_pending:"Request submitted · awaiting setup",provider_pending:"Awaiting provider confirmation",active:"Active",trialing:"Trial active",past_due:"Payment issue",cancelled:"Cancelled"};
  $("billingCurrentPlan").textContent=plan?plan.name:"No active plan";
  $("billingCurrentState").textContent=statusLabels[current.status]||"Not subscribed";
  $("billingNextDate").textContent=current.status==="active"||current.status==="trialing"?"Provider confirmation required":"—";
  $("billingProviderState").textContent="Not connected";
  $("billingStatus").textContent=current.status==="active"||current.status==="trialing"?"PROVIDER CONFIRMED":current.status==="request_pending"?"REQUEST PENDING":"NO ACTIVE PLAN";
  $("billingAccountNote").textContent=current.status==="request_pending"?"Your plan request is saved to your account. It does not activate access or charge your account.": "No subscription is active. Choose a plan to submit a request; trial access and checkout remain disabled until a payment provider is connected.";
  document.querySelectorAll("[data-billing]").forEach(button=>{const active=button.dataset.billing===billingPeriod;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  document.querySelectorAll(".plan-price").forEach(el=>{const planData=PLANS.find(p=>p.name===el.closest(".plan-card").querySelector(".plan-name").textContent.trim());el.textContent=planData?money(planData[billingPeriod]):"—";});
  document.querySelectorAll("[data-saving]").forEach(el=>el.textContent=billingPeriod==="yearly"?el.dataset.saving:"");
  document.querySelectorAll(".plan-period").forEach((el,index)=>{el.textContent=index===2?"custom quotation":billingPeriod==="yearly"?"per year":"per month";});
  const history=$("billingHistory");history.replaceChildren();
  if(!events.length){const empty=document.createElement("p");empty.className="muted small";empty.textContent="No billing requests or invoices have been recorded.";history.append(empty);}
  events.slice().sort((a,b)=>new Date(b.requestedAt||0)-new Date(a.requestedAt||0)).forEach(event=>{
   const row=document.createElement("div");row.className="billing-history-row";
   const detail=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small"),state=document.createElement("span");
   title.textContent=event.type==="trial_request"?"One-day Starter trial request":event.type==="enterprise_contact"?"Enterprise sales request":event.plan+" plan request";
   meta.textContent=new Date(event.requestedAt).toLocaleString()+" · "+(event.billingPeriod||"monthly");
   state.textContent="PENDING";detail.append(title,meta);row.append(detail,state);history.append(row);
  });
  const entitlements=$("billingEntitlements");entitlements.replaceChildren();
  const visiblePlan=plan||PLANS[0];
  visiblePlan.features.forEach(feature=>{const row=document.createElement("div");row.className="billing-entitlement-row";const label=document.createElement("span");label.textContent=feature;const value=document.createElement("small");value.textContent="Preview only";row.append(label,value);entitlements.append(row);});
  if(current.status!=="active"&&current.status!=="trialing"){const note=document.createElement("p");note.className="billing-note";note.textContent="No paid features are being granted by this preview.";entitlements.append(note);}
 }
 async function requestPlan(name){
  const plan=PLANS.find(item=>item.name===name);if(!plan)return;
  const events=safeEvents();
  if(events.some(event=>event.status==="request_pending"&&event.plan===name&&event.billingPeriod===billingPeriod)){
   $("pricingActionStatus").textContent="A request for this plan is already awaiting setup. No payment has been taken.";return;
  }
  const now=new Date().toISOString(),event={id:"bill_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8),type:name==="Starter"?"trial_request":name==="Enterprise"?"enterprise_contact":"plan_request",plan:name,billingPeriod,requestedAt:now,status:"request_pending"};
  const nextEvents=[event,...events].slice(0,100);
  const nextProfile={plan:name,status:"request_pending",billingPeriod,requestedAt:now,provider:"not_connected",updatedAt:now};
  $("pricingActionStatus").textContent="Saving your request…";
  write("billing_events",nextEvents);write("billing_subscription",nextProfile);
  const saved=await writeAndSync("billing_events",nextEvents);
  const profileSaved=await writeAndSync("billing_subscription",nextProfile);
  $("pricingActionStatus").textContent=saved&&profileSaved
   ?(name==="Starter"?"Your one-day trial request has been saved. It is not active yet; no payment has been taken.":name==="Enterprise"?"Your Enterprise contact request has been saved. No payment has been taken.":"Your Professional plan request has been saved. Checkout is not connected and no payment has been taken.")
   :"Your request is saved on this device, but cloud sync needs attention. No payment has been taken.";
  render();
 }
 document.querySelectorAll("[data-billing]").forEach(button=>button.addEventListener("click",()=>{billingPeriod=button.dataset.billing;render();}));
 $("pricing").addEventListener("click",event=>{const button=event.target.closest("[data-plan]");if(button){requestPlan(button.dataset.plan).catch(error=>{$("pricingActionStatus").textContent="Could not save request: "+(error.message||"Please try again.");});}});
 return {render};
}
window.VEXTBilling={init};
})();