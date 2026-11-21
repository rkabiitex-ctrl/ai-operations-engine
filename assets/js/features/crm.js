function getClientSalesStage(client){
  const history=Array.isArray(client.enquiryHistory)?client.enquiryHistory:[];
  const raw=client.salesStage||history.at(-1)?.salesStage||client.salesStatus||client.status||"New";
  const stages=["New","Contacted","Qualified","Proposal","Won","Lost"];
  return stages.find(stage=>stage.toLowerCase()===String(raw).trim().toLowerCase())||"New";
 }
 function crmInterestSummary(client){
 const raw=String(client.interest||client.enquiryHistory?.at(-1)?.message||"No interest recorded").trim();
 if(!raw)return "No interest recorded";
 // Keep the directory scannable while leaving the complete original enquiry in the profile.
 const firstSentence=(raw.match(/^[\\s\\S]*?[.!?](?=\\s|$)/)||[raw])[0].trim();
 const summary=firstSentence.length<=92?firstSentence:firstSentence.slice(0,89).trimEnd()+"…";
 return summary.replace(/\\s+/g," ");
}
function crmFollowupState(client){
 const stage=getClientSalesStage(client);
 if(["Won","Lost"].includes(stage))return "complete";
 const date=String(client.nextFollowUpDate||"").trim();
 if(!date)return "unscheduled";
 const today=new Date();const localToday=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
 return date<localToday?"overdue":date===localToday?"today":"upcoming";
}
function crmFollowupLabel(client){
 const state=crmFollowupState(client);
 if(state==="overdue")return "Overdue";
 if(state==="today")return "Due today";
 if(state==="upcoming")return "Upcoming · "+client.nextFollowUpDate;
 if(state==="complete")return "Closed";
 return "Not scheduled";
}
function renderCrmReminderAlerts(leads){
 const due=leads.filter(x=>["overdue","today"].includes(crmFollowupState(x))).sort((a,b)=>String(a.nextFollowUpDate||"").localeCompare(String(b.nextFollowUpDate||"")));
 $("crmReminderFeed").innerHTML=due.length?due.slice(0,8).map(x=>`<div class="crm-reminder-row"><div><strong>${esc(x.name||"Unnamed customer")}</strong><small>${esc(x.nextAction||"Follow up with this customer")}</small></div><span class="crm-followup-tag ${crmFollowupState(x)}">${esc(crmFollowupLabel(x))}</span><button class="secondary" data-reminder-client="${esc(x.id)}">Open</button></div>`).join(""):'<div class="empty">No follow-ups are due today. You are all caught up.</div>';
 const enabled=localStorage.getItem("vext_crm_browser_alerts")==="true";
 const btn=$("enableCrmNotifications");
 if(btn)btn.textContent=enabled?"Browser alerts enabled":"Enable browser alerts";
 if(enabled&&"Notification" in window&&Notification.permission==="granted"){
  const today=new Date().toISOString().slice(0,10);
  due.forEach(x=>{
   const key="vext_crm_notice_"+String(x.id)+"_"+today;
   if(localStorage.getItem(key))return;
   const state=crmFollowupState(x);
   const notice=new Notification(state==="overdue"?"Overdue customer follow-up":"Customer follow-up due today",{body:(x.name||"Customer")+": "+(x.nextAction||"Contact this customer"),tag:key});
   notice.onclick=()=>{window.focus();renderClientProfile(x.id);$("clientProfilePanel").scrollIntoView({behavior:"smooth",block:"start"});notice.close();};
   localStorage.setItem(key,"1");
  });
 }
}
function renderLeads(){
 const leads=read("leads");
 const q=$("leadSearch").value.toLowerCase();
 const filter=$("crmFollowupFilter")?.value||"all";
 const counts={overdue:0,today:0,upcoming:0};
 leads.forEach(x=>{const state=crmFollowupState(x);if(counts[state]!==undefined)counts[state]++;});
 $("crmTotal").textContent=leads.length;
 $("crmEnquiries").textContent=leads.filter(x=>Array.isArray(x.enquiryHistory)&&x.enquiryHistory.length).length;
 $("crmOverdue").textContent=counts.overdue;
 $("crmDueToday").textContent=counts.today;
 $("crmUpcoming").textContent=counts.upcoming;
 renderCrmReminderAlerts(leads);
 const filtered=leads.filter(x=>
 [x.name,x.email,x.phone,x.country,x.interest,x.salesStage,x.nextAction,x.nextFollowUpDate].join(" ").toLowerCase().includes(q)
 ).filter(x=>filter==="all"||(filter==="unscheduled"?crmFollowupState(x)==="unscheduled":crmFollowupState(x)===filter));
 $("crmDirectoryCount").textContent=filtered.length+" record"+(filtered.length===1?"":"s");
 $("leadTable").innerHTML=filtered.length?
 `<table><thead><tr><th>Customer</th><th>Contact</th><th>Sales status</th><th>Follow-up</th><th>Profile</th></tr></thead><tbody>
 ${filtered.map(x=>{const historyCount=Array.isArray(x.enquiryHistory)?x.enquiryHistory.length:0;const stage=getClientSalesStage(x);const state=crmFollowupState(x);return `<tr>
 <td><strong>${esc(x.name||"Unnamed client")}</strong><br><small>${esc(crmInterestSummary(x))}</small>${historyCount?`<br><small>${historyCount} website ${historyCount===1?"enquiry":"enquiries"}</small>`:""}</td>
 <td>${esc(x.email||x.phone||"—")}</td><td><span class="pill">${esc(stage)}</span></td>
 <td><span class="crm-followup-tag ${state}">${esc(crmFollowupLabel(x))}</span></td>
 <td><button class="secondary" data-open-client="${esc(x.id)}">View profile</button></td></tr>`}).join("")}
 </tbody></table>`:'<div class="empty">No customers match this search or follow-up filter.</div>';
 const selected=$("clientProfilePanel").dataset.clientId;
 if(selected&&leads.some(x=>x.id===selected))renderClientProfile(selected);
 else if(selected)closeClientProfile();
}
function renderClientProfile(clientId){
 const client=read("leads").find(x=>x.id===clientId);if(!client)return;
 $("clientProfilePanel").hidden=false;$("clientProfilePanel").dataset.clientId=clientId;
 const history=Array.isArray(client.enquiryHistory)?client.enquiryHistory:[];
 const activityLog=Array.isArray(client.activityLog)?client.activityLog:[];
 const stages=["New","Contacted","Qualified","Proposal","Won","Lost"];
 const currentStage=getClientSalesStage(client);
 $("clientProfileContent").innerHTML=`
  <div class="crm-profile-head"><div><span class="dashboard-eyebrow">CUSTOMER PROFILE</span><h2>${esc(client.name||"Unnamed client")}</h2><p class="muted small">${esc(client.interest||"No business interest recorded")}</p></div><button class="secondary" id="closeClientProfile" type="button">Close profile</button></div>
  <div class="crm-profile-grid">
   <div class="crm-detail"><span>Email</span><strong>${esc(client.email||"Not provided")}</strong></div>
   <div class="crm-detail"><span>Phone</span><strong>${esc(client.phone||"Not provided")}</strong></div>
   <div class="crm-detail"><span>Country</span><strong>${esc(client.country||"Not provided")}</strong></div>
   <div class="crm-detail"><span>Source</span><strong>${esc(client.source||"Manually added")}</strong></div>
  </div>
  <div class="crm-edit-grid">
   <div class="field"><label for="clientSalesStage">Sales status</label><select id="clientSalesStage">${stages.map(s=>`<option value="${s}" ${s===currentStage?"selected":""}>${s}</option>`).join("")}</select></div>
   <div class="field"><label for="clientNextAction">Next follow-up action</label><input id="clientNextAction" maxlength="300" value="${esc(client.nextAction||"")}" placeholder="e.g. Contact customer with a quote"></div>
   <div class="field"><label for="clientFollowupDate">Follow-up date</label><input id="clientFollowupDate" type="date" value="${esc(client.nextFollowUpDate||"")}"><small class="muted">Set a date to track overdue, today's and upcoming follow-ups.</small></div>
  </div>
  <div class="field"><label for="clientNotes">Internal notes</label><textarea id="clientNotes" maxlength="2000" rows="3" placeholder="Add useful context for your team...">${esc(client.notes||"")}</textarea></div>
  <div class="action-row"><button class="primary" id="saveClientProfile" type="button">Save profile updates</button><span class="chat-status" id="clientProfileStatus" role="status"></span></div>
  <div class="crm-history-heading"><div><h3>Activity timeline</h3><p class="muted small">Website enquiries and recorded profile changes, newest first</p></div></div>
  ${[...history.map((entry,index)=>({kind:"enquiry",title:"Website enquiry "+(index+1),detail:entry.message||"No enquiry message",at:entry.receivedAt,status:entry.salesStage||"New",meta:"Intent: "+(entry.intent||"Not classified")+(entry.leadScore?" · Lead score: "+entry.leadScore:"") })),...activityLog].sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime()).map(item=>`<div class="crm-history-item crm-timeline-item"><div class="crm-history-top"><strong>${esc(item.title||"Profile activity")}</strong>${item.status?`<span class="pill">${esc(item.status)}</span>`:""}</div><p>${esc(item.detail||"")}</p><div class="crm-history-meta">${esc(item.at?new Date(item.at).toLocaleString():"Date not recorded")}${item.meta?" · "+esc(item.meta):""}</div></div>`).join("")||'<div class="empty">No activity recorded yet.</div>'}
  <div class="crm-history-heading"><div><h3>Full enquiry history</h3><p class="muted small">${history.length} saved website ${history.length===1?"enquiry":"enquiries"} · Original customer messages are preserved</p></div></div>
  ${history.length?history.slice().reverse().map((entry,index)=>`<div class="crm-history-item"><div class="crm-history-top"><strong>Website enquiry ${history.length-index}</strong><span class="pill">${esc(entry.salesStage||"New")}</span></div><p>${esc(entry.message||"No enquiry message")}</p><div class="crm-history-meta">${esc(entry.receivedAt?new Date(entry.receivedAt).toLocaleString():"Date not recorded")} · Intent: ${esc(entry.intent||"Not classified")}${entry.leadScore? " · Lead score: "+esc(entry.leadScore):""}</div>${entry.nextAction?`<div class="crm-history-meta">Next action: ${esc(entry.nextAction)}</div>`:""}</div>`).join(""):'<div class="empty">No website enquiries are linked to this client yet.</div>'}`;
}
function closeClientProfile(){
 $("clientProfilePanel").hidden=true;$("clientProfilePanel").dataset.clientId="";
 $("clientProfileContent").innerHTML="";
}
