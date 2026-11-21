"use strict";
(() => {
  function init(deps) {
    const $ = deps.$;
    const read = deps.read;
    const write = deps.write;
    const id = deps.id;
    const esc = deps.esc;
    const formatMoney = deps.formatMoney;
    const currentCurrency = deps.currentCurrency;
    const getClientSalesStage = deps.getClientSalesStage;
    const formatAuditReport = deps.formatAuditReport;
    const getVextAccessToken = deps.getVextAccessToken;
    const VEXT_CHAT_ENDPOINT = deps.VEXT_CHAT_ENDPOINT;
    const renderManagementActions = deps.renderManagementActions;

    function renderAnalytics(){
 const leads=read("leads"),allInvoices=read("invoices"),code=currentCurrency();
 const range=$("analyticsRange")?.value||"30",now=new Date(),cutoff=new Date(now);
 if(range!=="all")cutoff.setDate(cutoff.getDate()-Number(range));
 const inPeriod=value=>{if(!value)return false;const d=new Date(value);return !Number.isNaN(d.getTime())&&(range==="all"||d>=cutoff)&&d<=now;};
 const invoices=allInvoices.filter(x=>x.currency===code);
 const periodInvoices=invoices.filter(x=>inPeriod(x.date));
 const periodLeads=leads.filter(x=>inPeriod(x.created));
 const paid=periodInvoices.filter(x=>x.status==="Paid");
 const outstanding=periodInvoices.filter(x=>x.status!=="Paid");
 const total=periodInvoices.reduce((s,x)=>s+Number(x.amount||0),0);
 const paidTotal=paid.reduce((s,x)=>s+Number(x.amount||0),0);
 const due=outstanding.filter(x=>x.dueDate&&x.dueDate<now.toISOString().slice(0,10));
 const rate=periodInvoices.length?Math.round(paid.length/periodInvoices.length*100):0;
 $("analyticsCurrencyLabel").textContent="Currency: "+code;
 const monthCount=range==="30"?6:range==="90"?6:12;
 const buckets=[];
 for(let i=monthCount-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);buckets.push({key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:d.toLocaleDateString(undefined,{month:"short"}),value:0,count:0});}
 periodInvoices.forEach(x=>{const d=new Date(x.date);if(Number.isNaN(d.getTime()))return;const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");const b=buckets.find(v=>v.key===key);if(b){b.value+=Number(x.amount||0);b.count++;}});
 const max=Math.max(1,...buckets.map(x=>x.value));
 const chart=buckets.map(b=>'<div class="analytics-bar-group"><span class="analytics-bar-value">'+(b.value?esc(formatMoney(b.value,code)):"—")+'</span><div class="analytics-bar" style="height:'+Math.max(2,Math.round(b.value/max*100))+'%"></div><span class="analytics-bar-label">'+esc(b.label)+'</span></div>').join("");
 const stages=["New","Contacted","Qualified","Proposal","Won","Lost"];
 const stageCounts=stages.map(stage=>({stage,count:leads.filter(x=>getClientSalesStage(x)===stage).length}));
 const stageMax=Math.max(1,...stageCounts.map(x=>x.count));
 const signals=[];
 if(due.length)signals.push({title:due.length+" overdue invoice"+(due.length===1?"":"s"),body:"Review overdue "+code+" invoices and agree the next collection action."});
 if(periodInvoices.some(x=>x.status!=="Paid"&&!x.dueDate))signals.push({title:"Missing due dates",body:"Some unpaid invoices have no structured due date. Add one to improve collection tracking."});
 if(periodInvoices.some(x=>!String(x.client||"").trim()))signals.push({title:"Invoices without a customer",body:"Review invoice records with no customer name before relying on customer-level reporting."});
 if(!signals.length)signals.push({title:"No immediate record alerts",body:"No overdue or missing-field signals were detected in the selected "+code+" invoice records. This is not a full financial audit."});
 $("analyticsContent").innerHTML=`
 <div class="analytics-kpis">
  <article class="analytics-kpi"><span>NEW CLIENTS · SELECTED PERIOD</span><strong>${periodLeads.length}</strong><small>${leads.length} client records overall</small></article>
  <article class="analytics-kpi"><span>INVOICED · ${code}</span><strong>${formatMoney(total,code)}</strong><small>${periodInvoices.length} invoices in selected period</small></article>
  <article class="analytics-kpi"><span>COLLECTED · ${code}</span><strong>${formatMoney(paidTotal,code)}</strong><small>${paid.length} invoices marked paid</small></article>
  <article class="analytics-kpi"><span>OUTSTANDING · ${code}</span><strong>${formatMoney(total-paidTotal,code)}</strong><small>${due.length} overdue invoices in this period</small></article>
 </div>
 <div class="analytics-layout">
  <section class="analytics-panel"><div class="analytics-panel-head"><div><span class="ai-eyebrow">REVENUE ACTIVITY</span><h3>Invoice value over time</h3><p>Issued invoice value by month · ${code}</p></div><span class="pill">${range==="all"?"Recent 12 months":range==="365"?"12 months":range==="90"?"90 days":"30 days"}</span></div>
   ${periodInvoices.length?'<div class="analytics-chart">'+chart+'</div><div class="analytics-legend"><span><i></i> Invoice value</span><span>'+periodInvoices.length+' invoices recorded</span></div>':'<div class="analytics-empty">No invoices in this period and currency yet. Create invoices to build your trend.</div>'}
  </section>
  <section class="analytics-panel"><div class="analytics-panel-head"><div><span class="ai-eyebrow">COLLECTION HEALTH</span><h3>Payment performance</h3><p>Based on invoice count, not payment value.</p></div></div>
   <div class="analytics-stat-row"><span>Paid invoices</span><strong>${paid.length}</strong></div><div class="analytics-stat-row"><span>Unpaid invoices</span><strong>${outstanding.length}</strong></div><div class="analytics-stat-row"><span>Payment rate</span><strong>${rate}%</strong></div><div class="analytics-progress"><span style="width:${rate}%"></span></div><div class="analytics-stat-row"><span>Overdue invoices</span><strong>${due.length}</strong></div>
  </section>
 </div>
 <div class="analytics-layout">
  <section class="analytics-panel"><div class="analytics-panel-head"><div><span class="ai-eyebrow">CUSTOMER PIPELINE</span><h3>Client sales stages</h3><p>${leads.length} client records · all time</p></div></div>
   ${leads.length?stageCounts.map(x=>'<div class="analytics-stat-row"><span>'+x.stage+'</span><strong>'+x.count+'</strong></div><div class="analytics-progress"><span style="width:'+Math.round(x.count/stageMax*100)+'%"></span></div>').join(""):'<div class="analytics-empty">Client pipeline data will appear when clients are added.</div>'}
  </section>
  <section class="analytics-panel"><div class="analytics-panel-head"><div><span class="ai-eyebrow">OPERATIONS WATCH</span><h3>Items to review</h3><p>Signals calculated from saved workspace records.</p></div></div>
   <div class="analytics-signals">${signals.map(x=>'<article class="analytics-signal"><b>'+esc(x.title)+'</b><p>'+esc(x.body)+'</p></article>').join("")}</div>
  </section>
 </div>
 <p class="analytics-footnote">Reporting currency: ${code}. Invoice amounts in other currencies are excluded, not converted. Revenue activity represents invoice value issued, not recognised accounting revenue. Payment status reflects records marked Paid; no bank, payment gateway or external accounting data is checked. Client stage counts use saved CRM status fields and may default to New.</p>`;
}

    function renderAnalystHistory(){
 const reports=read("business_analysis_reports",[]),count=$("analystHistoryCount"),list=$("analystReportHistory");
 if(!count||!list)return;
 count.textContent=reports.length+" report"+(reports.length===1?"":"s");
 list.innerHTML=reports.length?reports.map((report,index)=>'<button class="analyst-history-item" type="button" data-analyst-report="'+index+'"><span><strong>'+esc(report.title||"Business analysis")+'</strong><small>'+esc(report.createdAt?new Date(report.createdAt).toLocaleString():"")+' · '+esc(report.period||"")+' · '+esc(report.currency||"")+'</small></span><b>Open report →</b></button>').join(""):'<div class="empty">No saved business analyses yet. Generate your first report above.</div>';
}
$("analystReportHistory").addEventListener("click",event=>{
 const button=event.target.closest("[data-analyst-report]");if(!button)return;
 const report=read("business_analysis_reports",[])[Number(button.dataset.analystReport)];if(!report)return;
 const savedComparison=report.periodComparison;
 const savedComparisonHtml=savedComparison?'<section class="card" style="margin:14px 0;padding:16px"><h3>Saved period comparison</h3><p class="muted small">Same currency only · '+esc(report.currency||"")+'</p><div class="table-wrap"><table><thead><tr><th>Metric</th><th>Current</th><th>Previous</th></tr></thead><tbody>'+[
  ["Invoiced",formatMoney(savedComparison.current.invoiced,report.currency),formatMoney(savedComparison.previous.invoiced,report.currency)],
  ["Marked collected",formatMoney(savedComparison.current.collected,report.currency),formatMoney(savedComparison.previous.collected,report.currency)],
  ["Recorded outstanding",formatMoney(savedComparison.current.outstanding,report.currency),formatMoney(savedComparison.previous.outstanding,report.currency)],
  ["Invoices",savedComparison.current.invoices,savedComparison.previous.invoices],
  ["New clients",savedComparison.current.newClients,savedComparison.previous.newClients]
 ].map(row=>'<tr><td>'+esc(row[0])+'</td><td>'+esc(row[1])+'</td><td>'+esc(row[2])+'</td></tr>').join("")+'</tbody></table></div></section>':'';
 $("analystResult").innerHTML='<section class="analyst-report-shell"><div class="analyst-report-header"><span class="ai-eyebrow">VEXT AI · MANAGEMENT INTELLIGENCE</span><span class="ai-document-badge">CONFIDENTIAL · BUSINESS</span></div><h2>Executive business report</h2><p class="muted small">Saved performance review</p><h3>'+esc(report.title||"Business analysis")+'</h3><div class="audit-report-date">'+esc(report.createdAt?new Date(report.createdAt).toLocaleString():"")+' · '+esc(report.period||"")+' · '+esc(report.currency||"")+'</div>'+savedComparisonHtml+'<div class="analyst-report-body">'+formatAuditReport(report.content||"No report text saved.")+'</div></section><div class="action-row" style="margin-top:16px"><button class="secondary" id="copyAnalystReport" type="button">Copy report</button></div>';
 $("copyAnalystReport").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(report.content||"");$("analystStatus").textContent="Saved report copied to clipboard.";}catch{$("analystStatus").textContent="Clipboard access was blocked. Select the report text and copy it manually.";}});
 $("analystStatus").textContent="Opened a saved report. Your history remains available in this workspace.";
});

    $("analyticsRange").addEventListener("change",()=>{renderAnalytics();$("analystResult").innerHTML="";$("analystStatus").textContent="Reporting period changed. Generate a fresh analysis to use the updated period.";});
$("runBusinessAnalysis").addEventListener("click",async()=>{
 const button=$("runBusinessAnalysis"),status=$("analystStatus"),result=$("analystResult");
 const code=currentCurrency(),range=$("analyticsRange").value,now=new Date();
 const cutoff=new Date(now);if(range!=="all")cutoff.setDate(cutoff.getDate()-Number(range));
 const inPeriod=value=>{if(!value)return false;const d=new Date(value);return !Number.isNaN(d.getTime())&&(range==="all"||d>=cutoff)&&d<=now;};
 const periodDays=range==="all"?null:Number(range);
 const previousCutoff=periodDays?new Date(cutoff.getTime()-periodDays*86400000):null;
 const inPreviousPeriod=value=>{if(!previousCutoff||!value)return false;const d=new Date(value);return !Number.isNaN(d.getTime())&&d>=previousCutoff&&d<cutoff;};
 const allInvoices=read("invoices"),allClients=read("leads");
 const invoices=allInvoices.filter(x=>x.currency===code&&inPeriod(x.date));
 const paid=invoices.filter(x=>x.status==="Paid"),unpaid=invoices.filter(x=>x.status!=="Paid");
 const today=now.toISOString().slice(0,10);
 const overdue=unpaid.filter(x=>x.dueDate&&x.dueDate<today);
 const total=invoices.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const collected=paid.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const previousInvoices=periodDays?allInvoices.filter(x=>x.currency===code&&inPreviousPeriod(x.date)):[];
 const previousPaid=previousInvoices.filter(x=>x.status==="Paid");
 const previousInvoiced=previousInvoices.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const previousCollected=previousPaid.reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const comparison=periodDays?{
  current:{invoiced:total,collected,outstanding:total-collected,invoices:invoices.length,newClients:allClients.filter(x=>inPeriod(x.created)).length},
  previous:{invoiced:previousInvoiced,collected:previousCollected,outstanding:previousInvoiced-previousCollected,invoices:previousInvoices.length,newClients:allClients.filter(x=>inPreviousPeriod(x.created)).length}
 }:null;
 const stages=["New","Contacted","Qualified","Proposal","Won","Lost"];
 const stageCounts=stages.map(stage=>({stage,count:allClients.filter(x=>getClientSalesStage(x)===stage).length}));
 const currencies=[...new Set(allInvoices.map(x=>String(x.currency||"").trim()).filter(Boolean))];
 const invoiceByMonth={};
 invoices.forEach(x=>{const d=new Date(x.date);if(Number.isNaN(d.getTime()))return;const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");invoiceByMonth[key]=(invoiceByMonth[key]||0)+(Number(x.amount)||0);});
 const input={
  reportingPeriod:range==="all"?"All recorded dates":"Last "+range+" days",
  selectedCurrency:code,
  totals:{clientRecords:allClients.length,newClientsInPeriod:allClients.filter(x=>inPeriod(x.created)).length,invoicesInPeriod:invoices.length,invoiced:total,markedPaidValue:collected,recordedOutstandingValue:total-collected,paidInvoiceCount:paid.length,unpaidInvoiceCount:unpaid.length,overdueInvoiceCount:overdue.length},
  periodComparison:comparison,
  salesPipeline:stageCounts,
  monthlyInvoiceTotals:invoiceByMonth,
  overdueInvoices:overdue.slice(0,30).map(x=>({invoiceNumber:x.number||"Not recorded",amount:Number(x.amount)||0,currency:x.currency,dueDate:x.dueDate||"Not recorded"})),
  currenciesPresent:currencies,
  dataNotes:["Only invoices in the selected currency and reporting period are included in financial totals.","Different currencies must never be added or converted; no exchange rates are available.","Payment status reflects what users marked in VEXT AI and is not independently verified.","Sales stages reflect saved client profile fields and may default to New.","Client contact details, private notes and enquiry text are intentionally excluded."]
 };
 button.disabled=true;button.textContent="Analysing records…";status.textContent="Preparing a secure, limited business summary for VEXT AI…";result.innerHTML="";
 try{
  const prompt="You are the VEXT AI Business Analyst. Prepare a concise, professional management briefing using only the structured data provided. Structure it as: Executive snapshot; What the numbers indicate; Sales pipeline observations; Risks and items to check; Recommended next actions (prioritised). A separate comparison table is displayed above this narrative, so do not repeat its row-by-row figures or create another Period comparison section. Interpret only the most important movement shown in that table; explain that percentage change is not meaningful where the previous value is zero. If periodComparison is null, do not invent a prior-period comparison. Include exact supplied figures where useful. Do not invent benchmarks, causes, forecasts, customer identities or missing facts. Distinguish observations from hypotheses. Never combine currencies or calculate exchange conversions. Explain that paid status is user-recorded, not independently bank-verified. Do not call invoice totals accounting revenue or profit. If there is little data, clearly say that and recommend what records to add. Do not request or expose personal customer information. Keep recommendations practical for a small business. Data: "+JSON.stringify(input);
  const token=await getVextAccessToken();
  const response=await fetch(VEXT_CHAT_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({message:prompt,history:[]})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||("Analysis request failed ("+response.status+")"));
  const report=typeof payload.reply==="string"?payload.reply:(typeof payload.output_text==="string"?payload.output_text:"");
  if(!report)throw new Error("The AI service returned an empty analysis.");
  const savedReport={id:id(),title:"Business analysis · "+input.reportingPeriod,createdAt:new Date().toISOString(),period:input.reportingPeriod,currency:code,content:report,summary:report.replace(/\s+/g," ").slice(0,240),metrics:input.totals,periodComparison:comparison};
  const savedReports=read("business_analysis_reports",[]);savedReports.unshift(savedReport);write("business_analysis_reports",savedReports.slice(0,50));
  const comparisonHtml=comparison?'<section class="card" style="margin:14px 0;padding:16px"><h3>Period comparison · '+esc(range)+' days vs previous '+esc(range)+' days</h3><p class="muted small">Same currency only · '+esc(code)+' · based on saved VEXT records.</p><div class="table-wrap"><table><thead><tr><th>Metric</th><th>Current period</th><th>Previous period</th></tr></thead><tbody>'+[
   ["Invoiced",formatMoney(comparison.current.invoiced,code),formatMoney(comparison.previous.invoiced,code)],
   ["Marked collected",formatMoney(comparison.current.collected,code),formatMoney(comparison.previous.collected,code)],
   ["Recorded outstanding",formatMoney(comparison.current.outstanding,code),formatMoney(comparison.previous.outstanding,code)],
   ["Invoices",comparison.current.invoices,comparison.previous.invoices],
   ["New clients",comparison.current.newClients,comparison.previous.newClients]
  ].map(row=>'<tr><td>'+esc(row[0])+'</td><td>'+esc(row[1])+'</td><td>'+esc(row[2])+'</td></tr>').join("")+'</tbody></table></div></section>':'<div class="notice" style="margin:14px 0">All-time reporting selected. A previous equal-length period is not available for comparison.</div>';
  result.innerHTML='<section class="analyst-report-shell"><div class="analyst-report-header"><span class="ai-eyebrow">VEXT AI · MANAGEMENT INTELLIGENCE</span><span class="ai-document-badge">CONFIDENTIAL · BUSINESS</span></div><h2>Executive business report</h2><p class="muted small">Performance review and operational priorities</p><div class="audit-report-date">Generated '+esc(new Date().toLocaleString())+' · '+esc(input.reportingPeriod)+' · '+esc(code)+'</div>'+comparisonHtml+'<div class="analyst-report-body">'+formatAuditReport(report)+'</div></section><div class="action-row" style="margin-top:16px"><button class="secondary" id="copyAnalystReport" type="button">Copy report</button></div>';
  $("copyAnalystReport").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(report);status.textContent="Report copied to clipboard.";}catch{status.textContent="Clipboard access was blocked. Select the report text and copy it manually.";}});
  renderAnalystHistory();renderManagementActions();
  status.textContent="Analysis complete. Report saved to your VEXT workspace. Review findings before making business decisions.";
 }catch(error){status.textContent="Could not generate the analysis: "+(error.message||"Please try again.");}
 finally{button.disabled=false;button.textContent="Generate business analysis";}
});

    return { renderAnalytics, renderAnalystHistory };
  }

  window.VEXTAnalytics = { init };
})();
