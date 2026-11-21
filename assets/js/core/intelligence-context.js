"use strict";
(() => {
  const asArray = value => Array.isArray(value) ? value : [];
  const amount = value => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };
  const validDate = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const countBy = (items, getKey) => items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  function build({ read, currentCurrency, business = "", country = "" } = {}) {
    if (typeof read !== "function") throw new TypeError("VEXT context requires the workspace read function.");
    const invoices = asArray(read("invoices", []));
    const clients = asArray(read("leads", []));
    const audits = asArray(read("audit_reports", []));
    const actions = asArray(read("management_actions", []));
    const tasks = asArray(read("nexus_tasks", []));
    const currency = typeof currentCurrency === "function" ? String(currentCurrency() || "USD") : "USD";
    const selectedInvoices = invoices.filter(item => String(item.currency || "") === currency);
    const paid = selectedInvoices.filter(item => item.status === "Paid");
    const unpaid = selectedInvoices.filter(item => item.status !== "Paid");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueInvoices = unpaid.filter(item => {
      const due = validDate(item.dueDate);
      return due && due < today;
    });
    const followUpsOverdue = clients.filter(item => {
      if (!item.nextFollowUpDate) return false;
      return item.nextFollowUpDate < today.toISOString().slice(0, 10);
    });
    const salesStages = countBy(clients, item => {
      const stage = String(item.salesStage || item.sales_stage || item.status || "New").trim();
      return ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"].includes(stage) ? stage : "Other";
    });
    const actionStatuses = countBy(actions, item => {
      const status = String(item.status || "Pending");
      return ["Pending", "In Progress", "Completed"].includes(status) ? status : "Other";
    });
    const localToday = new Date();
    const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    const todayKey = dateKey(localToday);
    const weekAhead = new Date(localToday);
    weekAhead.setDate(weekAhead.getDate() + 7);
    const weekAheadKey = dateKey(weekAhead);
    const activeActions = actions.filter(item => item.status !== "Completed");
    const overdueActions = activeActions.filter(item => {
      const due = String(item.dueDate || "").slice(0, 10);
      return /^\\d{4}-\\d{2}-\\d{2}$/.test(due) && due < todayKey;
    });
    const dueSoonActions = activeActions.filter(item => {
      const due = String(item.dueDate || "").slice(0, 10);
      return /^\\d{4}-\\d{2}-\\d{2}$/.test(due) && due >= todayKey && due <= weekAheadKey;
    });
    const completedActions = actions.filter(item => item.status === "Completed");
    const taskStatuses = countBy(tasks, item => String(item.status || "Unknown"));
    return {
      business: String(business || "VEXT AI").slice(0, 100),
      country: String(country || "").slice(0, 80),
      generatedAt: new Date().toISOString(),
      financials: {
        reportingCurrency: currency,
        invoiceCount: selectedInvoices.length,
        invoicedAmount: selectedInvoices.reduce((sum, item) => sum + amount(item.amount), 0),
        markedPaidCount: paid.length,
        markedPaidAmount: paid.reduce((sum, item) => sum + amount(item.amount), 0),
        unpaidCount: unpaid.length,
        overdueCount: overdueInvoices.length,
        currencyRule: "Only the selected reporting currency is included. Paid means the invoice record is marked Paid; this is not bank verification."
      },
      customerPipeline: {
        clientRecordCount: clients.length,
        salesStages,
        overdueFollowUpCount: followUpsOverdue.length
      },
      governance: {
        savedAuditReportCount: audits.length,
        latestAuditIssueCount: audits.length && Number.isFinite(Number(audits[0].issueCount)) ? Number(audits[0].issueCount) : null,
        managementActionCount: actions.length,
        managementActionStatuses: actionStatuses,
        actionExecution: {
          activeCount: activeActions.length,
          completedCount: completedActions.length,
          overdueCount: overdueActions.length,
          dueWithinSevenDaysCount: dueSoonActions.length,
          unassignedActiveCount: activeActions.filter(item => !String(item.owner || "").trim()).length,
          linkedToNexusCount: actions.filter(item => Boolean(item.sourceNexusTaskId)).length,
          completionRatePercent: actions.length ? Math.round((completedActions.length / actions.length) * 100) : 0,
          dateReference: todayKey,
          rules: "Overdue and due-soon counts use saved due dates and exclude completed actions. Completion rate is based on saved action statuses, not independent verification."
        }
      },
      nexus: {
        assignmentCount: tasks.length,
        taskStatuses
      },
      privacy: {
        included: "Aggregated counts, totals and status summaries only.",
        excluded: "Customer names, email addresses, phone numbers, enquiry messages, internal notes, invoice descriptions, and full report contents are not included."
      },
      limitations: [
        "Workspace records may be incomplete, outdated or user-entered; they are not independently verified.",
        "Invoice totals are issued amounts, not accounting revenue or profit.",
        "Payment status reflects saved invoice records, not bank or payment-provider confirmation.",
        "Different currencies are never combined or converted."
      ]
    };
  }

  window.VEXTContext = Object.freeze({ build });
})();
