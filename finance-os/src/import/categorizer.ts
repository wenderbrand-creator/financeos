import { TRANSFER_CAT, isTransfer, CAT_INDEX, CATS } from "../domain/categories";
import { D } from "../domain/dates";
import { uid } from "../domain/ids";
import { MAX_IMPORT, normDesc, hashStr } from "./parsers";

/* ---------- category suggestion: your history first, then keyword rules ---------- */
export const CAT_RULES: [string, string, RegExp][] = [
  ["expense", "compras", /mercado ?livre|magazine|magalu|shopee|amazon|aliexpress|shein|americanas|renner|riachuelo|\bzara\b|casas bahia|kabum|\bloja\b|shopping/],
  ["expense", "alimentacao", /ifood|rappi|restaurante|lanchonete|padaria|pizzaria|burger|mc ?donald|subway|supermerc|mercado|atacad|assai|carrefour|hortifruti|acougue|cafe|cafeteria|sorvete|delivery|\bbar\b/],
  ["expense", "transporte", /uber|\b99\b|cabify|posto|combust|gasolina|\bshell\b|ipiranga|petrobras|estacionamento|pedagio|sem parar|veloe|\bmetro\b|onibus|passagem/],
  ["expense", "assinaturas", /netflix|spotify|prime video|disney|\bhbo\b|\bmax\b|youtube|deezer|apple com|icloud|google|adobe|figma|canva|notion|chatgpt|openai|anthropic|claude|github|microsoft|office/],
  ["expense", "saude", /farmacia|drogaria|\bdroga|raia|pacheco|panvel|unimed|hospital|clinica|laboratorio|odonto|dentista|medic|psicolog|academia|smart ?fit/],
  ["expense", "moradia", /aluguel|condominio|energia|cemig|\benel\b|\blight\b|copasa|sabesp|\bagua\b|saneamento|internet|\bvivo\b|\bclaro\b|\btim\b|oi fibra/],
  ["expense", "impostos", /\bdas\b|simples nacional|iptu|ipva|darf|tarifa|anuidade|\biof\b|juros|multa|encargo/],
  ["expense", "educacao", /escola|colegio|faculdade|universidade|curso|udemy|alura|domestika|livraria|\blivro/],
  ["expense", "lazer", /cinema|ingresso|sympla|eventim|teatro|\bshow\b|steam|playstation|xbox|nintendo|hotel|airbnb|booking/],
  ["income", "salario", /salario|pro ?labore|folha de pag|\bvencimentos\b/],
  ["income", "rendimentos", /rendimento|dividend|\bcdb\b|tesouro|\bjcp\b/],
];
export function makeCategorizer(txs) {
  const history = new Map();
  for (const t of [...txs].sort((a, b) => a.updatedAt - b.updatedAt)) if (!isTransfer(t)) history.set(t.type + "|" + normDesc(t.description), t.category);
  const usable = (id, type) => CAT_INDEX[id] && CAT_INDEX[id].type === type && !CAT_INDEX[id].archived;
  const fallback = (type) => usable(type === "income" ? "outros-r" : "outros-d", type) ? (type === "income" ? "outros-r" : "outros-d") : (CATS[type].find(c => !c.archived) || {}).id || "";
  return (desc, type) => {
    const nd = normDesc(desc);
    const h = history.get(type + "|" + nd);
    if (h && usable(h, type)) return { id: h, learned: true };
    for (const [ty, id, re] of CAT_RULES) if (ty === type && re.test(nd) && usable(id, type)) return { id, learned: false };
    return { id: fallback(type), learned: false, unsure: true };
  };
}
export function detectBillPayment(nd, type, accType) {
  if (accType === "cartao") return type === "income" && /pagamento|pgto|pagto|pag fatura/.test(nd);
  return type === "expense" && (/fatura/.test(nd) || /(pagamento|pgto|pagto|\bpag\b).*(cartao|credito)/.test(nd));
}
export function buildImportRows(entries, account, txs, accounts) {
  const today = D.todayISO();
  const categorize = makeCategorizer(txs);
  const existing = txs.filter(t => t.accountId === account.id);
  const byImport = new Set(existing.map(t => t.importId).filter(Boolean));
  const sig = new Set(existing.map(t => `${t.date}|${t.amountCents}|${t.type}|${normDesc(t.description)}`));
  const others = accounts.filter(a => a.id !== account.id);
  const counterpart = account.type === "cartao" ? others.find(a => a.type !== "cartao") : others.find(a => a.type === "cartao");
  const occ = new Map();
  return entries.slice(0, MAX_IMPORT).map(e => {
    const type = e.cents > 0 ? "income" : "expense", amountCents = Math.abs(e.cents), nd = normDesc(e.description);
    const base = `${e.date}|${e.cents}|${nd}`, n = (occ.get(base) || 0) + 1; occ.set(base, n);
    // banks sometimes repeat the same document number / FITID on several lines (e.g. Sicredi PIX):
    // the first keeps the original id (re-imports still match), later ones get a counter
    let importId;
    if (e.fitid) {
      const fk = "fitid|" + e.fitid + "|" + e.date, k = (occ.get(fk) || 0) + 1; occ.set(fk, k);
      importId = "f" + hashStr(account.id + "|" + e.fitid + "|" + e.date) + (k > 1 ? "-" + k : "");
    } else importId = "h" + hashStr(account.id + "|" + base) + "-" + n;
    const dup = byImport.has(importId) || sig.has(`${e.date}|${amountCents}|${type}|${nd}`);
    const bill = detectBillPayment(nd, type, account.type);
    const cat = categorize(e.description, type);
    const action = bill ? (account.type === "cartao" ? "skip" : counterpart ? "transfer:" + counterpart.id : "normal") : "normal";
    return { key: importId, importId, date: e.date, description: e.description.slice(0, 80), amountCents, type, category: cat.id, learned: cat.learned, unsure: !!cat.unsure,
      dup, bill, action, include: !dup, status: account.type === "cartao" || e.date <= today ? "paid" : "pending" };
  });
}
export function rowsToTransactions(rows, accountId) {
  const now = Date.now(), list = [];
  for (const r of rows) {
    if (!r.include || r.action === "skip") continue;
    const base = { id: uid("t"), type: r.type, description: r.description, amountCents: r.amountCents, date: r.date, status: r.status, accountId, importId: r.importId, createdAt: now, updatedAt: now };
    if (r.action.startsWith("transfer:")) {
      const tid = uid("x"), other = r.action.slice(9);
      list.push({ ...base, category: TRANSFER_CAT, transferId: tid });
      list.push({ ...base, id: uid("t"), accountId: other, type: r.type === "expense" ? "income" : "expense", category: TRANSFER_CAT, transferId: tid, importId: r.importId + "-p" });
    } else list.push({ ...base, category: r.category });
  }
  return list;
}
