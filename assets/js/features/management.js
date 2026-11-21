"use strict";
window.VEXTManagement = (() => {
 function init({ $, read, write, id, log }) {
  function renderManagementActions(){
   const list=$("managementActionList");if(!list)return;
   const actions=read("management_actions",[]);
   const count=status=>actions.filter(x=>(x.status||"Pending")===status).length;
   $("actionTotal").textContent=actions.length;$("actionPending").textContent=count("Pending");$("actionProgress").textContent=count("In Progress");$("actionCompleted").textContent=count("Completed");$("actionRegisterCount").textContent=actions.length+" actions";
   list.replaceChildren();
   if(!actions.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="No actions yet. Add the first management priority above.";list.append(empty);return;}
   actions.forEach(action=>{
    const card=document.createElement("article");card.className="management-action-item"+(action.status==="Completed"?" is-complete":"");card.dataset.managementAction=action.id;
    const fields=document.createElement("div");fields.className="management-action-fields";
    const addField=(label,name,value,type,options)=>{const wrap=document.createElement("div"),lab=document.createElement("label"),input=document.createElement(type==="select"?"select":"input");lab.textContent=label;lab.htmlFor="action-"+action.id+"-"+name;input.id=lab.htmlFor;input.dataset.field=name;input.setAttribute("aria-label",label);if(type==="select"){options.forEach(option=>{const o=document.createElement("option");o.value=option;o.textContent=option;input.append(o)});input.value=value||options[0]}else{input.type=type;input.value=value||"";if(name==="title")input.maxLength=180;if(name==="owner")input.maxLength=80;if(name==="owner")input.placeholder="Assign owner"}wrap.append(lab,input);fields.append(wrap)};
    addField("Action","title",action.title,"text");addField("Owner","owner",action.owner,"text");addField("Priority","priority",action.priority,"select",["High","Medium","Low"]);addField("Due date","dueDate",action.dueDate,"date");addField("Status","status",action.status,"select",["Pending","In Progress","Completed"]);
    const controls=document.createElement("div");controls.className="management-action-controls";const stamp=document.createElement("small");stamp.textContent="Created "+(action.createdAt?new Date(action.createdAt).toLocaleDateString():"");const buttons=document.createElement("div");buttons.className="action-row";
    const save=document.createElement("button");save.type="button";save.className="secondary";save.dataset.saveAction="";save.textContent="Save changes";
    const del=document.createElement("button");del.type="button";del.className="danger";del.dataset.deleteAction="";del.textContent="Delete";
    buttons.append(save,del);controls.append(stamp,buttons);card.append(fields,controls);list.append(card);
   });
  }
  $("managementActionForm").addEventListener("submit",event=>{
   event.preventDefault();const title=$("newActionTitle").value.trim();if(!title)return;
   const actions=read("management_actions",[]);actions.unshift({id:id(),title,owner:$("newActionOwner").value.trim(),priority:$("newActionPriority").value,status:"Pending",dueDate:$("newActionDue").value,createdAt:new Date().toISOString()});write("management_actions",actions);event.target.reset();$("newActionPriority").value="Medium";renderManagementActions();$("managementActionStatus").textContent="Action added and saved to your VEXT workspace.";log("Management action added: "+title);
  });
  $("managementActionList").addEventListener("click",event=>{
   const card=event.target.closest("[data-management-action]");if(!card)return;const actionId=card.dataset.managementAction;
   if(event.target.closest("[data-save-action]")){const actions=read("management_actions",[]),action=actions.find(x=>x.id===actionId);if(!action)return;const val=name=>card.querySelector('[data-field="'+name+'"]').value.trim();const title=val("title");if(!title){$("managementActionStatus").textContent="An action description is required.";return;}action.title=title;action.owner=val("owner");action.priority=val("priority");action.dueDate=val("dueDate");action.status=val("status");action.updatedAt=new Date().toISOString();write("management_actions",actions);renderManagementActions();$("managementActionStatus").textContent="Action updated and synced with your workspace.";log("Management action updated: "+title);return;}
   if(event.target.closest("[data-delete-action]")){if(!confirm("Delete this management action?"))return;write("management_actions",read("management_actions",[]).filter(x=>x.id!==actionId));renderManagementActions();$("managementActionStatus").textContent="Action deleted.";log("Management action deleted.");}
  });
  return renderManagementActions;
 }
 return { init };
})();
