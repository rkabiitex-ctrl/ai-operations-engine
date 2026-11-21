"use strict";
const $=id=>document.getElementById(id);
const currencies=["USD","UGX","EUR","GBP","KES","NGN","ZAR","CAD","AUD","INR","JPY","AED","GHS","TZS"];
let key="vext_guest_";
let vextWorkspaceUserId=null;
let vextWorkspaceReady=false;
let vextWorkspaceSyncTimer=null;
let vextWorkspaceSyncBusy=false;
let vextWorkspaceSyncQueued=false;
let vextWorkspaceLoadPromise=null;
const VEXT_WORKSPACE_KEYS=["leads","invoices","logs","currency","business","country","support_settings","support_business_id","chat_history","chat_conversations","active_chat_id","audit_reports","business_analysis_reports","management_actions","nexus_tasks","notifications"];
function workspaceSnapshot(){
 return {
  leads:read("leads",[]),invoices:read("invoices",[]),logs:read("logs",[]),
  currency:localStorage.getItem(key+"currency")||"USD",
  business:localStorage.getItem(key+"business")||"VEXT AI",
  country:localStorage.getItem(key+"country")||"",
  support_settings:read("support_settings",{}),
  support_business_id:localStorage.getItem(key+"support_business_id")||"",
  chat_history:read("chat_history",[]),
  chat_conversations:read("chat_conversations",[]),
  active_chat_id:localStorage.getItem(key+"active_chat_id")||"",
  audit_reports:read("audit_reports",[]),
  business_analysis_reports:read("business_analysis_reports",[]), management_actions:read("management_actions",[]),
  nexus_tasks:read("nexus_tasks",[]), notifications:read("notifications",[])
 };
}
function setWorkspaceSyncStatus(value,bad=false){
 const el=$("workspaceSyncStatus");
 if(el){el.textContent=value;el.style.color=bad?"#fb7185":""}
}
async function syncWorkspaceNow(){
 if(!vextWorkspaceUserId||!vextWorkspaceReady)return;
 if(vextWorkspaceSyncBusy){vextWorkspaceSyncQueued=true;return}
 vextWorkspaceSyncBusy=true;
 setWorkspaceSyncStatus("Syncing securely…");
 try{
  const accessToken=await getVextAccessToken();
  const response=await fetch(VEXT_CHAT_ENDPOINT+"api/admin/workspace",{
   method:"PUT",
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+accessToken},
   body:JSON.stringify({workspace:workspaceSnapshot()})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("Cloud sync failed ("+response.status+")"));
  setWorkspaceSyncStatus("Cloud synced");
 }catch(error){
  setWorkspaceSyncStatus("Saved on this device · cloud sync needs attention",true);
  console.error("VEXT AI cloud sync:",error);
 }finally{
  vextWorkspaceSyncBusy=false;
  if(vextWorkspaceSyncQueued){vextWorkspaceSyncQueued=false;scheduleWorkspaceSync(150)}
 }
}
function scheduleWorkspaceSync(delay=900){
 if(!vextWorkspaceUserId||!vextWorkspaceReady)return;
 clearTimeout(vextWorkspaceSyncTimer);
 setWorkspaceSyncStatus("Changes saved · syncing…");
 vextWorkspaceSyncTimer=setTimeout(()=>syncWorkspaceNow(),delay);
}
function applyWorkspaceSnapshot(workspace){
 const rawKeys=["currency","business","country","support_business_id","active_chat_id"];
 VEXT_WORKSPACE_KEYS.forEach(name=>{
  if(!Object.prototype.hasOwnProperty.call(workspace,name)){localStorage.removeItem(key+name);return}
  const value=workspace[name];
  localStorage.setItem(key+name,rawKeys.includes(name)?String(value??""):JSON.stringify(value));
 });
}
function read(k, fallback=[]){
 try{
  const value=JSON.parse(localStorage.getItem(key+k));
  return value===null?fallback:value;
 }catch{return fallback}
}
function write(k,v){localStorage.setItem(key+k,JSON.stringify(v));scheduleWorkspaceSync()}
const {id,esc,formatMoney}=window.VEXTUtils;
function currentCurrency(){return $("currency").value}
function log(message){
 const logs=read("logs");
 logs.unshift({message,time:new Date().toLocaleString()});
 write("logs",logs.slice(0,12));
 renderActivity();
}

const NEXUS_AGENT_GUIDANCE={
 "Business Analyst":"You are the VEXT NEXUS Business Analyst. Analyse the user's stated business question and supplied facts. Identify observations, uncertainties, risks and practical opportunities. Never invent company data or market statistics.",
 "Growth Strategist":"You are the VEXT NEXUS Growth Strategist. Prepare ethical, realistic customer acquisition, positioning, marketing and growth plans. Avoid guaranteed outcomes, fabricated research, spam and deceptive tactics.",
 "Finance Analyst":"You are the VEXT NEXUS Finance Analyst. Explain only supplied financial information. Distinguish invoiced amounts, cash collected, costs and profit. Never invent figures or guarantee investment outcomes.",
 "Customer Success Agent":"You are the VEXT NEXUS Customer Success Agent. Prepare empathetic customer messages, support playbooks and service workflows. Never invent company policies, prices, refunds or product facts. Flag cases needing a human.",
 "Operations Planner":"You are the VEXT NEXUS Operations Planner. Convert the user's goal into milestones, owners, dependencies, timelines, risks and measurable completion criteria. Do not claim tasks have been executed."
};
function renderNexus(){
 const tasks=read("nexus_tasks",[]).slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
 $("nexusTotalTasks").textContent=tasks.length;$("nexusReviewTasks").textContent=tasks.filter(t=>t.status==="Awaiting review").length;$("nexusApprovedTasks").textContent=tasks.filter(t=>t.status==="Approved").length;$("nexusTaskCountLabel").textContent=tasks.length+" TASK"+(tasks.length===1?"":"S");
 const list=$("nexusTaskList");list.replaceChildren();
 if(!tasks.length){const empty=document.createElement("div");empty.className="nexus-empty";empty.textContent="No assignments yet. Choose a specialist and give NEXUS its first task.";list.append(empty);return;}
 tasks.slice(0,30).forEach(task=>{
  const card=document.createElement("article");card.className="nexus-task";const top=document.createElement("div");top.className="nexus-task-top";const identity=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("div");name.textContent=task.agent||"VEXT NEXUS";meta.className="nexus-task-meta";meta.textContent=(task.priority||"Normal")+" priority · "+(task.createdAt?new Date(task.createdAt).toLocaleString():"Saved task");identity.append(name,meta);
  const badge=document.createElement("span");badge.className="nexus-task-status"+(task.status==="Approved"?" approved":task.status==="Failed"?" failed":"");badge.textContent=task.status||"Saved";top.append(identity,badge);card.append(top);
  const prompt=document.createElement("p");prompt.className="nexus-task-prompt";prompt.textContent=task.prompt||"";card.append(prompt);
  if(task.result){const result=document.createElement("div");result.className="nexus-task-result";result.textContent=task.result;card.append(result);}
  if(task.error){const error=document.createElement("p");error.className="nexus-task-meta";error.style.color="#fda4af";error.textContent="Could not complete: "+task.error;card.append(error);}
  const actions=document.createElement("div");actions.className="nexus-task-actions";
  if(task.status==="Awaiting review"){const approve=document.createElement("button");approve.type="button";approve.className="primary";approve.dataset.nexusApprove=task.id;approve.textContent="Approve draft";actions.append(approve);}
  const linkedAction=read("management_actions",[]).find(action=>action.sourceNexusTaskId===task.id);
  if(task.status==="Approved"&&linkedAction){const linked=document.createElement("span");linked.className="nexus-task-meta";linked.textContent="Management action created";actions.append(linked);}
  if(task.status==="Approved"&&!linkedAction){const bridge=document.createElement("button");bridge.type="button";bridge.className="secondary";bridge.dataset.nexusCreateAction=task.id;bridge.textContent="Review & send to Action Tracker";actions.append(bridge);}
  if(task.status!=="Archived"){const archive=document.createElement("button");archive.type="button";archive.className="secondary";archive.dataset.nexusArchive=task.id;archive.textContent="Archive";actions.append(archive);}
  if(actions.children.length)card.append(actions);list.append(card);
 });
}
function selectNexusAgent(agent){$("nexusAgentSelect").value=agent;document.querySelectorAll("[data-nexus-agent]").forEach(b=>b.classList.toggle("selected",b.dataset.nexusAgent===agent));}
$("nexusAgentGrid").addEventListener("click",e=>{const b=e.target.closest("[data-nexus-agent]");if(b)selectNexusAgent(b.dataset.nexusAgent)});
$("nexusAgentSelect").addEventListener("change",()=>selectNexusAgent($("nexusAgentSelect").value));
$("nexusClearPrompt").addEventListener("click",()=>{$("nexusTaskPrompt").value="";$("nexusTaskPrompt").focus()});
$("nexusTaskForm").addEventListener("submit",async e=>{
 e.preventDefault();const prompt=$("nexusTaskPrompt").value.trim(),agent=$("nexusAgentSelect").value,priority=$("nexusPriority").value,button=$("nexusRunTask"),status=$("nexusTaskStatus");
 if(prompt.length<8){status.textContent="Please describe the task in at least 8 characters.";return;}
 button.disabled=true;button.textContent="NEXUS is working…";status.textContent="Sending your assignment to the VEXT AI service…";
 const task={id:id(),agent,priority,prompt,status:"Running",createdAt:new Date().toISOString(),result:""};const tasks=read("nexus_tasks",[]);tasks.unshift(task);write("nexus_tasks",tasks.slice(0,100));renderNexus();
 const workspaceContext=window.VEXTContext.build({read,currentCurrency,business:localStorage.getItem(key+"business")||"VEXT AI",country:localStorage.getItem(key+"country")||""});
 const message=(NEXUS_AGENT_GUIDANCE[agent]||NEXUS_AGENT_GUIDANCE["Business Analyst"])+"\n\nCURRENT WORKSPACE CONTEXT (aggregated records; may be incomplete and are not independently verified):\n"+JSON.stringify(workspaceContext)+"\n\nVEXT NEXUS RULES:\n- Use only facts supplied in this request. State assumptions and missing information.\n- Produce a structured, actionable professional deliverable.\n- Do not claim access to external accounts, websites, private databases or live data.\n- Do not claim to have executed actions, contacted people, published content, changed records or spent money.\n- Identify material risks and where human verification is required.\n\nPRIORITY: "+priority+"\nUSER TASK:\n"+prompt;
 try{
  const token=await getVextAccessToken(),response=await fetch(VEXT_CHAT_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({message,maxOutputTokens:2400,history:[]})}),data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("AI request failed ("+response.status+")"));
  const result=typeof data.reply==="string"?data.reply.trim():(typeof data.output_text==="string"?data.output_text.trim():"");if(!result)throw new Error("The AI service returned an empty response.");
  const current=read("nexus_tasks",[]),saved=current.find(x=>x.id===task.id);if(saved){saved.result=result;saved.status="Awaiting review";saved.completedAt=new Date().toISOString();write("nexus_tasks",current);}
  log("VEXT NEXUS "+agent+" prepared a draft for review.");status.textContent="Draft prepared. Review the result in Mission Control before using it.";
 }catch(error){const current=read("nexus_tasks",[]),saved=current.find(x=>x.id===task.id);if(saved){saved.status="Failed";saved.error=error.message||"Please try again.";write("nexus_tasks",current);}status.textContent="NEXUS could not complete this assignment: "+(error.message||"Please try again.");}
 finally{button.disabled=false;button.textContent="✧ Assign task to NEXUS";renderNexus();}
});
function extractNexusActionTitle(result,prompt){
 const lines=String(result||"").split(/\r?\n/);
 const heading=lines.findIndex(line=>/specific next steps|recommended actions|recommended next steps|action plan|next steps/i.test(line));
 const candidates=(heading>=0?lines.slice(heading+1):lines).map(line=>line.trim()).filter(Boolean);
 const bullet=candidates.find(line=>/^(?:[-*•]|\d+[.)])\s+/.test(line));
 const cleaned=(bullet||prompt||"NEXUS recommended action").replace(/^(?:[-*•]|\d+[.)])\s+/,"").replace(/\*\*/g,"").trim();
 return cleaned.slice(0,180);
}
$("nexusTaskList").addEventListener("click",e=>{
 const approve=e.target.closest("[data-nexus-approve]"),archive=e.target.closest("[data-nexus-archive]"),createAction=e.target.closest("[data-nexus-create-action]");
 if(!approve&&!archive&&!createAction)return;
 const taskId=approve?approve.dataset.nexusApprove:archive?archive.dataset.nexusArchive:createAction.dataset.nexusCreateAction;
 const tasks=read("nexus_tasks",[]),task=tasks.find(x=>x.id===taskId);if(!task)return;
 if(createAction&&task.status==="Approved"){
  const existing=read("management_actions",[]).find(action=>action.sourceNexusTaskId===task.id);
  if(existing){$("nexusTaskStatus").textContent="This NEXUS assignment already has a management action.";return;}
  window.VEXTNexusActionDraft={taskId:task.id,agent:task.agent||"VEXT NEXUS",prompt:task.prompt||"",title:extractNexusActionTitle(task.result,task.prompt),priority:["High","Medium","Low"].includes(task.priority)?task.priority:"Medium"};
  navigate("analytics");
  $("newActionTitle").value=window.VEXTNexusActionDraft.title;
  $("newActionOwner").value="";
  $("newActionPriority").value=window.VEXTNexusActionDraft.priority;
  $("newActionDue").value="";
  $("managementActionStatus").textContent="Review the proposed action, assign an owner and due date, then add it. Nothing has been created yet.";
  $("newActionTitle").focus();
  return;
 }
 if(approve&&task.status==="Awaiting review"){task.status="Approved";task.approvedAt=new Date().toISOString();log("VEXT NEXUS draft approved by the user.");}
 if(archive){task.status="Archived";task.archivedAt=new Date().toISOString();log("VEXT NEXUS assignment archived.");}
 write("nexus_tasks",tasks);renderNexus();
});

function navigate(page){
 if(page==="analytics"&&typeof renderAnalystHistory==="function"){renderAnalystHistory();renderManagementActions();}
 document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
 document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
 $(page).classList.add("active");
 const titles={dashboard:"Business Overview",nexus:"VEXT NEXUS Command Centre",ai:"AI Workspace",leads:"Client Management",
 invoices:"Invoice Management",chat:"VEXT AI Chat",support:"Sales Agent","customer-support":"AI Customer Support Desk",marketing:"AI Marketing Studio",employees:"AI Employees",analytics:"Business Analytics",audit:"AI Audit Centre",settings:"Platform Settings",pricing:"VEXT AI Pricing",intelligence:"VEXT AI Intelligence Centre"};
 $("pageTitle").textContent=titles[page]|| (page==="notifications"?"Notification Centre":"VEXT AI");
 if(page==="notifications")vextNotifications.render();
 if(page==="intelligence")vextIntelligence.render();
}
document.querySelectorAll(".nav").forEach(n=>n.addEventListener("click",()=>navigate(n.dataset.page)));
$( "openSalesEmployee" ).addEventListener("click",()=>navigate("support"));

$( "openCustomerSupport" ).addEventListener("click",()=>{navigate("customer-support");renderCustomerSupportChat();});
$("customerSupportOpenTraining").addEventListener("click",()=>navigate("support"));
function renderCustomerSupportChat(){
 const area=$("customerSupportMessages");if(!area)return;
 area.replaceChildren();
 const settings=getSupportSettings();
 const welcome=document.createElement("div");welcome.className="chat-message assistant";
 const role=document.createElement("span");role.className="chat-role";role.textContent=(settings.business||"VEXT AI")+" · CUSTOMER CARE";
 const body=document.createElement("div");body.textContent="Hello! I’m the customer support assistant for "+(settings.business||"your business")+". How can I help you today?";
 welcome.append(role,body);area.append(welcome);
 const history=read("customer_support_preview",[]);
 history.forEach(item=>{const bubble=document.createElement("div");bubble.className="chat-message "+(item.role==="user"?"user":"assistant");const label=document.createElement("span");label.className="chat-role";label.textContent=item.role==="user"?"CUSTOMER":"SUPPORT ASSISTANT";const content=document.createElement("div");content.textContent=item.content;bubble.append(label,content);area.append(bubble);});
 area.scrollTop=area.scrollHeight;$("customerSupportKnowledge").textContent=settings.instructions?"Configured":"Needs setup";
}
async function askCustomerSupport(){
 const input=$("customerSupportInput"),button=$("customerSupportSend"),status=$("customerSupportStatus"),question=input.value.trim();if(!question)return;
 const settings=getSupportSettings(),history=read("customer_support_preview",[]),urgent=/(refund|chargeback|complaint|angry|legal|lawsuit|account hacked|security breach|fraud|medical emergency)/i.test(question);
 history.push({role:"user",content:question});write("customer_support_preview",history.slice(-30));renderCustomerSupportChat();input.value="";button.disabled=true;button.textContent="Thinking…";status.textContent="Connecting to the VEXT AI service…";
 const prompt="You are the first-line customer support agent for "+settings.business+". Be calm, empathetic, concise and professional.\nBUSINESS KNOWLEDGE (only source of business facts):\n"+(settings.instructions||"No detailed business knowledge has been configured. Ask clarifying questions and recommend human confirmation for business-specific facts.")+"\nRULES:\n- Never invent prices, policies, stock, availability, delivery dates, warranties or guarantees.\n- If an answer is not in the knowledge, say a team member must confirm it.\n- For complaints, refunds, billing disputes, account/security matters, legal threats or safety issues, show empathy and recommend a human team member. Do not promise resolution.\n- Never request passwords, one-time codes or full payment-card details.\n- If a human must take over, append [HUMAN REVIEW REQUIRED] on a new line.\nCUSTOMER MESSAGE:\n"+question;
 try{
  const token=await getVextAccessToken(),response=await fetch(VEXT_CHAT_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({message:prompt,maxOutputTokens:2400})}),data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("AI request failed ("+response.status+")"));
  let reply=typeof data.reply==="string"?data.reply.trim():"";if(!reply)throw new Error("The AI service returned an empty response.");
  const flagged=urgent||reply.includes("[HUMAN REVIEW REQUIRED]");reply=reply.replace(/\n?\[HUMAN REVIEW REQUIRED\]/g,"").trim();if(flagged)reply+="\n\nHuman review recommended before responding or taking action.";
  history.push({role:"assistant",content:reply});write("customer_support_preview",history.slice(-30));renderCustomerSupportChat();status.textContent=flagged?"Response ready · Human review recommended.":"Response received · Check business-specific details before sending.";
 }catch(error){history.push({role:"assistant",content:"I couldn’t reach the AI service. "+(error.message||"Please try again.")});write("customer_support_preview",history.slice(-30));renderCustomerSupportChat();status.textContent="Connection problem. Check your sign-in and AI backend.";}
 finally{button.disabled=false;button.textContent="Send message ↑";input.focus();}
}
$("customerSupportSend").addEventListener("click",askCustomerSupport);
$("customerSupportInput").addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();askCustomerSupport();}});
$("customerSupportClear").addEventListener("click",()=>{write("customer_support_preview",[]);renderCustomerSupportChat();$("customerSupportStatus").textContent="Conversation cleared.";});

function marketingDrafts(){const items=read("marketing_drafts",[]);return Array.isArray(items)?items:[];}
function renderMarketingHistory(){
 const drafts=marketingDrafts(),area=$("marketingHistory");$("marketingDraftCount").textContent=String(drafts.length);
 area.replaceChildren();
 if(!drafts.length){area.textContent="No saved campaigns yet.";return;}
 drafts.slice(0,8).forEach((draft,index)=>{const row=document.createElement("div");row.className="action-row";row.style.borderBottom="1px solid var(--border)";row.style.padding="10px 0";
 const info=document.createElement("div");const title=document.createElement("strong");title.textContent=draft.title||"Campaign draft";const date=document.createElement("div");date.className="muted small";date.textContent=new Date(draft.createdAt).toLocaleString();info.append(title,date);
 const actions=document.createElement("div");const open=document.createElement("button");open.className="secondary";open.type="button";open.textContent="Open";open.addEventListener("click",()=>{marketingCurrentDraft=draft.content;$("marketingResult").textContent=draft.content;$("copyMarketing").disabled=false;$("saveMarketing").disabled=true;});
 const del=document.createElement("button");del.className="secondary";del.type="button";del.textContent="Delete";del.style.marginLeft="6px";del.addEventListener("click",()=>{write("marketing_drafts",marketingDrafts().filter((_,i)=>i!==index));renderMarketingHistory();});
 actions.append(open,del);row.append(info,actions);area.append(row);
 });
}
let marketingCurrentDraft="";
function openMarketingManager(){
 const settings=getSupportSettings();$("marketingBusinessName").textContent=settings.business||"Your business";$("marketingResult").textContent="Your campaign strategy and content will appear here.";$("marketingStatus").textContent="Complete the brief, then generate your campaign draft.";marketingCurrentDraft="";$("copyMarketing").disabled=true;$("saveMarketing").disabled=true;renderMarketingHistory();
}
$("openMarketingManager").addEventListener("click",()=>{navigate("marketing");openMarketingManager();});
async function generateMarketingCampaign(){
 const offer=$("marketingOffer").value.trim(),objective=$("marketingObjective").value,audience=$("marketingAudience").value.trim(),channel=$("marketingChannel").value,tone=$("marketingTone").value,notes=$("marketingNotes").value.trim(),button=$("generateMarketing");
 if(!offer){$("marketingStatus").textContent="Please describe the product, service or offer first.";return;}
 if(!audience){$("marketingStatus").textContent="Please specify the target audience first.";return;}
 button.disabled=true;button.textContent="Creating campaign…";$("copyMarketing").disabled=true;$("saveMarketing").disabled=true;
 $("marketingStatus").textContent="Preparing your campaign in 8 focused sections…";$("marketingResult").textContent="Starting campaign generation…";
 const settings=getSupportSettings();
 const context="Act as a senior, ethical marketing strategist for "+(settings.business||"the user's business")+". Create a practical, specific campaign draft using only supplied facts.\nBUSINESS KNOWLEDGE:\n"+(settings.instructions||"No additional business information supplied.")+"\nCAMPAIGN BRIEF:\nOffer: "+offer+"\nObjective: "+objective+"\nAudience: "+audience+"\nChannel: "+channel+"\nTone: "+tone+"\nExtra details: "+(notes||"None supplied")+"\nGLOBAL RULES: Do not invent prices, discounts, product features, customer testimonials, statistics, certifications, guarantees, results, research or performance data. Clearly label assumptions. Use platform-appropriate language. This is a draft for human review; do not claim to publish or launch anything.";
 const parts=[
  {title:"PART 1 — CAMPAIGN STRATEGY",task:"Write only the campaign strategy: concept and core message; creative direction; defined audience; clearly labelled audience assumptions; recommended positioning; customer journey; primary and secondary CTA. Keep it concise but complete. Do not write DM scripts, content variations, schedule or metrics."},
  {title:"PART 2 — DM HANDLING AND VERIFICATION",task:"Write a complete practical DM handling flow for this campaign. Include a short welcome, one-question-at-a-time discovery sequence, responsible product recommendation using verified facts only, purchase handoff, optional consent-based contact collection, privacy safeguards, and a short list of facts the business must verify. Finish every step and sentence. Do not write content variations, schedule or metrics."},
  {title:"PART 3 — CONTENT VARIATION 1",task:"Create exactly ONE complete Instagram content/ad variation. Include format, objective, opening hook, visual/scene direction, on-screen text where useful, a fully written ready-to-review caption/ad copy, and CTA. Finish every sentence. Do not create other variations or campaign sections."},
  {title:"PART 4 — CONTENT VARIATION 2",task:"Create exactly ONE complete, distinct Instagram content/ad variation. Include format, objective, opening hook, visual/scene direction, on-screen text where useful, a fully written ready-to-review caption/ad copy, and CTA. Finish every sentence. Do not create other variations or campaign sections."},
  {title:"PART 5 — CONTENT VARIATION 3",task:"Create exactly ONE complete, distinct Instagram content/ad variation. Include format, objective, opening hook, visual/scene direction, on-screen text where useful, a fully written ready-to-review caption/ad copy, and CTA. Finish every sentence. Do not create other variations or campaign sections."},
  {title:"PART 6 — SEVEN-DAY EXECUTION SCHEDULE",task:"Create a complete practical 7-day execution schedule in a table with Day, Activity and Purpose columns. Include preparation and approvals before publishing, content activity, responsible DM handling and a final review. Clearly state that actions are conditional on owner approval and available capacity. Do not write metrics."},
  {title:"PART 7 — SUCCESS METRICS",task:"Provide a concise complete metrics table with metric, how to track and what to compare. Include reach/views, engagement, saves/shares, profile actions, qualified DMs, response time, verified sales/conversions and paid-vs-organic distinction where relevant. Define qualified DM clearly. Do not invent targets. Include measurement windows, attribution limitations and a rule to label unavailable data rather than estimate. Do not write a checklist."},
  {title:"PART 8 — PRE-PUBLISH VERIFICATION CHECKLIST",task:"Provide a complete practical pre-publish checklist covering product facts and imagery, pricing and stock, US service and shipping coverage, purchase/payment/return/refund/warranty terms, asset rights and approvals, account access, budget approval, DM staffing, privacy, consent and data handling. Finish with a clear human-approval reminder. Do not write metrics."}
 ];
 try{
  const token=await getVextAccessToken();
  if(!token)throw new Error("Please sign in again before generating a campaign.");
  const completed=[];
  for(let i=0;i<parts.length;i++){
   $("marketingStatus").textContent="Generating section "+(i+1)+" of 8: "+parts[i].title+"…";
   const message=context+"\n\n"+parts[i].title+"\n"+parts[i].task+"\nKeep this section focused and complete. Use clear headings. Do not refer to missing sections. Do not end mid-sentence or mid-table.";
   const response=await fetch(VEXT_CHAT_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({message,maxOutputTokens:1100})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("AI request failed in section "+(i+1)+" ("+response.status+")."));
   const part=typeof data.reply==="string"?data.reply.trim():"";
   if(!part)throw new Error("The AI service returned an empty response for section "+(i+1)+".");
   completed.push("## "+parts[i].title+"\n\n"+part);
   $("marketingResult").textContent="VEXT GLOBAL ELECTRONICS — CAMPAIGN DRAFT\nFor human review and approval. Nothing has been published or launched.\n\n"+completed.join("\n\n---\n\n");
  }
  const result="VEXT GLOBAL ELECTRONICS — CAMPAIGN DRAFT\nFor human review and approval. Nothing has been published or launched.\n\n"+completed.join("\n\n---\n\n");
  marketingCurrentDraft=result;$("marketingResult").textContent=result;$("copyMarketing").disabled=false;$("saveMarketing").disabled=false;$("marketingStatus").textContent="All 8 campaign sections generated. Review all claims before publishing.";
 }catch(error){
  const partial=$("marketingResult").textContent;
  $("marketingStatus").textContent="Campaign generation stopped before all 8 sections finished.";
  $("marketingResult").textContent=(partial&&partial!=="Starting campaign generation…"?partial+"\n\n":"")+"Generation error: "+(error.message||"Please try again.")+"\n\nThe incomplete draft cannot be saved. Please retry.";
 }finally{button.disabled=false;button.textContent="Generate campaign plan ✧";}
}
$("generateMarketing").addEventListener("click",generateMarketingCampaign);
$("copyMarketing").addEventListener("click",()=>{if(marketingCurrentDraft)navigator.clipboard.writeText(marketingCurrentDraft).then(()=>$("marketingStatus").textContent="Campaign copied to clipboard.").catch(()=>$("marketingStatus").textContent="Copy was blocked by the browser.");});
$("saveMarketing").addEventListener("click",()=>{if(!marketingCurrentDraft)return;const drafts=marketingDrafts();drafts.unshift({title:$("marketingOffer").value.trim().slice(0,65)||"Campaign draft",content:marketingCurrentDraft,createdAt:new Date().toISOString()});write("marketing_drafts",drafts.slice(0,30));$("saveMarketing").disabled=true;$("marketingStatus").textContent="Campaign draft saved in this browser.";renderMarketingHistory();});



$("openAuditor").addEventListener("click",()=>{navigate("audit");renderAuditCentre();});
$("openBusinessAnalyst").addEventListener("click",()=>{navigate("analytics");$("analystResult").innerHTML="";$("analystStatus").textContent="Choose a reporting period, then generate your business analysis.";});


let pricingBilling="monthly";
document.querySelectorAll("[data-billing]").forEach(button=>button.addEventListener("click",()=>{
 pricingBilling=button.dataset.billing;
 document.querySelectorAll("[data-billing]").forEach(item=>item.classList.toggle("active",item===button));
 document.querySelectorAll(".plan-price").forEach(price=>{price.textContent=price.dataset[pricingBilling]});
 document.querySelectorAll("[data-saving]").forEach(note=>{note.textContent=pricingBilling==="yearly"?note.dataset.saving:""});
 document.querySelectorAll(".plan-period").forEach((period,index)=>{if(index===0)period.textContent=pricingBilling==="yearly"?"per year after 7-day free trial":"per month after 7-day free trial";else if(index===1)period.textContent=pricingBilling==="yearly"?"per year":"per month";});
}));
document.querySelector("#pricing").addEventListener("click",event=>{
 const button=event.target.closest("[data-plan]");
 if(!button)return;
 const plan=button.dataset.plan;
 $("pricingActionStatus").textContent=plan==="Enterprise"
  ?"Enterprise selected. A sales contact form will be connected before launch."
  :plan+" selected. Account registration and secure checkout are not connected yet; no payment has been taken.";
});


const VEXT_CHAT_ENDPOINT="https://flat-star-50c3.rkabiitex.workers.dev/";
async function getVextAccessToken(){
 if(typeof window.vextGetAccessToken!=="function")throw new Error("Your VEXT AI sign-in is not ready. Refresh the page and sign in again.");
 return window.vextGetAccessToken();
}
function loadChatHistory(){
 const conversations=read("chat_conversations",[]);
 const activeId=localStorage.getItem(key+"active_chat_id")||"";
 const active=conversations.find(item=>item.id===activeId);
 if(active)return Array.isArray(active.messages)?active.messages:[];
 try{
  const legacy=JSON.parse(localStorage.getItem(key+"chat_history")||"[]");
  return Array.isArray(legacy)?legacy:[];
 }catch{return []}
}
function saveChatHistory(items){
 try{
  const conversations=read("chat_conversations",[]);
  let activeId=localStorage.getItem(key+"active_chat_id")||"";
  let active=conversations.find(item=>item.id===activeId);
  if(!active){
   active={id:id(),title:"Previous conversation",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[]};
   conversations.unshift(active);activeId=active.id;localStorage.setItem(key+"active_chat_id",activeId);
  }
  active.messages=items.slice(-100);
  active.updatedAt=new Date().toISOString();
  const firstQuestion=active.messages.find(item=>item.role==="user")?.content||"New conversation";
  if(active.title==="Previous conversation"||active.title==="New conversation")active.title=firstQuestion.slice(0,48)+(firstQuestion.length>48?"…":"");
  localStorage.setItem(key+"chat_conversations",JSON.stringify(conversations.slice(0,40)));
  localStorage.setItem(key+"chat_history",JSON.stringify(active.messages));
  scheduleWorkspaceSync();
 }catch(error){console.error("VEXT chat save:",error)}
}
function ensureChatConversations(){
 let conversations=read("chat_conversations",[]);
 if(!Array.isArray(conversations))conversations=[];
 if(!conversations.length){
  let legacy=[];try{legacy=JSON.parse(localStorage.getItem(key+"chat_history")||"[]")}catch{}
  if(Array.isArray(legacy)&&legacy.length){
   conversations=[{id:id(),title:(legacy.find(x=>x.role==="user")?.content||"Previous conversation").slice(0,48),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:legacy}];
  }
 }
 if(!conversations.length)conversations=[{id:id(),title:"New conversation",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[]}];
 let activeId=localStorage.getItem(key+"active_chat_id")||"";
 if(!conversations.some(x=>x.id===activeId))activeId=conversations[0].id;
 localStorage.setItem(key+"chat_conversations",JSON.stringify(conversations));
 localStorage.setItem(key+"active_chat_id",activeId);
 const active=conversations.find(x=>x.id===activeId);
 localStorage.setItem(key+"chat_history",JSON.stringify(active.messages||[]));
}
function startNewChat(){
 const conversations=read("chat_conversations",[]);
 const fresh={id:id(),title:"New conversation",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[]};
 conversations.unshift(fresh);
 localStorage.setItem(key+"chat_conversations",JSON.stringify(conversations.slice(0,40)));
 localStorage.setItem(key+"active_chat_id",fresh.id);
 localStorage.setItem(key+"chat_history","[]");
 scheduleWorkspaceSync();renderChatHistory();$("chatInput").focus();
}
function openChatConversation(conversationId){
 const conversations=read("chat_conversations",[]);
 const selected=conversations.find(item=>item.id===conversationId);if(!selected)return;
 localStorage.setItem(key+"active_chat_id",selected.id);
 localStorage.setItem(key+"chat_history",JSON.stringify(selected.messages||[]));
 renderChatHistory();
}
function addChatMessage(role,message){
 const area=$("chatMessages");
 const bubble=document.createElement("div");
 bubble.className="chat-message "+(role==="user"?"user":"assistant");
 const label=document.createElement("span");
 label.className="chat-role";
 label.textContent=role==="user"?"YOU":"VEXT AI";
 const body=document.createElement("div");
 body.textContent=message;
 bubble.append(label,body);
 area.appendChild(bubble);
 area.scrollTop=area.scrollHeight;
}
function renderChatHistoryNav(history){
 const list=$("chatHistoryList"),count=$("chatHistoryCount");if(!list)return;
 const conversations=read("chat_conversations",[]),activeId=localStorage.getItem(key+"active_chat_id")||"";
 if(count)count.textContent=conversations.length+" saved chats";
 list.innerHTML=conversations.map(item=>{
  const first=item.messages?.find(message=>message.role==="user")?.content||"New conversation";
  const title=item.title&&item.title!=="New conversation"?item.title:first;
  const active=item.id===activeId;
  return `<button type="button" class="chat-history-item ${active?"active":""}" data-chat-id="${esc(item.id)}"><span>${active?"CURRENT CHAT":"SAVED CHAT"}</span>${esc(title.slice(0,70))}</button>`;
 }).join("")||'<div class="chat-history-empty">Start a new chat to begin.</div>';
}
function renderChatHistory(){
 const area=$("chatMessages");
 area.replaceChildren();
 const history=loadChatHistory();
 if(!history.length){
  addChatMessage("assistant","Hello! I'm VEXT AI. How can I help you move your business forward today?");
 }else{
  history.forEach(item=>addChatMessage(item.role,item.content));
 }
 area.querySelectorAll(".chat-message").forEach((item,index)=>item.dataset.messageIndex=String(index));
 renderChatHistoryNav(history);
}
async function sendChatMessage(){
 const input=$("chatInput"),button=$("sendChat"),status=$("chatStatus");
 const message=input.value.trim();
 if(!message)return;
 const history=loadChatHistory();
 addChatMessage("user",message);
 history.push({role:"user",content:message});
 saveChatHistory(history);
 renderChatHistoryNav(history);
 input.value="";
 button.disabled=true;
 button.textContent="Thinking...";
 status.textContent="VEXT AI is preparing a response...";
 try{
  const accessToken=await getVextAccessToken();
  const response=await fetch(VEXT_CHAT_ENDPOINT,{
   method:"POST",
   headers:{"Content-Type":"application/json","Authorization":"Bearer "+accessToken},
   body:JSON.stringify({message,history:history.slice(-12)})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")"));
  const reply=typeof data.reply==="string"?data.reply:
   (typeof data.output_text==="string"?data.output_text:"");
  if(!reply)throw new Error("The AI service returned an empty response.");
  addChatMessage("assistant",reply);
  history.push({role:"assistant",content:reply});
  saveChatHistory(history);
  renderChatHistoryNav(history);
  status.textContent="Response received.";
 }catch(error){
  const messageText="I couldn't reach the AI service. "+(error.message||"Please try again.");
  addChatMessage("assistant",messageText);
  status.textContent="Connection problem. Check the backend and try again.";
 }finally{
  button.disabled=false;
  button.textContent="Send message";
  input.focus();
 }
}
$("sendChat").addEventListener("click",sendChatMessage);
$("chatInput").addEventListener("keydown",e=>{
 if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChatMessage()}
});
$("newChat").addEventListener("click",startNewChat);
$("clearChat").addEventListener("click",()=>{
 if(!confirm("Delete this conversation? Other saved chats will remain."))return;
 const activeId=localStorage.getItem(key+"active_chat_id")||"";
 let conversations=read("chat_conversations",[]).filter(item=>item.id!==activeId);
 if(!conversations.length)conversations=[{id:id(),title:"New conversation",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[]}];
 localStorage.setItem(key+"chat_conversations",JSON.stringify(conversations));
 localStorage.setItem(key+"active_chat_id",conversations[0].id);
 localStorage.setItem(key+"chat_history",JSON.stringify(conversations[0].messages||[]));
 scheduleWorkspaceSync();renderChatHistory();$("chatStatus").textContent="Conversation deleted.";
});
$("chatHistoryList").addEventListener("click",event=>{
 const item=event.target.closest("[data-chat-id]");if(item)openChatConversation(item.dataset.chatId);
});
$("chatMessages").addEventListener("click",()=>{});
document.querySelectorAll("[data-chat-prompt]").forEach(button=>button.addEventListener("click",()=>{
 $("chatInput").value=button.dataset.chatPrompt;
 $("chatInput").focus();
}));
document.querySelectorAll("[data-ai-template]").forEach(button=>button.addEventListener("click",()=>{
 $("docType").value=button.dataset.aiTemplate;
 $("docPrompt").value=button.dataset.aiPrompt;
 $("docPrompt").focus();
 $("docPrompt").scrollIntoView({behavior:"smooth",block:"center"});
}));
$("openVextChatFromStudio").addEventListener("click",()=>navigate("chat"));
ensureChatConversations();
renderChatHistory();

function renderActivity(){
 const logs=read("logs");
 $("activityFeed").innerHTML=logs.length?logs.map(x=>
 `<div class="activity">${esc(x.message)}<small>${esc(x.time)}</small></div>`
 ).join(""):'<div class="empty">No activity recorded yet.</div>';
}
const renderInvoices = window.VEXTInvoices.init({
 $, read, write, id, esc, formatMoney, currentCurrency, log,
 render: () => render()
});
const vextAudit = window.VEXTAudit.init({ $, read, write, id, esc, getVextAccessToken, VEXT_CHAT_ENDPOINT });
const renderAuditCentre = () => vextAudit.renderAuditCentre();
const formatAuditReport = value => vextAudit.formatAuditReport(value);
const renderManagementActions = window.VEXTManagement.init({ $, read, write, id, log });
const vextAnalytics = window.VEXTAnalytics.init({
 $, read, write, id, esc, formatMoney, currentCurrency,
 getClientSalesStage, formatAuditReport, getVextAccessToken,
 VEXT_CHAT_ENDPOINT, renderManagementActions
});
const renderAnalytics = () => vextAnalytics.renderAnalytics();
const renderAnalystHistory = () => vextAnalytics.renderAnalystHistory();
const vextNotifications = window.VEXTNotifications.init({ $, read, write, navigate });
const vextIntelligence = window.VEXTIntelligence.init({ $, read, currentCurrency, formatMoney, navigate });
function renderMissionControl(){
  const all=read("nexus_tasks",[]);
  const tasks=Array.isArray(all)?all:[];
  const today=new Date().toDateString();
  const active=tasks.filter(task=>task.status==="Running");
  const review=tasks.filter(task=>task.status==="Awaiting review");
  const completed=tasks.filter(task=>task.completedAt&&new Date(task.completedAt).toDateString()===today&&task.status!=="Failed");
  $("missionActiveCount").textContent=active.length;
  $("missionReviewCount").textContent=review.length;
  $("missionCompletedCount").textContent=completed.length;
  const recent=tasks.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,3);
  const list=$("missionRecentList");list.replaceChildren();
  $("missionRecentLabel").textContent=recent.length?recent.length+" latest":"No assignments yet";
  if(!recent.length){const empty=document.createElement("div");empty.className="mission-empty";empty.textContent="No assignments yet. Give NEXUS a task to see its progress here.";list.append(empty);return;}
  recent.forEach(task=>{
   const row=document.createElement("div");row.className="mission-recent-row";
   const detail=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("span");
   name.textContent=task.agent||"VEXT NEXUS";
   meta.textContent=(task.prompt||"NEXUS assignment").replace(/\s+/g," ").slice(0,105);
   detail.append(name,meta);
   const status=document.createElement("span");status.className="mission-recent-status"+(task.status==="Approved"?" approved":task.status==="Failed"?" failed":"");
   status.textContent=task.status||"Saved";row.append(detail,status);list.append(row);
  });
}
function renderDashboardOverview(leads,inv,code){
 const currencyInvoices=inv.filter(x=>x.currency===code);
 const paid=currencyInvoices.filter(x=>x.status==="Paid");
 const outstanding=currencyInvoices.filter(x=>x.status!=="Paid").reduce((sum,x)=>sum+Number(x.amount||0),0);
 const paidRate=currencyInvoices.length?Math.round(paid.length/currencyInvoices.length*100):0;
 $("dashboardSalesSnapshot").innerHTML=`
  <div class="snapshot-metrics">
   <div><span>Outstanding</span><strong>${formatMoney(outstanding,code)}</strong></div>
   <div><span>Payment rate</span><strong>${paidRate}%</strong></div>
  </div>
  <div class="snapshot-progress"><div><span style="width:${paidRate}%"></span></div></div>
  <div class="snapshot-foot"><span>${paid.length} paid</span><span>${currencyInvoices.length-paid.length} unpaid</span><span>Currency: ${esc(code)}</span></div>
  <p class="muted small snapshot-note">Invoice figures include only ${esc(code)} invoices to avoid mixing currencies.</p>`;
 const recent=[...leads].sort((a,b)=>new Date(b.created||0)-new Date(a.created||0)).slice(0,4);
 $("dashboardRecentClients").innerHTML=recent.length?recent.map(x=>`
  <div class="dashboard-client-row">
   <div class="dashboard-client-avatar">${esc((x.name||"?").trim().charAt(0).toUpperCase())}</div>
   <div class="dashboard-client-info"><strong>${esc(x.name||"Unnamed client")}</strong><span>${esc(x.interest||x.email||x.phone||"Client record")}</span></div>
   <span class="dashboard-client-date">${x.created?esc(new Date(x.created).toLocaleDateString()):"Saved"}</span>
  </div>`).join(""):'<div class="empty">Your new clients will appear here.</div>';
}
function render(){
 const leads=read("leads"),inv=read("invoices"),code=currentCurrency();
 if($("nexusTaskList"))renderNexus();
  renderMissionControl();
 $("statLeads").textContent=leads.length;
 $("statInvoices").textContent=inv.length;
 $("statPaid").textContent=inv.filter(x=>x.status==="Paid").length;
 const sameCurrency=inv.filter(x=>x.currency===code).reduce((s,x)=>s+Number(x.amount),0);
 $("statRevenue").textContent=formatMoney(sameCurrency,code);
 renderDashboardOverview(leads,inv,code);
 renderActivity();renderLeads();renderInvoices();renderAnalytics();
}

$("currency").value=read("currency","USD");
$("currency").addEventListener("change",()=>{
 write("currency",currentCurrency());render();
});
$("invCurrency").innerHTML=currencies.map(c=>`<option value="${c}">${c}</option>`).join("");
$("invCurrency").value=currentCurrency();
$("currency").addEventListener("change",()=>{$("invCurrency").value=currentCurrency()});
$("leadForm").addEventListener("submit",e=>{
 e.preventDefault();
 const leads=read("leads");
 leads.push({id:id(),name:$("leadName").value.trim(),
 email:$("leadEmail").value.trim(),phone:$("leadPhone").value.trim(),
 country:$("leadCountry").value.trim(),interest:$("leadInterest").value.trim(),
 created:new Date().toISOString()});
 write("leads",leads);e.target.reset();log("New client registered.");render();
});
$("leadSearch").addEventListener("input",renderLeads);
$("crmFollowupFilter").addEventListener("change",renderLeads);
$("enableCrmNotifications").addEventListener("click",async()=>{
 if(!("Notification" in window)){alert("This browser does not support desktop notifications.");return;}
 const permission=await Notification.requestPermission();
 if(permission==="granted"){localStorage.setItem("vext_crm_browser_alerts","true");renderCrmReminderAlerts(read("leads"));}
 else{localStorage.setItem("vext_crm_browser_alerts","false");alert("Browser alerts were not enabled. You can change this in your browser's site settings.");}
});
$("crmReminderFeed").addEventListener("click",e=>{
 const button=e.target.closest("[data-reminder-client]");if(!button)return;
 renderClientProfile(button.dataset.reminderClient);
 $("clientProfilePanel").scrollIntoView({behavior:"smooth",block:"start"});
});
$("leadTable").addEventListener("click",e=>{
 const open=e.target.closest("[data-open-client]");
 if(open){renderClientProfile(open.dataset.openClient);$("clientProfilePanel").scrollIntoView({behavior:"smooth",block:"start"});}
});
$("clientProfileContent").addEventListener("click",e=>{
 if(e.target.id==="closeClientProfile"){closeClientProfile();return}
 if(e.target.id!=="saveClientProfile")return;
 const all=read("leads"),client=all.find(x=>x.id===$("clientProfilePanel").dataset.clientId);if(!client)return;
 const previousStage=client.salesStage||client.enquiryHistory?.at(-1)?.salesStage||"New";
 const previousAction=String(client.nextAction||"").trim();
 const previousNotes=String(client.notes||"").trim();
 const previousFollowupDate=String(client.nextFollowUpDate||"").trim();
 const nextStage=$("clientSalesStage").value;
 const nextAction=$("clientNextAction").value.trim();
 const nextFollowupDate=$("clientFollowupDate").value;
 const nextNotes=$("clientNotes").value.trim();
 const savedAt=new Date().toISOString();
 client.activityLog=Array.isArray(client.activityLog)?client.activityLog:[];
 if(previousStage!==nextStage)client.activityLog.push({kind:"status",title:"Sales status changed",detail:previousStage+" → "+nextStage,at:savedAt,status:nextStage});
 if(previousAction!==nextAction)client.activityLog.push({kind:"followup",title:"Next follow-up action updated",detail:nextAction||"Follow-up action cleared",at:savedAt});
 if(previousNotes!==nextNotes)client.activityLog.push({kind:"note",title:"Internal note updated",detail:nextNotes||"Internal notes cleared",at:savedAt});
 if(previousFollowupDate!==nextFollowupDate)client.activityLog.push({kind:"followup-date",title:"Follow-up date updated",detail:nextFollowupDate?("Scheduled for "+nextFollowupDate):"Follow-up date cleared",at:savedAt});
 client.salesStage=nextStage;
 client.nextAction=nextAction;
 client.nextFollowUpDate=nextFollowupDate;
 client.notes=nextNotes;
 write("leads",all);log("Client profile updated for "+(client.name||"customer")+".");
 $("clientProfileStatus").textContent="Profile updates saved.";
 renderLeads();
});
$("leadTable").addEventListener("click",e=>{
 const b=e.target.closest("[data-delete-lead]");if(!b)return;
 if(!confirm("Delete this client?"))return;
 write("leads",read("leads").filter(x=>x.id!==b.dataset.deleteLead));
 log("Client record deleted.");render();
});
function getSupportSettings(){
 const defaults={business:localStorage.getItem(key+"business")||"Your Business",website:"",greeting:"Hello! Welcome. How can we help you today?",instructions:""};
 try{return {...defaults,...JSON.parse(localStorage.getItem(key+"support_settings")||"{}")}}
 catch{return defaults}
}
function getSupportBusinessId(){
 let value=localStorage.getItem(key+"support_business_id");
 if(!value){value=(crypto&&crypto.randomUUID)?crypto.randomUUID():"vext-"+Date.now()+"-"+Math.random().toString(36).slice(2);localStorage.setItem(key+"support_business_id",value);scheduleWorkspaceSync()}
 return value;
}
let supportBusinessId=getSupportBusinessId();
let cloudSupportLeads=[];
$("supportBusinessId").textContent=supportBusinessId;
function renderSupportChat(){
 const area=$("supportMessages");area.replaceChildren();
 const settings=getSupportSettings();
 const welcome=document.createElement("div");
 welcome.className="chat-message assistant";
 const role=document.createElement("span");role.className="chat-role";role.textContent=settings.business||"CUSTOMER SUPPORT";
 const body=document.createElement("div");body.textContent=settings.greeting||"Hello! How can we help?";
 welcome.append(role,body);area.append(welcome);
}
function buildSupportWidgetCode(){
 $("supportWidgetCode").value='<script src="https://rkabiitex-ctrl.github.io/ai-operations-engine/customer-widget.js" data-api-base="https://flat-star-50c3.rkabiitex.workers.dev" data-business-id="'+supportBusinessId+'" async><'+'/script>';
}
async function saveSupportSettings(){
 const settings={business:$("supportBusiness").value.trim()||"Your Business",
 website:$("supportWebsite").value.trim(),
 greeting:$("supportGreeting").value.trim()||"Hello! How can we help you today?",
 instructions:$("supportInstructions").value.trim()};
 localStorage.setItem(key+"support_settings",JSON.stringify(settings));
 scheduleWorkspaceSync();
 renderSupportChat();
 $("saveSupport").disabled=true;$("supportSaveStatus").textContent="Saving business configuration to Cloudflare...";
 try{
  const accessToken=await getVextAccessToken();
  const response=await fetch(VEXT_CHAT_ENDPOINT+"api/admin/business",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+accessToken},body:JSON.stringify({businessId:supportBusinessId,name:settings.business,website:settings.website,greeting:settings.greeting,instructions:settings.instructions})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("Cloud save failed ("+response.status+")"));
  buildSupportWidgetCode();
  $("supportSaveStatus").textContent="Business assistant saved to Cloudflare. Your website embed code is ready.";
 }catch(error){$("supportSaveStatus").textContent="Not saved to cloud: "+(error.message||"Check Worker and D1 setup.")+" Your settings are still saved in this browser."}
 finally{$("saveSupport").disabled=false}
}
const initialSupport=getSupportSettings();
$("supportBusiness").value=initialSupport.business;
$("supportWebsite").value=initialSupport.website||"";
$("supportGreeting").value=initialSupport.greeting;
$("supportInstructions").value=initialSupport.instructions;
window.vextActivateUserData=async function(user){
 if(!user||!user.id)return;
 if(vextWorkspaceUserId===user.id&&vextWorkspaceReady)return;
 if(vextWorkspaceUserId===user.id&&vextWorkspaceLoadPromise)return vextWorkspaceLoadPromise;
 vextWorkspaceUserId=user.id;
 vextWorkspaceReady=false;
 key="vext_user_"+user.id+"_";
 clearTimeout(vextWorkspaceSyncTimer);
 supportBusinessId=getSupportBusinessId();
 setWorkspaceSyncStatus("Loading your secure workspace…");
 vextWorkspaceLoadPromise=(async()=>{
  const accessToken=await getVextAccessToken();
  const response=await fetch(VEXT_CHAT_ENDPOINT+"api/admin/workspace",{
   headers:{"Authorization":"Bearer "+accessToken}
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("Workspace load failed ("+response.status+")"));
  const remote=data.workspace&&typeof data.workspace==="object"?data.workspace:{};
  const hasRemote=Object.keys(remote).length>0;
  if(hasRemote)applyWorkspaceSnapshot(remote);
  vextWorkspaceReady=true;
  $("currency").value=read("currency","USD");
  $("invCurrency").value=currentCurrency();
  $("businessName").value=localStorage.getItem(key+"business")||"VEXT AI";
  $("businessCountry").value=localStorage.getItem(key+"country")||"";
  const settings=getSupportSettings();
  $("supportBusiness").value=settings.business;
  $("supportWebsite").value=settings.website||"";
  $("supportGreeting").value=settings.greeting;
  $("supportInstructions").value=settings.instructions;
  supportBusinessId=getSupportBusinessId();
  $("supportBusinessId").textContent=supportBusinessId;
  $("supportWidgetCode").value="";
  renderChatHistory();renderSupportChat();render();
  if(typeof vextNotifications!=="undefined")vextNotifications.resetBaseline();
  if(!hasRemote)await syncWorkspaceNow();
  else setWorkspaceSyncStatus("Cloud synced");
 })();
 try{await vextWorkspaceLoadPromise}
 catch(error){
  vextWorkspaceReady=false;
  setWorkspaceSyncStatus("Saved locally · cloud connection needs attention",true);
  console.error("VEXT AI workspace load:",error);
 }
 finally{vextWorkspaceLoadPromise=null}
};
window.vextDeactivateUserData=function(){
 clearTimeout(vextWorkspaceSyncTimer);
 vextWorkspaceUserId=null;vextWorkspaceReady=false;vextWorkspaceLoadPromise=null;
 key="vext_guest_";
 setWorkspaceSyncStatus("Signed out");
};
$("saveSupport").addEventListener("click",saveSupportSettings);
$("copySupportWidget").addEventListener("click",async()=>{
 const value=$("supportWidgetCode").value;
 if(!value){$("supportSaveStatus").textContent="Save the assistant to cloud first to generate the website code.";return}
 try{await navigator.clipboard.writeText(value);$("supportSaveStatus").textContent="Website embed code copied."}
 catch{$("supportWidgetCode").focus();$("supportWidgetCode").select();$("supportSaveStatus").textContent="Code selected. Press Ctrl+C to copy."}
});
async function loadSupportCloudLeads(){
 const status=$("supportCloudStatus"),container=$("supportCloudLeadTable");
 status.textContent="Loading cloud enquiries...";
 try{
  const accessToken=await getVextAccessToken();
  const response=await fetch(VEXT_CHAT_ENDPOINT+"api/admin/leads?businessId="+encodeURIComponent(supportBusinessId),{headers:{"Authorization":"Bearer "+accessToken}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")"));
  cloudSupportLeads=Array.isArray(data.leads)?data.leads:[];
  container.replaceChildren();
  if(!cloudSupportLeads.length){container.textContent="No website enquiries have arrived yet.";status.textContent="Cloud inbox checked.";return}
  const table=document.createElement("table");
  const head=document.createElement("thead"),hr=document.createElement("tr");
  ["Customer","Contact","Enquiry","Received","Buying signal","Sales stage","Next action"].forEach(label=>{const th=document.createElement("th");th.textContent=label;hr.append(th)});
  head.append(hr);table.append(head);
  const body=document.createElement("tbody");
  cloudSupportLeads.forEach(lead=>{
   const tr=document.createElement("tr");
   [lead.customer_name,[lead.email,lead.phone].filter(Boolean).join(" · "),lead.message,new Date(lead.created_at).toLocaleString()].forEach(value=>{const td=document.createElement("td");td.textContent=value||"—";tr.append(td)});
   const signalCell=document.createElement("td");
   const intentLabel=lead.intent&&lead.intent!=="unknown"?lead.intent.charAt(0).toUpperCase()+lead.intent.slice(1):"Not assessed";
   signalCell.textContent=intentLabel+" · "+(Number(lead.lead_score)||0)+"/5";
   tr.append(signalCell);
   const stageCell=document.createElement("td");
   const stage=document.createElement("select");
   [["new","New"],["qualified","Qualified"],["contacted","Contacted"],["proposal","Proposal"],["won","Won"],["lost","Lost"]].forEach(([value,label])=>{const option=document.createElement("option");option.value=value;option.textContent=label;stage.append(option)});
   stage.value=lead.status||"new";stageCell.append(stage);tr.append(stageCell);
   const actionCell=document.createElement("td");
   const action=document.createElement("input");action.type="text";action.maxLength=500;action.placeholder="e.g. Call tomorrow";action.value=lead.next_action||"";action.style.minWidth="150px";
   const save=document.createElement("button");save.type="button";save.className="secondary";save.textContent="Save";
   save.addEventListener("click",async()=>{
    save.disabled=true;save.textContent="Saving...";
    try{
     const accessToken=await getVextAccessToken();
     const response=await fetch(VEXT_CHAT_ENDPOINT+"api/admin/leads",{method:"PATCH",headers:{"Content-Type":"application/json","Authorization":"Bearer "+accessToken},body:JSON.stringify({businessId:supportBusinessId,leadId:lead.id,status:stage.value,nextAction:action.value.trim()})});
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(result.error||"Could not update this lead.");
     lead.status=stage.value;lead.next_action=action.value.trim();
     status.textContent="Sales stage and next action saved.";
    }catch(error){status.textContent="Could not save lead: "+(error.message||"Please try again.");}
    finally{save.disabled=false;save.textContent="Save";}
   });
   actionCell.append(action,document.createTextNode(" "),save);tr.append(actionCell);
   body.append(tr);
  });
  table.append(body);const wrap=document.createElement("div");wrap.className="table-wrap";wrap.append(table);container.append(wrap);
  status.textContent=cloudSupportLeads.length+" sales opportunities loaded.";
 }catch(error){status.textContent="Could not load cloud enquiries: "+(error.message||"Check your Worker, D1 binding and admin token.")}
}
$("loadSupportLeads").addEventListener("click",loadSupportCloudLeads);
$("importSupportLeads").addEventListener("click",()=>{
 if(!cloudSupportLeads.length){$("supportCloudStatus").textContent="Load cloud enquiries first.";return}
 const leads=read("leads");
 const emailOf=x=>String(x.email||"").trim().toLowerCase();
 const phoneOf=x=>String(x.phone||"").replace(/\D/g,"");
 const sameCustomer=(a,b)=>{
  const ae=emailOf(a),be=emailOf(b),ap=phoneOf(a),bp=phoneOf(b);
  return (!!ae&&!!be&&ae===be)||(!!ap&&!!bp&&ap===bp);
 };
 const uniqueHistory=entries=>{
  const seen=new Set();
  return entries.filter(entry=>{
   const key=entry.cloudLeadId?"id:"+entry.cloudLeadId:"fallback:"+String(entry.receivedAt||"")+"|"+String(entry.message||"").trim().toLowerCase();
   if(seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>new Date(a.receivedAt||0)-new Date(b.receivedAt||0));
 };
 // Consolidate older duplicate client records without discarding notes or enquiry history.
 let merged=0;
 for(let i=0;i<leads.length;i++){
  for(let j=i+1;j<leads.length;){
   if(!sameCustomer(leads[i],leads[j])){j++;continue}
   const keep=leads[i],duplicate=leads[j];
   ["name","email","phone","country","interest","source","created","salesStage","nextAction"].forEach(field=>{
    if(!keep[field]&&duplicate[field])keep[field]=duplicate[field];
   });
   keep.notes=[...new Set([String(keep.notes||"").trim(),String(duplicate.notes||"").trim()].filter(Boolean))].join("\n\n");
   keep.enquiryHistory=uniqueHistory([...(Array.isArray(keep.enquiryHistory)?keep.enquiryHistory:[]),...(Array.isArray(duplicate.enquiryHistory)?duplicate.enquiryHistory:[])]);
   leads.splice(j,1);merged++;
  }
 }
 let created=0,updated=0,alreadyLinked=0,linked=0;
 // Oldest first so the newest enquiry is the final history item.
 [...cloudSupportLeads].sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0)).forEach(item=>{
  const email=String(item.email||"").trim().toLowerCase();
  const phone=String(item.phone||"").replace(/\D/g,"");
  let client=leads.find(existing=>sameCustomer(existing,{email,phone}));
  if(!client){
   client={id:id(),name:item.customer_name||"Website customer",email:item.email||"",phone:item.phone||"",country:"",interest:item.message||"Website enquiry",source:"VEXT AI Website Widget",created:item.created_at||new Date().toISOString(),enquiryHistory:[]};
   leads.push(client);created++;
  }else{
   updated++;
   if(!client.email&&item.email)client.email=item.email;
   if(!client.phone&&item.phone)client.phone=item.phone;
   if(!client.name&&item.customer_name)client.name=item.customer_name;
   if(!client.interest)client.interest=item.message||"Website enquiry";
   if(!client.source)client.source="VEXT AI Website Widget";
   if(!client.created)client.created=item.created_at||new Date().toISOString();
  }
  if(!Array.isArray(client.enquiryHistory))client.enquiryHistory=[];
  if(item.id&&client.enquiryHistory.some(entry=>entry.cloudLeadId===item.id)){alreadyLinked++;return}
  client.enquiryHistory.push({
   cloudLeadId:item.id||"",message:item.message||"Website enquiry",
   receivedAt:item.created_at||new Date().toISOString(),intent:item.intent||"unknown",
   leadScore:Number(item.lead_score)||0,salesStage:item.status||"new",
   nextAction:item.next_action||"",consent:true
  });
  linked++;
 });
 // Keep all historical enquiries, remove duplicates, and show the newest stage when no team stage exists.
 leads.forEach(client=>{
  client.enquiryHistory=uniqueHistory(Array.isArray(client.enquiryHistory)?client.enquiryHistory:[]);
  const latest=client.enquiryHistory[client.enquiryHistory.length-1];
  if(latest?.salesStage)client.salesStage=latest.salesStage.charAt(0).toUpperCase()+latest.salesStage.slice(1);
  if(!client.nextAction&&latest?.nextAction)client.nextAction=latest.nextAction;
 });
 write("leads",leads);
 log(created+" new clients created; "+updated+" existing enquiries grouped; "+merged+" duplicate client records consolidated.");
 render();
 $("supportCloudStatus").textContent=merged+" duplicate client records consolidated; "+created+" new clients created; "+linked+" enquiries added; "+alreadyLinked+" already-linked enquiries skipped. All enquiry history and internal notes were preserved.";
});
renderSupportChat();
$("supportLeadForm").addEventListener("submit",e=>{
 e.preventDefault();
 const email=$("supportLeadEmail").value.trim(),phone=$("supportLeadPhone").value.trim();
 if(!email&&!phone){alert("Please enter an email address or phone number so the business can follow up.");return}
 if(!$("supportLeadConsent").checked){alert("Please confirm the customer agreed to be contacted.");return}
 const leads=read("leads");
 leads.push({id:id(),name:$("supportLeadName").value.trim(),email,phone,
 country:"",interest:$("supportLeadNeed").value.trim()||"Customer support enquiry",
 source:"Customer Support Agent",created:new Date().toISOString()});
 write("leads",leads);e.target.reset();log("New client registered by support test form.");render();
 $("supportStatus").textContent="Test enquiry saved locally to Client Management.";
});
$("sendCloudTestLead").addEventListener("click",async()=>{
 const name=$("supportLeadName").value.trim();
 const email=$("supportLeadEmail").value.trim();
 const phone=$("supportLeadPhone").value.trim();
 const message=$("supportLeadNeed").value.trim();
 const consent=$("supportLeadConsent").checked;
 const status=$("cloudTestLeadStatus");
 if(!name){status.textContent="Enter the test customer's name first.";return}
 if(!email&&!phone){status.textContent="Enter an email address or phone number.";return}
 if(!consent){status.textContent="Tick the consent box before sending this test enquiry.";return}
 const button=$("sendCloudTestLead");
 button.disabled=true;button.textContent="Sending...";
 status.textContent="Sending test enquiry securely to Cloudflare...";
 try{
  const response=await fetch(VEXT_CHAT_ENDPOINT+"api/public/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId:supportBusinessId,name,email,phone,message,consent:true})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")"));
  status.textContent="Success! Test enquiry saved in Cloudflare. Now click Load cloud enquiries above to verify the email and phone.";
 }catch(error){status.textContent="Cloud test failed: "+(error.message||"Please check the Worker and database setup.") }
 finally{button.disabled=false;button.textContent="Send test enquiry to cloud"}
});
async function askSupportAssistant(){
 const input=$("supportInput"),button=$("supportSend"),status=$("supportStatus");
 const question=input.value.trim();if(!question)return;
 const settings=getSupportSettings();
 const area=$("supportMessages");
 const add=(who,msg)=>{
  const bubble=document.createElement("div");bubble.className="chat-message "+(who==="YOU"?"user":"assistant");
  const label=document.createElement("span");label.className="chat-role";label.textContent=who;
  const content=document.createElement("div");content.textContent=msg;bubble.append(label,content);area.append(bubble);area.scrollTop=area.scrollHeight;
 };
 add("YOU",question);input.value="";button.disabled=true;button.textContent="Thinking...";
 status.textContent="Preparing a customer support response...";
 const prompt="You are the customer support assistant for "+settings.business+". Answer politely, accurately and concisely. Use only the business information supplied below. If information is missing, say you will ask a human team member to confirm; never invent prices, policies, availability or promises. Do not request passwords or payment card details. Business information: "+(settings.instructions||"No business details have been supplied yet.")+" Customer question: "+question;
 try{
  const accessToken=await getVextAccessToken();
  const response=await fetch(VEXT_CHAT_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+accessToken},body:JSON.stringify({message:prompt})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")"));
  const reply=typeof data.reply==="string"?data.reply:"";
  if(!reply)throw new Error("The AI service returned an empty response.");
  add("ASSISTANT",reply);status.textContent="Response received. Confirm the information before launch.";
 }catch(error){add("ASSISTANT","I couldn't reach the AI service. "+(error.message||"Please try again."));status.textContent="Connection problem. Check the AI backend."}
 finally{button.disabled=false;button.textContent="Ask assistant";input.focus()}
}
$("supportSend").addEventListener("click",askSupportAssistant);
$("supportInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();askSupportAssistant()}});

let generated="";
$("makeDoc").addEventListener("click",()=>{
 const prompt=$("docPrompt").value.trim();
 if(!prompt){alert("Describe your document first.");return}
 const business=localStorage.getItem(key+"business")||"VEXT AI";
 const type=$("docType").value;
 generated=`${business.toUpperCase()}\n${type.toUpperCase()}\n${"=".repeat(48)}\nDate: ${new Date().toLocaleString()}\n\nREQUEST\n${prompt}\n\nOBJECTIVE\nDefine the intended outcome and measurable business goals.\n\nPROPOSED ACTIONS\n1. Review the requirements and scope.\n2. Identify responsibilities and resources.\n3. Establish a realistic timeline.\n4. Review and approve the final deliverables.\n\nNEXT STEPS\nConfirm the requirements, budget, deadlines and responsible parties before treating this draft as a formal agreement.\n\nPrepared with VEXT AI Document Studio.\n`;
 $("docOutput").textContent=generated;
 $("docOutput").hidden=false;$("copyDoc").hidden=false;$("downloadDoc").hidden=false;
 log(type+" draft generated.");
});
$("copyDoc").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText(generated);alert("Copied!")}
 catch{alert("Select the text and copy it manually.")}
});
function download(content,name,type="text/plain"){
 const url=URL.createObjectURL(new Blob([content],{type}));
 const a=document.createElement("a");a.href=url;a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("downloadDoc").addEventListener("click",()=>download(generated,"VEXT-AI-document.txt"));
function loadBusinessSettings(){
 $("businessName").value=localStorage.getItem(key+"business")||"VEXT AI";
 $("businessCountry").value=localStorage.getItem(key+"country")||"";
 $("businessIndustry").value=localStorage.getItem(key+"industry")||"";
 $("businessWebsite").value=localStorage.getItem(key+"business_website")||"";
 $("businessTimezone").value=localStorage.getItem(key+"timezone")||"Africa/Kampala";
 $("businessLanguage").value=localStorage.getItem(key+"language")||"en";
}
loadBusinessSettings();
$("saveSettings").addEventListener("click",()=>{
 const name=$("businessName").value.trim(),country=$("businessCountry").value.trim();
 const website=$("businessWebsite").value.trim();
 if(!name){$("settingsSaveStatus").textContent="Enter your business name before saving.";return}
 if(website&&!/^https?:\/\//i.test(website)){$("settingsSaveStatus").textContent="Enter a full website address beginning with https://";return}
 localStorage.setItem(key+"business",name);
 localStorage.setItem(key+"country",country);
 localStorage.setItem(key+"industry",$("businessIndustry").value);
 localStorage.setItem(key+"business_website",website);
 scheduleWorkspaceSync();
 log("Business profile settings saved.");
 $("settingsSaveStatus").textContent="Business profile saved. Cloud sync has been requested for your business name and country.";
});
$("saveRegionalSettings").addEventListener("click",()=>{
 localStorage.setItem(key+"timezone",$("businessTimezone").value);
 localStorage.setItem(key+"language",$("businessLanguage").value);
 $("regionalSaveStatus").textContent="Regional preferences saved on this device.";
 log("Regional preferences updated.");
});
$("exportData").addEventListener("click",()=>{
 download(JSON.stringify({leads:read("leads"),invoices:read("invoices"),
 logs:read("logs"),business:localStorage.getItem(key+"business"),
 currency:currentCurrency()},null,2),"vext-ai-backup.json","application/json");
});
$("exportCSV").addEventListener("click",()=>{
 const rows=[["Name","Email","Phone","Country","Interest"],...read("leads").map(x=>[x.name,x.email,x.phone,x.country,x.interest])];
 const csv=rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");
 download(csv,"vext-ai-clients.csv","text/csv");
});
$("year").textContent=new Date().getFullYear();
render();
