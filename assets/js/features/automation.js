"use strict";
window.VEXTAutomation=(()=>{
 function init({$,read,write,writeAndSync,id,log}){
  const settings=()=>read("automation_settings",{});
  const runs=()=>read("automation_runs",[]);
  function render(){
   const config=settings(),history=runs();
   $("automationNewLeadEnabled").checked=!!config.newLeadFollowup;
   $("automationActiveCount").textContent=config.newLeadFollowup?"1":"0";
   $("automationRunCount").textContent=history.length;
   $("automationRuleStatus").textContent=config.newLeadFollowup?"ACTIVE":"OFF";
   $("automationRuleStatus").classList.toggle("is-active",!!config.newLeadFollowup);
   $("automationSaveStatus").textContent=config.newLeadFollowup?"Rule is active. New clients will create follow-up tasks.":"This rule is currently off.";
   const list=$("automationRunList");list.replaceChildren();
   if(!history.length){const empty=document.createElement("div");empty.className="automation-empty";empty.textContent="No automation runs yet.";list.append(empty);return;}
   history.slice(0,12).forEach(run=>{const row=document.createElement("article");row.className="automation-run-row";const title=document.createElement("strong");title.textContent=run.clientName+" · Follow-up created";const meta=document.createElement("small");meta.textContent=new Date(run.createdAt).toLocaleString()+" · "+run.status;row.append(title,meta);list.append(row)});
  }
  $("automationSaveRule").addEventListener("click",async()=>{
   const button=$("automationSaveRule");button.disabled=true;button.textContent="Saving…";
   try{const config={...settings(),newLeadFollowup:$("automationNewLeadEnabled").checked,updatedAt:new Date().toISOString()};const saved=await writeAndSync("automation_settings",config);render();$("automationSaveStatus").textContent=saved?"Automation saved to your cloud workspace.":"Saved on this device; cloud sync needs attention."}
   finally{button.disabled=false;button.textContent="Save automation"}
  });
  async function handleNewLead(lead){
   if(!settings().newLeadFollowup||!lead?.id)return;
   if(runs().some(run=>run.leadId===lead.id))return;
   const actions=read("management_actions",[]);
   const action={id:id(),title:"Follow up with "+(lead.name||"new client"),owner:"",priority:"Medium",status:"Pending",dueDate:new Date(Date.now()+86400000).toISOString().slice(0,10),createdAt:new Date().toISOString(),automationSource:"new-client-followup",sourceLeadId:lead.id};
   actions.unshift(action);
   const history=[{id:id(),leadId:lead.id,clientName:lead.name||"New client",actionId:action.id,createdAt:new Date().toISOString(),status:"Follow-up task created"},...runs()].slice(0,100);
   const actionsSaved=await writeAndSync("management_actions",actions);
   const runsSaved=await writeAndSync("automation_runs",history);
   log("Automation created a client follow-up task for "+(lead.name||"new client")+".");
   if(!actionsSaved||!runsSaved)console.warn("VEXT automation ran locally; cloud sync needs attention.");
   render();
  }
  render();
  return {render,handleNewLead};
 }
 return {init};
})();
