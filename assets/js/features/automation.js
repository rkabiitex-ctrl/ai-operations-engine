"use strict";
window.VEXTAutomation=(()=>{
 function init({$,read,writeAndSync,id,log}){
  const settings=()=>{const v=read("automation_settings",{});return v&&typeof v==="object"?v:{}};
  const runs=()=>{const v=read("automation_runs",[]);return Array.isArray(v)?v:[]};
  const defaults=()=>({newLeadFollowup:false,workflowEnabled:false,condition:"any",steps:["create_task","log_activity"],requireApproval:true,maxRetries:2});
  const config=()=>({...defaults(),...settings()});
  const safeText=(v,max=140)=>String(v||"").replace(/[<>]/g,"").trim().slice(0,max);
  const persist=async(k,v)=>{const ok=await writeAndSync(k,v);if(!ok)console.warn("VEXT automation is saved locally; cloud sync needs attention.");return ok;};
  function render(){
   const c=config(),history=runs(),enabled=!!(c.workflowEnabled||c.newLeadFollowup);
   $("automationNewLeadEnabled").checked=enabled;$("automationRequireApproval").checked=c.requireApproval!==false;
   $("automationCondition").value=["any","has_interest","high_value"].includes(c.condition)?c.condition:"any";
   $("automationStepTask").checked=Array.isArray(c.steps)?c.steps.includes("create_task"):true;
   $("automationStepLog").checked=Array.isArray(c.steps)?c.steps.includes("log_activity"):true;
   $("automationRetryCount").value=String(Math.min(2,Math.max(0,Number(c.maxRetries)||0)));
   $("automationActiveCount").textContent=enabled?"1":"0";$("automationRunCount").textContent=history.filter(x=>x.status==="completed").length;
   $("automationRuleStatus").textContent=enabled?"ACTIVE":"OFF";$("automationRuleStatus").classList.toggle("is-active",enabled);
   $("automationSaveStatus").textContent=enabled?"Workflow is enabled. New clients will be evaluated.":"Workflow is off.";
   const list=$("automationRunList");list.replaceChildren();
   if(!history.length){const empty=document.createElement("div");empty.className="automation-empty";empty.textContent="No automation runs yet.";list.append(empty);return;}
   history.slice(0,20).forEach(run=>{
    const row=document.createElement("article");row.className="automation-run-row";
    const detail=document.createElement("div"),title=document.createElement("strong"),meta=document.createElement("small");
    title.textContent=safeText(run.clientName||"Workflow")+" · "+safeText(run.status||"unknown");
    meta.textContent=(run.createdAt?new Date(run.createdAt).toLocaleString():"Saved run")+" · "+(run.attempts||0)+" attempt(s)"+(run.error?" · "+safeText(run.error,180):"");
    detail.append(title,meta);row.append(detail);
    if(run.status==="awaiting_approval"){const approve=document.createElement("button");approve.type="button";approve.className="secondary";approve.dataset.automationApprove=run.id;approve.textContent="Approve & run";row.append(approve);}
    list.append(row);
   });
  }
  async function saveConfig(){
   const steps=[];if($("automationStepTask").checked)steps.push("create_task");if($("automationStepLog").checked)steps.push("log_activity");
   const c={...config(),workflowEnabled:$("automationNewLeadEnabled").checked,newLeadFollowup:$("automationNewLeadEnabled").checked,condition:$("automationCondition").value,steps,requireApproval:$("automationRequireApproval").checked,maxRetries:Math.min(2,Math.max(0,Number($("automationRetryCount").value)||0)),updatedAt:new Date().toISOString()};
   await persist("automation_settings",c);render();$("automationSaveStatus").textContent=c.workflowEnabled?"Workflow saved. New client events will follow these rules.":"Workflow saved and switched off.";
  }
  $("automationSaveRule").addEventListener("click",async()=>{const b=$("automationSaveRule");b.disabled=true;b.textContent="Saving…";try{await saveConfig();}catch(e){$("automationSaveStatus").textContent="Could not save: "+safeText(e.message,160);}finally{b.disabled=false;b.textContent="Save workflow";}});
  function matchesCondition(lead,c){if(c.condition==="has_interest")return !!safeText(lead.interest,300);if(c.condition==="high_value")return ["high value","partner"].includes(String(lead.segment||"").toLowerCase())||String(lead.salesStage||"").toLowerCase()==="qualified";return true;}
  async function executeRun(run){
   const c=config(),history=runs(),current=history.find(x=>x.id===run.id);if(!current||current.status==="completed")return;
   current.status="running";current.error="";current.updatedAt=new Date().toISOString();await persist("automation_runs",history);
   const maxRetries=Math.min(2,Math.max(0,Number(c.maxRetries)||0));
   for(let attempt=1;attempt<=maxRetries+1;attempt++){
    try{
     const actions=read("management_actions",[]),logs=read("logs",[]);
     if(Array.isArray(run.steps)&&run.steps.includes("create_task")&&!actions.some(x=>x.sourceAutomationRunId===run.id)){
      actions.unshift({id:id(),title:"Follow up with "+safeText(run.clientName||"new client",90),owner:"",priority:"Medium",status:"Pending",dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),createdAt:new Date().toISOString(),automationSource:"advanced-workflow",sourceLeadId:run.leadId,sourceAutomationRunId:run.id});
      await persist("management_actions",actions);
     }
     if(Array.isArray(run.steps)&&run.steps.includes("log_activity")&&!logs.some(x=>x.sourceAutomationRunId===run.id)){
      logs.unshift({message:"Automation workflow processed new client "+safeText(run.clientName||"record",90)+".",time:new Date().toLocaleString(),sourceAutomationRunId:run.id});await persist("logs",logs.slice(0,100));
     }
     const latest=runs(),saved=latest.find(x=>x.id===run.id);if(saved){saved.status="completed";saved.attempts=attempt;saved.completedAt=new Date().toISOString();saved.error="";await persist("automation_runs",latest);}
     log("VEXT workflow completed for "+safeText(run.clientName||"new client",90)+".");render();return;
    }catch(error){
     const latest=runs(),saved=latest.find(x=>x.id===run.id);if(saved){saved.attempts=attempt;saved.error=safeText(error.message||"Step failed",180);saved.status=attempt<=maxRetries?"retrying":"failed";await persist("automation_runs",latest);}
     if(attempt>maxRetries){render();return;}
    }
   }
  }
  async function handleNewLead(lead){
   const c=config();if(!(c.workflowEnabled||c.newLeadFollowup)||!lead?.id||!matchesCondition(lead,c))return;
   if(runs().some(run=>run.leadId===lead.id))return;
   const steps=Array.isArray(c.steps)?c.steps:[];if(!steps.length)return;
   const run={id:id(),leadId:lead.id,clientName:safeText(lead.name||"New client",100),createdAt:new Date().toISOString(),status:c.requireApproval===false?"queued":"awaiting_approval",attempts:0,steps:steps.slice(0,2),error:""};
   await persist("automation_runs",[run,...runs()].slice(0,100));
   if(c.requireApproval===false)await executeRun(run);else{log("VEXT workflow is waiting for approval before running.");render();}
  }
  $("automationRunList").addEventListener("click",async event=>{const b=event.target.closest("[data-automation-approve]");if(!b)return;const run=runs().find(x=>x.id===b.dataset.automationApprove);if(!run||run.status!=="awaiting_approval")return;b.disabled=true;b.textContent="Running…";await executeRun(run);});
  render();return {render,handleNewLead};
 }
 return {init};
})();