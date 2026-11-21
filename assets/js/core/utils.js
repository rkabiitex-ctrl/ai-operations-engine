"use strict";
(() => {
  const id = () => {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return String(Date.now()) + Math.random();
  };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const formatMoney = (value, code) => {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code, maximumFractionDigits: 2 }).format(Number(value) || 0);
    } catch {
      return code + " " + Number(value || 0).toFixed(2);
    }
  };
  globalThis.VEXTUtils = Object.freeze({ id, esc, formatMoney });
})();
