"use strict";
window.VEXTAudit = (() => {
 function init({ $, read, write, id, esc, getVextAccessToken, VEXT_CHAT_ENDPOINT }) {
  function auditRuleChecks(){
   const invoices=read("invoices"),clients=read("leads"),issues=[];
   const seen=new Set();
   invoices.forEach((invoice,index)=>{
    const number=String(invoice.number||"").trim().toLowerCase();
    if(!number)issues.push({level:"warning",text:"Invoice record "+(index+1)+" has no invoice number."});
    else if(seen.has(number))issues.push({level:"warning",text:"Duplicate invoice number recorded: "+invoice.number+"."});
    else seen.add(number);
    if(!String(invoice.client||"").trim())issues.push({level:"warning",text:"Invoice "+(invoice.number||("#"+(index+1)))+" has no customer name."});
    if(!Number.isFinite(Number(invoice.amount))||Number(invoice.amount)<=0)issues.push({level:"warning",text:"Invoice "+(invoice.number||("#"+(index+1)))+" has a missing or invalid amount."});
    if(!/^[A-Z]{3}$/.test(String(invoice.currency||"")))issues.push({level:"warning",text:"Invoice "+(invoice.number||("#"+(index+1)))+" has a missing or unusual currency code."});
    if(!["Paid","Unpaid"].includes(invoice.status))issues.push({level:"review",text:"Invoice "+(invoice.number||("#"+(index+1)))+" has an unrecognized payment status."});
    // Payment dates are not captured consistently yet, so absence alone is not flagged.
   });
   return {invoices,clients,issues};
  }
  function formatAuditReport(value){
   const source=String(value??"").replace(/\\([#*`-])/g,"$1").replace(/\\\s*$/gm,"");
   const lines=source.split(/\r?\n/);let html="",inList=false;
   const inline=line=>esc(line).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>");
   for(const raw of lines){
    const line=raw.trim();
    if(!line){if(inList){html+="</ul>";inList=false;}continue;}
    const heading=line.match(/^#{1,3}\s+(.+)$/);
    if(heading){if(inList){html+="</ul>";inList=false;}html+="<h3>"+inline(heading[1])+"</h3>";continue;}
    const item=line.match(/^[-*]\s+(.+)$/);
    if(item){if(!inList){html+="<ul>";inList=true;}html+="<li>"+inline(item[1])+"</li>";continue;}
    if(inList){html+="</ul>";inList=false;}
    html+="<p>"+inline(line)+"</p>";
   }
   if(inList)html+="</ul>";
   return html;
  }
  function renderAuditCentre(){
   const data=auditRuleChecks();
   $("auditInvoiceCount").textContent=data.invoices.length;
   $("auditUnpaidCount").textContent=data.invoices.filter(x=>x.status!=="Paid").length;
   $("auditClientCount").textContent=data.clients.length;
   $("auditIssueCount").textContent=data.issues.length;
   $("auditChecks").innerHTML=data.issues.length?'<strong>'+data.issues.length+' item(s) need review</strong><ul>'+data.issues.map(x=>'<li>'+esc(x.text)+'</li>').join("")+'</ul>':'<strong>No basic data-quality issues detected.</strong><p class="small">This only means the available rule checks passed; it does not prove the records are complete or accurate.</p>';
   const reports=read("audit_reports",[]);
   $("auditReportHistory").innerHTML=reports.length?reports.slice(0,10).map((report,index)=>'<div class="audit-report-row"><strong>'+esc(report.title||"Business records review")+'</strong><div class="audit-report-date">'+esc(report.createdAt?new Date(report.createdAt).toLocaleString():"Date not recorded")+'</div><div class="small">'+esc((report.summary||"Report saved").slice(0,220))+'</div><button class="secondary" type="button" data-audit-report="'+index+'" style="margin-top:8px">View report</button></div>').join(""):'<div class="empty">No audit reports yet.</div>';
  }
  $("auditReportHistory").addEventListener("click",event=>{
   const button=event.target.closest("[data-audit-report]");if(!button)return;
   const report=read("audit_reports",[])[Number(button.dataset.auditReport)];if(!report)return;
   $("auditResult").innerHTML='<h3>'+esc(report.title||"Audit report")+'</h3><div class="audit-report-date">'+esc(report.createdAt?new Date(report.createdAt).toLocaleString():"")+'</div><div>'+formatAuditReport(report.content||report.summary||"No report text saved.")+'</div>';
  });
  $("runAudit").addEventListener("click",async()=>{
   const button=$("runAudit"),status=$("auditStatus"),result=$("auditResult");
   const data=auditRuleChecks();
   if(!data.invoices.length&&!data.clients.length){
    status.textContent="Add some invoices or client records before running an audit.";
    result.innerHTML="";return;
   }
   button.disabled=true;button.textContent="Reviewing records…";
   status.textContent="VEXT AI is reviewing the available records. Please wait.";
   result.innerHTML="";
   try{
    const invoiceData=data.invoices.slice(0,500).map(x=>({number:x.number||"",client:x.client||"",description:x.description||"",amount:Number(x.amount)||0,currency:x.currency||"",status:x.status||"",date:x.date||"",dueDate:x.dueDate||""}));
    const auditInput={
     invoiceCount:data.invoices.length,clientRecordCount:data.clients.length,
     automatedChecksRun:true,
     automatedChecksPerformed:["Invoice number presence","Duplicate invoice numbers","Customer name presence","Positive numeric invoice amount","Three-letter currency code format","Recognized Paid/Unpaid payment status"],
     ruleBasedExceptions:data.issues,
     invoices:invoiceData,
     note:"The automated checks listed above were executed. An empty ruleBasedExceptions array means no exceptions were flagged by those specific checks; it does not mean checks were skipped or that the records are fully accurate. AI review may identify additional inconsistencies in descriptions. Invoice customer names are included when present in the invoice record. Client contact details and independent invoice-to-client verification are not provided; an aggregate client count does not establish a verified linkage."
    };
    const prompt="Act as VEXT AI's preliminary internal-controls reviewer. Review only the supplied VEXT AI records. Do not claim to have checked bank accounts, receipts, cash, tax compliance, employee activity or external systems. Do not accuse anyone of fraud. Distinguish observed record issues from possible risks and recommendations. If data is insufficient, say so. Highlight currency separation and do not add different currencies together. Produce a concise professional report with: Executive summary; Confirmed record checks; Items requiring human verification; Practical recommendations; Scope and limitations. Cite invoice numbers for each specific finding. Never invent missing values. Explicitly state that automatedChecksRun confirms the listed checks were executed; if ruleBasedExceptions is empty, say no exceptions were flagged by those checks, not that checks were not run or that the whole audit passed. Distinguish rule-based checks from additional AI observations. Use the supplied invoice client field when discussing customer attribution; do not claim the customer name is missing if a non-empty client value is supplied. A customer name alone does not prove a verified client-record linkage. Data: "+JSON.stringify(auditInput);
    const token=await getVextAccessToken();
    const response=await fetch(VEXT_CHAT_ENDPOINT,{
     method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
     body:JSON.stringify({message:prompt,history:[]})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||("Audit request failed ("+response.status+")"));
    const reportText=typeof payload.reply==="string"?payload.reply:"";
    if(!reportText)throw new Error("The AI service returned an empty audit report.");
    const report={id:id(),title:"Business records review",createdAt:new Date().toISOString(),summary:reportText.replace(/\s+/g," ").slice(0,260),content:reportText,invoiceCount:data.invoices.length,issueCount:data.issues.length};
    const reports=read("audit_reports",[]);reports.unshift(report);write("audit_reports",reports.slice(0,50));
    result.innerHTML='<h3>Audit report</h3><div class="audit-report-date">'+esc(new Date(report.createdAt).toLocaleString())+'</div><div>'+formatAuditReport(reportText)+'</div>';
    status.textContent="Report generated and saved to your VEXT workspace.";
    renderAuditCentre();
   }catch(error){status.textContent="Could not complete the audit: "+(error.message||"Please try again.");}
   finally{button.disabled=false;button.textContent="Run AI audit";}
  });
  return { renderAuditCentre, formatAuditReport, auditRuleChecks };
 }
 return { init };
})();
