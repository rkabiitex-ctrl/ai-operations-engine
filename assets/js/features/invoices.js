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
    const log = deps.log;
    const refreshWorkspace = deps.render;

    function invoiceIsOverdue(invoice) {
      return invoice.status !== "Paid" && !!invoice.dueDate &&
        invoice.dueDate < new Date().toISOString().slice(0, 10);
    }

    function renderInvoices() {
      const all = read("invoices");
      const code = currentCurrency();
      const invoices = all.filter(item => item.currency === code);
      const paid = invoices.filter(item => item.status === "Paid");
      const overdue = invoices.filter(invoiceIsOverdue);
      const total = invoices.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const collected = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);

      $("invoiceCurrencyLabel").textContent = code;
      $("invoiceKpiCount").textContent = invoices.length;
      $("invoiceKpiTotal").textContent = formatMoney(total, code);
      $("invoiceKpiPaid").textContent = formatMoney(collected, code);
      $("invoiceKpiOutstanding").textContent = formatMoney(total - collected, code);
      $("invoiceKpiOverdue").textContent = overdue.length + " overdue invoice" + (overdue.length === 1 ? "" : "s");

      const clients = read("leads");
      $("invoiceClientOptions").innerHTML = clients.map(item =>
        item.name ? '<option value="' + esc(item.name) + '"></option>' : ""
      ).join("");

      const query = String($("invoiceSearch")?.value || "").trim().toLowerCase();
      const filter = $("invoiceStatusFilter")?.value || "all";
      const visible = invoices.filter(item => {
        const matches = !query ||
          String(item.number || "").toLowerCase().includes(query) ||
          String(item.client || "").toLowerCase().includes(query);
        const state = invoiceIsOverdue(item) ? "Overdue" : (item.status || "Unpaid");
        return matches && (filter === "all" || filter === state);
      });

      $("invoiceRegisterCount").textContent = visible.length + " of " + invoices.length + " records";
      $("invoiceTable").innerHTML = visible.length ? (
        '<table><thead><tr><th>Invoice</th><th>Customer</th><th>Issue date</th><th>Due date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
        visible.map(item => {
          const overdueNow = invoiceIsOverdue(item);
          const status = overdueNow ? "Overdue" : (item.status || "Unpaid");
          return '<tr>' +
            '<td><span class="invoice-number">' + esc(item.number || "Unnumbered") + '</span><span class="invoice-description">' + esc(item.description || "") + '</span></td>' +
            '<td><span class="invoice-customer">' + esc(item.client || "Unnamed customer") + '</span></td>' +
            '<td class="invoice-date-cell">' + (item.date ? esc(new Date(item.date).toLocaleDateString()) : "—") + '</td>' +
            '<td class="invoice-date-cell">' + (item.dueDate ? esc(new Date(item.dueDate + "T00:00:00").toLocaleDateString()) : '<span class="muted">Not set</span>') +
              (overdueNow ? '<div class="invoice-overdue-note">Past due</div>' : "") + '</td>' +
            '<td><strong>' + formatMoney(item.amount, item.currency) + '</strong></td>' +
            '<td><span class="invoice-status ' + (overdueNow ? "overdue" : status === "Paid" ? "paid" : "unpaid") + '">' + status + '</span></td>' +
            '<td><div class="invoice-actions"><button class="secondary" data-edit-invoice="' + esc(item.id) + '">Edit</button>' +
              '<button class="secondary" data-print="' + esc(item.id) + '">Print</button>' +
              '<button class="secondary" data-paid="' + esc(item.id) + '">' + (item.status === "Paid" ? "Mark unpaid" : "Mark paid") + '</button>' +
              '<button class="danger" data-delete-invoice="' + esc(item.id) + '">Delete</button></div></td></tr>';
        }).join("") +
        '</tbody></table>'
      ) : '<div class="empty">No invoices match this view. Create an invoice or adjust your search and filters.</div>';
    }

    function closeInvoiceEditor() {
      $("invoiceEditModal").hidden = true;
    }

    $("invDate").value = new Date().toISOString().slice(0, 10);
    $("invoiceSearch").addEventListener("input", renderInvoices);
    $("invoiceStatusFilter").addEventListener("change", renderInvoices);

    $("invoiceForm").addEventListener("submit", event => {
      event.preventDefault();
      const amount = Number($("invAmount").value);
      const issueDate = $("invDate").value;
      const dueDate = $("invDueDate").value;
      if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid amount.");
        return;
      }
      if (!issueDate || !dueDate) {
        alert("Enter both the issue date and due date.");
        return;
      }
      if (dueDate < issueDate) {
        alert("The due date cannot be earlier than the issue date.");
        return;
      }
      const invoices = read("invoices");
      const number = "VX-" + new Date().getFullYear() + "-" + String(invoices.length + 1).padStart(4, "0");
      invoices.push({
        id: id(),
        number,
        client: $("invClient").value.trim(),
        description: $("invDescription").value.trim(),
        amount,
        currency: $("invCurrency").value,
        status: "Unpaid",
        date: new Date(issueDate + "T12:00:00").toISOString(),
        dueDate
      });
      write("invoices", invoices);
      event.target.reset();
      $("invDate").value = new Date().toISOString().slice(0, 10);
      $("invCurrency").value = currentCurrency();
      log("Invoice " + number + " created.");
      refreshWorkspace();
    });

    $("invoiceTable").addEventListener("click", event => {
      const edit = event.target.closest("[data-edit-invoice]");
      if (edit) {
        const invoice = read("invoices").find(item => item.id === edit.dataset.editInvoice);
        if (!invoice) return;
        $("editInvoiceId").value = invoice.id;
        $("editInvoiceClient").value = invoice.client || "";
        $("editInvoiceDescription").value = invoice.description || "";
        $("editInvoiceIssueDate").value = invoice.date ? new Date(invoice.date).toISOString().slice(0, 10) : "";
        $("editInvoiceDueDate").value = invoice.dueDate || "";
        $("editInvoiceAmount").value = Number(invoice.amount || 0);
        $("editInvoiceCurrency").innerHTML = $("invCurrency").innerHTML;
        $("editInvoiceCurrency").value = invoice.currency || currentCurrency();
        $("invoiceEditStatus").textContent = "";
        $("invoiceEditModal").hidden = false;
        $("editInvoiceClient").focus();
        return;
      }

      const paid = event.target.closest("[data-paid]");
      const del = event.target.closest("[data-delete-invoice]");
      const print = event.target.closest("[data-print]");

      if (paid) {
        const all = read("invoices");
        const invoice = all.find(item => item.id === paid.dataset.paid);
        if (invoice) invoice.status = invoice.status === "Paid" ? "Unpaid" : "Paid";
        write("invoices", all);
        log("Invoice payment status updated.");
        refreshWorkspace();
      }

      if (del) {
        if (!confirm("Delete this invoice?")) return;
        write("invoices", read("invoices").filter(item => item.id !== del.dataset.deleteInvoice));
        log("Invoice deleted.");
        refreshWorkspace();
      }

      if (print) {
        const invoice = read("invoices").find(item => item.id === print.dataset.print);
        if (!invoice) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          alert("Allow pop-ups to print invoices.");
          return;
        }
        printWindow.document.write(
          '<!doctype html><html><head><title>' + esc(invoice.number) + '</title>' +
          '<style>body{font:16px Arial;padding:45px;color:#172033}h1{color:#087da8}hr{border:0;border-top:1px solid #ccc}.total{font-size:25px;font-weight:bold;margin-top:35px}</style>' +
          '</head><body><h1>VEXT AI</h1><h2>INVOICE</h2><hr>' +
          '<p>Invoice: ' + esc(invoice.number) + '</p>' +
          '<p>Date: ' + esc(new Date(invoice.date).toLocaleDateString()) + '</p>' +
          '<p>Customer: ' + esc(invoice.client) + '</p>' +
          '<p>Description: ' + esc(invoice.description) + '</p>' +
          '<p>Due date: ' + esc(invoice.dueDate || "Not set") + '</p>' +
          '<p>Status: ' + esc(invoice.status) + '</p><hr>' +
          '<div class="total">Total: ' + esc(formatMoney(invoice.amount, invoice.currency)) + '</div>' +
          '<p>Thank you for your business.</p><script>window.onload=()=>window.print()<\/script></body></html>'
        );
        printWindow.document.close();
      }
    });

    function closeEditorIfBackdrop(event) {
      if (event.target === $("invoiceEditModal")) closeInvoiceEditor();
    }
    $("closeInvoiceEdit").addEventListener("click", closeInvoiceEditor);
    $("cancelInvoiceEdit").addEventListener("click", closeInvoiceEditor);
    $("invoiceEditModal").addEventListener("click", closeEditorIfBackdrop);

    $("invoiceEditForm").addEventListener("submit", event => {
      event.preventDefault();
      const all = read("invoices");
      const invoice = all.find(item => item.id === $("editInvoiceId").value);
      if (!invoice) {
        $("invoiceEditStatus").textContent = "This invoice could not be found. Refresh and try again.";
        return;
      }
      const issueDate = $("editInvoiceIssueDate").value;
      const dueDate = $("editInvoiceDueDate").value;
      const amount = Number($("editInvoiceAmount").value);
      if (!issueDate || !dueDate) {
        $("invoiceEditStatus").textContent = "Enter both the issue date and due date.";
        return;
      }
      if (dueDate < issueDate) {
        $("invoiceEditStatus").textContent = "The due date cannot be earlier than the issue date.";
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        $("invoiceEditStatus").textContent = "Enter a valid amount greater than zero.";
        return;
      }
      invoice.client = $("editInvoiceClient").value.trim();
      invoice.description = $("editInvoiceDescription").value.trim();
      invoice.date = new Date(issueDate + "T12:00:00").toISOString();
      invoice.dueDate = dueDate;
      invoice.amount = amount;
      invoice.currency = $("editInvoiceCurrency").value;
      write("invoices", all);
      log("Invoice " + (invoice.number || "record") + " details updated.");
      closeInvoiceEditor();
      refreshWorkspace();
    });

    return renderInvoices;
  }

  globalThis.VEXTInvoices = Object.freeze({ init });
})();
