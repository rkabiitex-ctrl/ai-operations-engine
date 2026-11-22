"use strict";
window.VEXTSalesIntelligence=(()=>{
 const stages=["New","Contacted","Qualified","Proposal","Won","Lost"];
 function stageOf(client){
  const raw=String(client.salesStage||client.salesStatus||client.status||"New").trim().toLowerCase();
  return stages.find(stage=>stage.toLowerCase()===raw)||"New";
 }
 function scoreOf(client){
  const reasons=[];let score=0;
  if(client.email||client.phone){score+=20;reasons.push("Has a contact method (+20)");}
  if(String(client.interest||"").trim()){score+=20;reasons.push("Has a recorded product or service interest (+20)");}
  const stage=stageOf(client);
  const stagePoints={New:5,Contacted:15,Qualified:25,Proposal:30,Won:30,Lost:0}[stage]||0;
  score+=stagePoints;if(stagePoints)reasons.push("Pipeline stage: "+stage+" (+"+stagePoints+")");
  if(client.nextFollowUpDate){score+=15;reasons.push("Follow-up is scheduled (+15)");}
  const history=Array.isArray(client.enquiryHistory)?client.enquiryHistory.length:0;
  if(history){const points=Math.min(15,history*5);score+=points;reasons.push(history+" recorded enquiry/enquiries (+"+points+")");}
  if(client.created||client.createdAt){
   const created=new Date(client.created||client.createdAt);
   if(!Number.isNaN(created.getTime())&&Date.now()-created.getTime()<14*86400000){score+=10;reasons.push("Recent customer record (+10)");}
  }
  return {score:Math.min(100,score),reasons,stage};
 }
 function tier(score){return score>=70?"High potential":score>=40?"Developing":"Early stage";}
 function init({$,read,navigate}){
  const el=id=>$(id);
  function render(){
   const all=read("leads",[]),clients=Array.isArray(all)?all:[];
   const scored=clients.map(client=>({client,...scoreOf(client)})).filter(item=>!["Won","Lost"].includes(item.stage));
   const won=clients.filter(x=>stageOf(x)==="Won").length;
   const qualified=clients.filter(x=>["Qualified","Proposal"].includes(stageOf(x))).length;
   const followups=clients.filter(x=>x.nextFollowUpDate&&new Date(x.nextFollowUpDate+"T23:59:59")>=new Date()).length;
   el("salesIntelTotal").textContent=String(clients.length);
   el("salesIntelQualified").textContent=String(qualified);
   el("salesIntelFollowups").textContent=String(followups);
   el("salesIntelWon").textContent=String(won);
   const pipeline=el("salesIntelPipeline");pipeline.replaceChildren();
   stages.forEach(stage=>{
    const count=clients.filter(x=>stageOf(x)===stage).length;
    const row=document.createElement("div");row.className="sales-intel-stage";
    const label=document.createElement("span");label.textContent=stage;
    const track=document.createElement("div");track.className="sales-intel-track";
    const fill=document.createElement("span");fill.style.width=(clients.length?count/clients.length*100:0)+"%";track.append(fill);
    const value=document.createElement("strong");value.textContent=String(count);
    row.append(label,track,value);pipeline.append(row);
   });
   const list=el("salesIntelOpportunities");list.replaceChildren();
   scored.sort((a,b)=>b.score-a.score);
   if(!scored.length){const empty=document.createElement("p");empty.className="muted small";empty.textContent=clients.length?"All recorded opportunities are marked won or lost.":"Add customers in Client Management to see sales opportunities and recommendations.";list.append(empty);return;}
   scored.slice(0,8).forEach(item=>{
    const row=document.createElement("article");row.className="sales-intel-opportunity";
    const main=document.createElement("div");
    const name=document.createElement("strong");name.textContent=item.client.name||"Unnamed customer";
    const meta=document.createElement("p");meta.className="muted small";meta.textContent=(item.client.interest||"No interest recorded")+" · "+item.stage;
    const reason=document.createElement("small");reason.textContent=item.reasons.slice(0,3).join(" · ")||"No engagement signals recorded yet.";
    main.append(name,meta,reason);
    const side=document.createElement("div");side.className="sales-intel-score";
    const score=document.createElement("strong");score.textContent=item.score+"/100";
    const label=document.createElement("span");label.textContent=tier(item.score);
    side.append(score,label);row.append(main,side);list.append(row);
   });
   el("salesIntelNote").textContent="Scores are transparent rule-based estimates from saved CRM fields, not predictions or guarantees. Won and Lost records are excluded from the opportunity list. Won records: "+won+".";
  }
  el("salesIntelOpenCrm").addEventListener("click",()=>navigate("leads"));
  return {render};
 }
 return {init};
})();