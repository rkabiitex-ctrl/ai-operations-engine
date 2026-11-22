"use strict";
window.VEXTCRMAdvanced=(()=>{
 let deps=null,selectedId="";
 const $=id=>deps.$(id);
 const safeDate=value=>{const d=new Date(value||0);return Number.isNaN(d.getTime())?null:d};
 function render(){
  if(!deps)return;
  const leads=deps.read("leads",[]),clients=Array.isArray(leads)?leads:[];
  const today=new Date();today.setHours(0,0,0,0);
  const recent=clients.filter(c=>{const d=safeDate(c.lastInteractionAt||c.created||c.createdAt);return d&&today-d>=0&&today-d<30*86400000;}).length;
  const atRisk=clients.filter(c=>c.segment==="At risk"||(()=>{const d=safeDate(c.lastInteractionAt||c.created||c.createdAt);return d&&today-d>45*86400000;})()).length;
  const active=clients.filter(c=>c.segment==="Active"||c.segment==="High value").length;
  const segments=["New","Active","High value","At risk","Partner"];
  $("crmRelationshipMetrics").innerHTML=[
   ["Total relationships",clients.length],["Recently active",recent],["Needs attention",atRisk],["Active / high value",active]
  ].map(([label,value])=>'<div class="crm-relationship-metric"><span>'+deps.esc(label)+'</span><strong>'+value+'</strong></div>').join("");
  const stageCounts={};clients.forEach(c=>{const stage=String(c.salesStage||c.status||"New");stageCounts[stage]=(stageCounts[stage]||0)+1;});
  const stale=clients.filter(c=>{const d=safeDate(c.lastInteractionAt||c.created||c.createdAt);return d&&today-d>45*86400000;}).slice(0,4);
  const insightItems=[
   ["Pipeline mix",Object.entries(stageCounts).map(([k,v])=>k+": "+v).join(" · ")||"Add customers to begin tracking relationship stages."],
   ["Relationships to revisit",stale.length?stale.map(c=>c.name||"Unnamed customer").join(", "):"No customers are currently flagged as inactive for more than 45 days."],
   ["Segmentation",segments.map(s=>s+": "+clients.filter(c=>c.segment===s).length).join(" · ")],
   ["Next step","Use customer segments to prioritize outreach. Relationship scores are descriptive signals, not predictions."]
  ];
  $("crmRelationshipInsights").innerHTML=insightItems.map(([title,body])=>'<article class="crm-relationship-insight"><strong>'+deps.esc(title)+'</strong><p>'+deps.esc(body)+'</p></article>').join("");
  const select=$("crmRelationshipClient"),current=select.value||selectedId;
  select.innerHTML='<option value="">Choose a customer</option>'+clients.map(c=>'<option value="'+deps.esc(c.id)+'">'+deps.esc(c.name||"Unnamed customer")+'</option>').join("");
  if(clients.some(c=>c.id===current))select.value=current;
  if(select.value)loadProfile(select.value);
 }
 function loadProfile(id){
  const client=deps.read("leads",[]).find(c=>c.id===id);if(!client)return;
  selectedId=id;
  $("crmRelationshipSegment").value=client.segment||"New";
  $("crmRelationshipCompany").value=client.company||"";
  $("crmRelationshipRole").value=client.contactRole||"";
  $("crmRelationshipChannel").value=client.preferredChannel||"";
 }
 function init(options){
  deps=options;
  $("crmRelationshipClient").addEventListener("change",e=>loadProfile(e.target.value));
  $("crmRelationshipForm").addEventListener("submit",e=>{
   e.preventDefault();
   const all=deps.read("leads",[]),client=all.find(c=>c.id===$("crmRelationshipClient").value);
   if(!client){$("crmRelationshipStatus").textContent="Choose a customer first.";return;}
   const before={segment:client.segment||"New",company:client.company||"",contactRole:client.contactRole||"",preferredChannel:client.preferredChannel||""};
   client.segment=$("crmRelationshipSegment").value;
   client.company=$("crmRelationshipCompany").value.trim();
   client.contactRole=$("crmRelationshipRole").value.trim();
   client.preferredChannel=$("crmRelationshipChannel").value;
   const changed=Object.keys(before).some(k=>before[k]!==client[k]);
   const interaction=$("crmRelationshipInteraction").value.trim();
   client.activityLog=Array.isArray(client.activityLog)?client.activityLog:[];
   const now=new Date().toISOString();
   if(changed)client.activityLog.push({kind:"relationship",title:"Relationship profile updated",detail:"Segment: "+client.segment+" · Preferred channel: "+(client.preferredChannel||"Not specified"),at:now});
   if(interaction){
    const type=$("crmRelationshipType").value;
    client.activityLog.push({kind:"interaction",title:type+" recorded",detail:interaction,at:now});
    client.lastInteractionAt=now;
   }
   deps.write("leads",all);
   if(deps.renderClientProfile&&$("clientProfilePanel").dataset.clientId===client.id)deps.renderClientProfile(client.id);
   $("crmRelationshipInteraction").value="";
   $("crmRelationshipStatus").textContent="Relationship profile saved"+(interaction?" and interaction added to timeline.":".");
   render();
  });
  render();
 }
 return {init,render};
})();
