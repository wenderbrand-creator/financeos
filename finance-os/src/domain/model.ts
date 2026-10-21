import { CAT_COLORS, defaultCategories, normalizeCategories } from "./categories";
import { SCHEMA_VERSION, ACCOUNT_TYPES } from "./constants";
import { D } from "./dates";
import { Money } from "./money";

/* =====================================================================
   4. DATA MODEL — normalize / validate (non-destructive, tolerant reads)
   ===================================================================== */
export function defaultSettings(): any {
  return { schemaVersion: SCHEMA_VERSION, profileName: "", accounts: [{ id: "acc-main", name: "Conta principal", type: "corrente", openingCents: 0 }], categories: defaultCategories() };
}
export function normalizeSettings(raw) {
  const d = defaultSettings();
  if (!raw || typeof raw !== "object") return d;
  const accounts = Array.isArray(raw.accounts) ? raw.accounts.filter(a => a && typeof a.id === "string" && typeof a.name === "string")
    .map(a => {
      const acc = { id: a.id, name: a.name, type: ACCOUNT_TYPES[a.type] ? a.type : "outra", openingCents: Number.isSafeInteger(a.openingCents) ? a.openingCents : 0 };
      if (acc.type === "cartao") {
        const day = (v, dflt) => Number.isInteger(v) && v >= 1 && v <= 31 ? v : dflt;
        Object.assign(acc, { closingDay: day(a.closingDay, 3), dueDay: day(a.dueDay, 10), limitCents: Number.isSafeInteger(a.limitCents) && a.limitCents > 0 ? a.limitCents : 0, color: CAT_COLORS.includes(a.color) ? a.color : "c1" });
      }
      return acc;
    }) : [];
  return { ...raw, schemaVersion: raw.schemaVersion || SCHEMA_VERSION, profileName: typeof raw.profileName === "string" ? raw.profileName : d.profileName, accounts: accounts.some(a => a.type !== "cartao") ? accounts : [...d.accounts, ...accounts], categories: normalizeCategories(raw.categories),
    rules: normalizeRules(raw.rules), budgets: normalizeBudgets(raw.budgets) };
}
/** "When the description contains X, use category Y" — created from imports or by hand. */
export function normalizeRules(raw): { id: string; type: "income" | "expense"; match: string; category: string }[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.filter(r => r && (r.type === "income" || r.type === "expense") && typeof r.match === "string" && typeof r.category === "string")
    .map(r => ({ id: typeof r.id === "string" ? r.id.slice(0, 60) : r.type + ":" + r.match, type: r.type, match: r.match.trim().slice(0, 40), category: r.category.slice(0, 64) }))
    .filter(r => r.match.length >= 2 && !seen.has(r.type + "|" + r.match) && seen.add(r.type + "|" + r.match))
    .slice(0, 300);
}
/** Monthly spending limit per expense category, in cents. */
export function normalizeBudgets(raw): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (typeof k === "string" && k.length <= 64 && Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 99999999999) out[k] = v as number;
  return out;
}
export function txIssues(t: any, accountIds?: Set<string> | null, catIds?: Set<string> | null) {
  const e = [];
  if (!t || typeof t !== "object") return ["registro inválido"];
  if (typeof t.description !== "string" || !t.description.trim()) e.push("descrição");
  if (!Money.isValid(t.amountCents)) e.push("valor em centavos");
  if (t.type !== "income" && t.type !== "expense") e.push("tipo");
  if (catIds ? !catIds.has(t.category) : (typeof t.category !== "string" || !t.category)) e.push("categoria");
  if (!D.valid(t.date)) e.push("data");
  if (t.status !== "paid" && t.status !== "pending") e.push("status");
  if (accountIds && !accountIds.has(t.accountId)) e.push("conta");
  return e;
}
export function normalizeTx(id: string, raw: any): any {
  if (!raw) return null;
  const t: any = { id, description: raw.description, amountCents: raw.amountCents, type: raw.type, category: raw.category, date: raw.date, status: raw.status, accountId: raw.accountId, createdAt: raw.createdAt || 0, updatedAt: raw.updatedAt || 0 };
  if (typeof raw.importId === "string") t.importId = raw.importId;
  if (typeof raw.transferId === "string") t.transferId = raw.transferId;
  if (typeof raw.billMonth === "string" && /^\d{4}-\d{2}$/.test(raw.billMonth)) t.billMonth = raw.billMonth;
  if (typeof raw.seriesId === "string" && Number.isInteger(raw.seriesIndex) && Number.isInteger(raw.seriesTotal)) { t.seriesId = raw.seriesId; t.seriesIndex = raw.seriesIndex; t.seriesTotal = raw.seriesTotal; }
  return txIssues(t).length ? null : t;
}
export function txBody(t) {
  return { v: SCHEMA_VERSION, description: t.description, amountCents: t.amountCents, type: t.type, category: t.category, date: t.date, status: t.status, accountId: t.accountId, createdAt: t.createdAt, updatedAt: t.updatedAt,
    ...(t.seriesId ? { seriesId: t.seriesId, seriesIndex: t.seriesIndex, seriesTotal: t.seriesTotal } : {}),
    ...(t.importId ? { importId: t.importId } : {}), ...(t.transferId ? { transferId: t.transferId } : {}), ...(t.billMonth ? { billMonth: t.billMonth } : {}) };
}
