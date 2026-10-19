import { txBody } from "./model";
import { TRANSFER_CAT } from "./categories";
import { SCHEMA_VERSION, APP_ID } from "./constants";
import { Finance } from "./finance";
import { normalizeSettings, txIssues, normalizeTx } from "./model";

export function validateBackup(obj) {
  if (!obj || typeof obj !== "object") return { error: "O arquivo não contém um objeto JSON." };
  if (obj.app !== APP_ID) return { error: "Este arquivo não é um backup do Finance OS." };
  if (typeof obj.schemaVersion !== "number" || obj.schemaVersion > SCHEMA_VERSION) return { error: `Versão do backup (${obj.schemaVersion}) não suportada por esta versão do app.` };
  if (!obj.settings || !Array.isArray(obj.settings.accounts) || !obj.settings.accounts.length) return { error: "O backup não tem contas financeiras válidas." };
  if (!Array.isArray(obj.transactions)) return { error: "O backup não tem a lista de lançamentos." };
  const settings = normalizeSettings(obj.settings);
  const ids = new Set<string>(settings.accounts.map(a => a.id));
  const catIds = new Set<string>([...settings.categories.expense, ...settings.categories.income].map(c => c.id).concat(TRANSFER_CAT));
  const seen = new Set();
  for (let i = 0; i < obj.transactions.length; i++) {
    const t = obj.transactions[i];
    if (!t || typeof t.id !== "string" || !/^[A-Za-z0-9_.~:@+-]{1,120}$/.test(t.id)) return { error: `Lançamento ${i + 1}: identificador inválido.` };
    if (seen.has(t.id)) return { error: `Lançamento ${i + 1}: identificador duplicado.` };
    seen.add(t.id);
    const issues = txIssues(t, ids, catIds);
    if (issues.length) return { error: `Lançamento ${i + 1} (“${String(t.description || "").slice(0, 40)}”): campo inválido — ${issues.join(", ")}.` };
  }
  const txs = obj.transactions.map(t => normalizeTx(t.id, t));
  const dates = txs.map(t => t.date).sort();
  return { data: { settings, txs }, meta: { count: txs.length, accounts: settings.accounts.length, from: dates[0], to: dates[dates.length - 1], exportedAt: obj.exportedAt } };
}
export function buildBackup(settings, txs) {
  return JSON.stringify({ app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), settings, transactions: txs.map(t => ({ id: t.id, ...txBody(t) })) }, null, 2);
}
