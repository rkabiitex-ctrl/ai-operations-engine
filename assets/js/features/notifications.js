(function(){
"use strict";
window.VEXTNotifications={
 init({$,read,write,navigate}){
  const state={taskSnapshot:new Map(),leadSnapshot:new Set(),initialized:false,timer:null};
  const safeArray=value=>Array.isArray(value)?value:[];
  const makeId=()=> "ntf_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
  const all=()=>safeArray(read("notifications",[]));
  const save=items=>write("notifications",items.slice(0,150));
  function add(type,title,message,sourceId){
   const items=all();
   if(sourceId&&items.some(x=>x.sourceId===sourceId&&x.type===type))return;
   items.unshift({id:makeId(),type,title,message,sourceId:sourceId||"",createdAt:new Date().toISOString(),read:false});
   save(items);renderBell();
  }
  function renderBell(){
   const unread=all().filter(x=>!x.read).length;
   const count=$("notificationCount");
   if(count){count.textContent=unread>99?"99+":String(unread);count.hidden=unread===0;}
   const bell=$("notificationBell");
   if(bell){bell.setAttribute("aria-label",unread+" unread notifications");bell.classList.toggle("has-unread",unread>0);}
  }
  function render(){
   const list=$("notificationList");if(!list)return;
   const items=all().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
   $("notificationTotal").textContent=items.length+" total";
   $("notificationUnread").textContent=items.filter(x=>!x.read).length+" unread";
   list.replaceChildren();
   if(!items.length){const empty=document.createElement("div");empty.className="notification-empty";empty.textContent="You're all caught up. New workspace activity will appear here.";list.append(empty);renderBell();return;}
   items.forEach(item=>{
    const row=document.createElement("article");row.className="notification-item"+(item.read?" is-read":"");
    const icon=document.createElement("span");icon.className="notification-icon "+(item.type==="lead"?"lead":item.type==="failed"?"failed":item.type==="approval"?"approval":"nexus");icon.textContent=item.type==="lead"?"◎":item.type==="failed"?"!":item.type==="approval"?"◷":"✧";
    const body=document.createElement("div");body.className="notification-body";
    const heading=document.createElement("strong");heading.textContent=item.title;
    const message=document.createElement("p");message.textContent=item.message;
    const meta=document.createElement("small");meta.textContent=new Date(item.createdAt).toLocaleString();
    body.append(heading,message,meta);
    const actions=document.createElement("div");actions.className="notification-item-actions";
    if(!item.read){const mark=document.createElement("button");mark.type="button";mark.textContent="Mark read";mark.dataset.markNotification=item.id;actions.append(mark);}
    row.append(icon,body,actions);list.append(row);
   });
   renderBell();
  }
  function snapshot(){
   const tasks=safeArray(read("nexus_tasks",[])),leads=safeArray(read("leads",[]));
   state.taskSnapshot=new Map(tasks.filter(x=>x&&x.id).map(x=>[String(x.id),x.status||"Saved"]));
   state.leadSnapshot=new Set(leads.filter(x=>x&&x.id).map(x=>String(x.id)));
   state.initialized=true;
  }
  function scan(){
   if(!state.initialized){snapshot();return;}
   const tasks=safeArray(read("nexus_tasks",[])),leads=safeArray(read("leads",[]));
   tasks.forEach(task=>{
    if(!task||!task.id)return;
    const id=String(task.id),status=task.status||"Saved",previous=state.taskSnapshot.get(id);
    if(previous===undefined){
     add("nexus","New NEXUS assignment",(task.agent||"A specialist")+" has a new assignment.", "task-new:"+id);
    }else if(previous!==status){
     const type=status==="Awaiting review"?"approval":status==="Failed"?"failed":"nexus";
     add(type,status==="Awaiting review"?"NEXUS draft ready for review":status==="Failed"?"NEXUS task failed":"NEXUS task updated",(task.agent||"A specialist")+" · "+status, "task-status:"+id+":"+status);
    }
   });
   leads.forEach(lead=>{
    if(!lead||!lead.id)return;
    const id=String(lead.id);
    if(!state.leadSnapshot.has(id))add("lead","New client enquiry",(lead.name||"A new client")+" was added to Client Management.","lead:"+id);
   });
   snapshot();
  }
  function markAllRead(){save(all().map(x=>({...x,read:true})));render();}
  function clearAll(){save([]);render();}
  const list=$("notificationList");
  if(list)list.addEventListener("click",event=>{
   const button=event.target.closest("[data-mark-notification]");if(!button)return;
   const id=button.dataset.markNotification;save(all().map(x=>x.id===id?{...x,read:true}:x));render();
  });
  $("notificationMarkAll").addEventListener("click",markAllRead);
  $("notificationClearAll").addEventListener("click",clearAll);
  $("notificationBell").addEventListener("click",()=>navigate("notifications"));
  window.addEventListener("storage",scan);
  snapshot();renderBell();
  state.timer=window.setInterval(scan,7000);
  return {render,resetBaseline:snapshot,scan};
 }
};
})();