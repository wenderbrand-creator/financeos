import { isCard } from "../domain/cards";
import { pad, D } from "../domain/dates";

/* =====================================================================
   IMPORT — bank statements and credit-card bills (OFX / CSV)
   Pure parsing + matching first, then the 3-step modal (Arquivo → Revisar → Pronto).
   ===================================================================== */
export const MAX_IMPORT = 1500;
export const stripAccents = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normDesc = (s) => stripAccents(String(s).toLowerCase()).replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 28);
export function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
export const range = (n) => Array.from({ length: n }, (_, i) => i);

/** "1.234,56" · "-1234.56" · "R$ 12,00 D" · "(12,00)" → signed integer cents, or null */
export function parseAmountCents(raw: any, decimal?: string | null) {
  if (raw == null) return null;
  let s = String(raw).trim(); if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/R\$|BRL/gi, "").replace(/\s+/g, "").replace(/[−–]/g, "-");
  if (/[dD]$/.test(s)) { neg = !neg; s = s.slice(0, -1); } else if (/[cC]$/.test(s)) s = s.slice(0, -1);
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) { neg = !neg; s = s.slice(0, -1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  let sep = null;
  if (decimal && s.includes(decimal)) sep = decimal;
  else if (lastDot >= 0 && lastComma >= 0) sep = lastDot > lastComma ? "." : ",";
  else if (lastComma >= 0) sep = /^\d{1,3}(,\d{3})+$/.test(s) ? null : ",";
  else if (lastDot >= 0) sep = /^\d{1,3}(\.\d{3})+$/.test(s) ? null : ".";
  let intPart = s, dec = "";
  if (sep) { const i = s.lastIndexOf(sep); intPart = s.slice(0, i); dec = s.slice(i + 1); }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(dec)) return null;
  let cents = parseInt(intPart || "0", 10) * 100 + parseInt((dec + "00").slice(0, 2), 10);
  if (dec.length > 2 && +dec[2] >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return null;
  return neg ? -cents : cents;
}
export function parseDateAny(raw) {
  const s = String(raw || "").trim(); let m;
  const chk = (y, mo, d) => { const iso = `${y}-${pad(+mo)}-${pad(+d)}`; return D.valid(iso) ? iso : null; };
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return chk(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/))) { let y = m[3]; if (y.length === 2) y = (+y > 70 ? "19" : "20") + y; if (y.length !== 4) return null; return chk(y, m[2], m[1]); }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return chk(m[1], m[2], m[3]);
  return null;
}
export function decodeFile(buf) {
  let t;
  try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { t = new TextDecoder("windows-1252").decode(buf); }
  return t.replace(/^﻿/, "");
}
export const htmlDecode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

export function parseOFX(text: string): any {
  const isCard = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(text);
  const bank = (text.match(/<ORG>\s*([^<\r\n]+)/i) || [])[1] || "";
  const blocks = text.split(/<STMTTRN>/i).slice(1).map(b => b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]);
  const tag = (b, n) => { const m = b.match(new RegExp("<" + n + ">\\s*([^<\\r\\n]*)", "i")); return m ? htmlDecode(m[1].trim()) : ""; };
  const entries = []; let bad = 0;
  for (const b of blocks) {
    const date = parseDateAny(tag(b, "DTPOSTED").slice(0, 8));
    const amt = tag(b, "TRNAMT");
    const cents = parseAmountCents(amt, amt.includes(".") ? "." : null);
    const description = (tag(b, "MEMO") || tag(b, "NAME") || tag(b, "PAYEE")).replace(/\s+/g, " ").trim();
    if (!date || cents === null || cents === 0) { bad++; continue; }
    entries.push({ date, cents, description: description || "Sem descrição", fitid: tag(b, "FITID") });
  }
  return { format: "ofx", kind: isCard ? "card" : "bank", bank: bank.trim(), entries, bad };
}

export function splitCSVLine(line, d) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(c => c.trim());
}
export function parseCSV(text: string): any {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { error: "O arquivo está vazio." };
  const count = (ch) => lines.slice(0, 15).reduce((s, l) => s + splitCSVLine(l, ch).length - 1, 0);
  const delim = [";", ",", "\t", "|"].sort((a, b) => count(b) - count(a))[0];
  const rows = lines.map(l => splitCSVLine(l, delim));
  const hasDate = r => r.some(c => parseDateAny(c));
  const first = rows.findIndex(hasDate);
  if (first < 0) return { error: "Não encontrei datas neste arquivo. Confira se é um extrato ou fatura exportado em CSV." };
  const headerRow = first > 0 && !hasDate(rows[first - 1]) ? rows[first - 1] : null;
  const records = rows.slice(first).filter(r => r.length >= 2);
  const width = Math.max(...records.slice(0, 30).map(r => r.length));
  const headers = range(width).map(i => (headerRow && headerRow[i]) ? headerRow[i] : `Coluna ${i + 1}`);
  const map = autoMapCSV(headers, records);
  const h = headers.map(x => stripAccents(x.toLowerCase()));
  const looksCard = h.includes("title") && h.includes("amount"); // fatura exportada pelo Nubank
  return { format: "csv", headers, records, map, looksCard, delim };
}
export function autoMapCSV(headers, records) {
  const h = headers.map(x => stripAccents(x.toLowerCase()).trim());
  const find = (re, not = []) => h.findIndex((x, i) => re.test(x) && !not.includes(i));
  const sample = records.slice(0, 25);
  const score = (i, fn) => sample.filter(r => fn(r[i])).length;
  let date = find(/^(data|date|dt)\b|data/);
  let id = find(/identificador|fitid|^id$|^documento$/);
  let amount = find(/^(valor|amount|value|quantia|montante)|valor/);
  let credit = find(/credito|entrada/), debit = find(/debito|saida/);
  if (date < 0) date = range(headers.length).sort((a, b) => score(b, parseDateAny) - score(a, parseDateAny))[0];
  const isNum = v => v != null && /\d/.test(v) && parseAmountCents(v) !== null && !parseDateAny(v);
  if (amount < 0 && !(credit >= 0 && debit >= 0)) amount = range(headers.length).filter(i => i !== date && i !== id).sort((a, b) => score(b, isNum) - score(a, isNum))[0] ?? -1;
  let desc = find(/descri|title|titulo|historico|lancamento|estabelecimento|memo|detalhe|^nome|favorecido/, [date, amount, id]);
  if (desc < 0) { const len = i => sample.reduce((s, r) => s + String(r[i] || "").length, 0); desc = range(headers.length).filter(i => ![date, amount, id, credit, debit].includes(i)).sort((a, b) => len(b) - len(a))[0] ?? -1; }
  if (amount >= 0) { credit = -1; debit = -1; }
  return { date, desc, amount, credit, debit, id };
}
export function csvToEntries(csv, map, positiveIsIncome) {
  const entries = []; let bad = 0, balance = 0;
  for (const r of csv.records) {
    const date = parseDateAny(r[map.date]);
    let cents = null;
    if (map.amount >= 0) { cents = parseAmountCents(r[map.amount]); if (cents !== null && !positiveIsIncome) cents = -cents; }
    else if (map.credit >= 0 || map.debit >= 0) {
      const c = map.credit >= 0 ? parseAmountCents(r[map.credit]) : null, d = map.debit >= 0 ? parseAmountCents(r[map.debit]) : null;
      if (c !== null || d !== null) cents = Math.abs(c || 0) - Math.abs(d || 0);
    }
    const description = (map.desc >= 0 ? r[map.desc] : "") || "";
    if (/^(saldo|saldo do dia|saldo anterior|saldo final|saldo disponivel|s a l d o)\b/.test(normDesc(description))) { balance++; continue; }
    if (!date || cents === null || cents === 0) { bad++; continue; }
    entries.push({ date, cents, description: description.replace(/\s+/g, " ").trim() || "Sem descrição", fitid: map.id >= 0 ? (r[map.id] || "") : "" });
  }
  return { entries, bad, balance };
}
