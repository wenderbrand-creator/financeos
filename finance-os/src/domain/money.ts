import { D } from "./dates";

/* =====================================================================
   2. MONEY (integer cents only) & DATES
   ===================================================================== */
export const Money = {
  fmt(cents) { return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); },
  plain(cents) { return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  fromDigits(str) { const d = String(str).replace(/\D/g, "").replace(/^0+/, "").slice(0, 13); return d ? parseInt(d, 10) : 0; },
  compact(cents) {
    const v = Math.abs(cents) / 100, s = cents < 0 ? "−" : "";
    if (v >= 1e6) return s + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
    if (v >= 1e3) return s + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
    return s + Math.round(v).toLocaleString("pt-BR");
  },
  isValid(c) { return Number.isSafeInteger(c) && c > 0 && c <= 99999999999; },
};
