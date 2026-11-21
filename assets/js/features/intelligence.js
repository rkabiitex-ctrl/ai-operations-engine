(function(){
"use strict";
window.VEXTIntelligence={
 init({$,read,currentCurrency,formatMoney,navigate}){
  const el=id=>$(id);
  const array=value=>Array.isArray(value)?value:[];
  const dateValue=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?null:d;};
  const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;};
  function metric(label,value,note,icon){
   const card=make("article","intel-metric");const top=make("div","intel-metric-top");top.append(make("span","intel-metric-icon",icon),make("span","intel-metric-label",label));card.append(top,make("strong","",value),make("small","",note));return card;
  }
  function signal(title,description,priority,action,page){
   const item=make("article","intel-signal");const copy=make("div","intel-signal-copy");copy.append(make("strong","",title),make("p","",description));const side=make("div","intel-signal-side");side.append(make("span","intel-priority "+priority.toLowerCase(),priority));const button=make("button","secondary","Review →");button.type="button";button.addEventListener("click",()=>navigate(page));side.append(button);item.append(copy,side);return item;
  }
  function render(){
   const currency=currentCurrency(),invoices=array(read("invoices",[])),clients=array(read("leads",[])),tasks=array(read("nexus_tasks",[]));
   const relevant=invoices.filter(x=>String(x.currency||"")===currency);
   const invoiced=relevant.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   const paid=relevant.filter(x=>x.status==="Paid");
   const collected=paid.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
   const unpaid=relevant.filter(x=>x.status!=="Paid");
   const today=new Date();today.setHours(0,0,0,0);
   const overdue=unpaid.filter(x=>x.dueDate&&x.dueDate<today.toISOString().slice(0,10));
   const completed=tasks.filter(x=>x.completedAt&&dateValue(x.completedAt)&&dateValue(x.completedAt).toDateString()===new Date().toDateString()&&x.status!=="Failed");
   el("intelCurrency").textContent="Financial figures shown in "+currency+". Other currencies are excluded.";
   const metrics=el("intelMetrics");metrics.replaceChildren(
    metric("CLIENT RECORDS",clients.length,"Saved client and lead profiles","◎"),
    metric("INVOICED",formatMoney(invoiced,currency),relevant.length+" invoices in "+currency,"▤"),
    metric("MARKED PAID",formatMoney(collected,currency),paid.length+" invoices marked paid","✓"),
    metric("NEXUS COMPLETED TODAY",completed.length,"Tasks with a completion date today","✧")
   );
   const signals=el("intelSignals");signals.replaceChildren();
   if(overdue.length)signals.append(signal("Review overdue invoices",overdue.length+" invoice"+(overdue.length===1?" is":"s are")+" past the recorded due date. Confirm payment status before following up.","High","invoices"));
   else if(unpaid.length)signals.append(signal("Follow up on unpaid invoices",unpaid.length+" invoice"+(unpaid.length===1?" is":"s are")+" not marked as paid. Check the records and follow up where appropriate.","Medium","invoices"));
   const newClients=clients.filter(x=>!x.status||["New","Contacted"].includes(String(x.status))).length;
   if(newClients)signals.append(signal("Review the client pipeline",newClients+" client record"+(newClients===1?" may":"s may")+" need a next sales step. Verify each record before prioritising.","Medium","leads"));
   const reviewTasks=tasks.filter(x=>x.status==="Awaiting review").length;
   if(reviewTasks)signals.append(signal("NEXUS work awaits review",reviewTasks+" NEXUS assignment"+(reviewTasks===1?" is":"s are")+" awaiting your decision.","High","nexus"));
   if(!signals.children.length)signals.append(make("div","intel-empty","No priority signals from the available records. Add or update invoices, clients and NEXUS assignments to build a richer picture."));
   const chart=el("intelTrend");chart.replaceChildren();
   const months=[];for(let offset=5;offset>=0;offset--){const d=new Date(today.getFullYear(),today.getMonth()-offset,1);months.push({key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:d.toLocaleString(undefined,{month:"short"}),value:0});}
   relevant.forEach(inv=>{const d=dateValue(inv.date);if(!d)return;const m=months.find(x=>x.key===d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));if(m)m.value+=(Number(inv.amount)||0);});
   const max=Math.max(1,...months.map(x=>x.value));
   months.forEach(m=>{const col=make("div","intel-bar-column");const amount=make("span","intel-bar-value",m.value?formatMoney(m.value,currency):"—");const bar=make("div","intel-bar-track");const fill=make("div","intel-bar-fill");fill.style.height=(m.value?Math.max(4,m.value/max*100):0)+"%";bar.append(fill);col.append(amount,bar,make("small","",m.label));chart.append(col);});
   el("intelTrendNote").textContent=relevant.length?"Monthly invoice value issued · selected currency only. This is historical activity, not a forecast or recognised revenue.":"No invoices in "+currency+" yet. Create invoices to build a historical trend.";
   const activity=el("intelActivity");activity.replaceChildren();
   const recent=tasks.slice().sort((a,b)=>(dateValue(b.createdAt)?.getTime()||0)-(dateValue(a.createdAt)?.getTime()||0)).slice(0,4);
   if(!recent.length)activity.append(make("div","intel-empty","No NEXUS activity recorded yet."));
   recent.forEach(task=>{const row=make("div","intel-activity-row");const details=make("div","");details.append(make("strong","",task.agent||"VEXT NEXUS"),make("small","",(task.prompt||"NEXUS assignment").replace(/\s+/g," ").slice(0,95)));row.append(details,make("span","intel-task-status",task.status||"Saved"));activity.append(row);});
   el("intelOutstandingNote").textContent=formatMoney(Math.max(0,invoiced-collected),currency)+" recorded as outstanding by invoice status. This is not bank-verified.";
  }
  el("intelOpenAnalytics").addEventListener("click",()=>navigate("analytics"));
  el("intelOpenNexus").addEventListener("click",()=>navigate("nexus"));
  el("intelOpenClients").addEventListener("click",()=>navigate("leads"));
  return {render};
 }
};
})();