/* =====================================================================
   PDF statements and card bills
   Most Brazilian banks only export PDF. The text is read in the browser
   (pdf.js, loaded on demand) — the file never leaves the device.
   1. extractPdfLines: PDF → visual lines of text (items grouped by row)
   2. parsePdfLines:  lines → { entries, bad, balance, dueDate, kind }
   ===================================================================== */
import { parseDateAny, normDesc, stripAccents } from "./parsers";
import { D, pad } from "../domain/dates";

/** PDF bytes → text lines in reading order (one per visual row). */
export async function extractPdfLines(buf: ArrayBuffer): Promise<string[]> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false }).promise;
  try {
    if (doc.numPages > 60) throw Object.assign(new Error("pages"), { code: "too_many_pages" });
    const lines: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      lines.push(...groupRows(tc.items.filter((it: any) => typeof it.str === "string" && it.str.trim())));
      page.cleanup();
    }
    return lines;
  } finally { doc.destroy(); }
}

/** pdf.js text items → rows. Items whose baselines are within ~40% of the font height share a row. */
export function groupRows(items: any[]): string[] {
  const rows: { y: number; h: number; parts: { x: number; w: number; s: string }[] }[] = [];
  for (const it of items) {
    const x = it.transform[4], y = it.transform[5], h = Math.abs(it.height || it.transform[3] || 10);
    let row = rows.find(r => Math.abs(r.y - y) <= Math.max(2, Math.min(r.h, h) * 0.4));
    if (!row) { row = { y, h, parts: [] }; rows.push(row); }
    row.parts.push({ x, w: it.width || 0, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map(r => {
    r.parts.sort((a, b) => a.x - b.x);
    let out = "", end = -Infinity;
    for (const p of r.parts) {
      const gap = p.x - end;
      out += out ? (gap > r.h * 1.5 ? "   " : gap > 0.5 ? " " : "") : "";
      out += p.s; end = p.x + p.w;
    }
    return out.replace(/\s+$/, "");
  }).filter(Boolean);
}

/* ---------- parsing ---------- */
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// value at the end of the line: "- R$ 21,50" · "+R$ 38,00" · "1.234,56" · "1.234,56 D" · "(12,00)" · "12,00-"
const AMOUNT_END = /(?:^|\s)(\(?)([-+−–]?)\s*(?:R\$\s*)?([-+−–]?)\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\)?\s*(-|[CD]|CR|DB)?$/i;
const DATE_START = /^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?(?!\d)/;
const DATE_ABBR = /^(\d{1,2})\s*[\/ ]\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*[\/ ]\s*(\d{2,4}))?\b/i;
// lines that carry a date and a value but are not movements
const NOT_MOVEMENT = /^(saldo|s a l d o|total|subtotal|limite|pagamento minimo|valor minimo|taxa|juros do rotativo|cet\b|iof do rotativo|encargos do rotativo|vencimento|fechamento|melhor dia)/;
// money in (unsigned values): keywords — used only when the PDF does not mark the sign
const IN_WORDS = /\b(recebimento|recebido|credito em conta|deposito|salario|estorno|devolucao|reembolso|rendimento|resgate|transferencia recebida|ted recebida|doc recebido|pix recebido|liberacao de credito|cashback)\b/;
const OUT_WORDS = /\b(pagamento|pgto|compra|debito|tarifa|iof|juros|saque|anuidade|transferencia enviada|pix enviado|ted enviada|boleto|cheque especial|seguro|mensalidade)\b/;

const addDays = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const cleanDesc = (s: string) => s.replace(/\s{2,}/g, " ").replace(/^[\s\-–|:]+|[\s\-–|:]+$/g, "").trim();

/**
 * lines → movements. Sign rules:
 * - explicit "+", "C", "CR"  → money in
 * - explicit "-", "D", "DB", "( )" → money out on statements; on card bills a "-" line is a credit (refund/payment)
 * - no sign → card bill: purchase; statement: decided by keywords (recebimento, compra, tarifa…), else money out
 */
export function parsePdfLines(lines: string[], opts: { card?: boolean; today?: string } = {}) {
  const text = stripAccents(lines.join("\n").toLowerCase());
  const kind = /fatura|cartao de credito|limite de credito|pagamento minimo/.test(text) && !/extrato de conta|conta corrente/.test(text) ? "card" : "bank";
  const card = opts.card ?? kind === "card";
  const today = opts.today || D.todayISO();
  // reference date to place "dd/mm" without a year: due date of the bill, else the latest full date in the file
  const dueM = text.match(/vencimento[^0-9]{0,40}(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/);
  const dueDate = dueM ? parseDateAny(dueM[1]) : null;
  let ref = dueDate;
  if (!ref) for (const m of text.matchAll(/\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})\b/g)) { const d = parseDateAny(m[1]); if (d && d <= addDays(today, 400) && (!ref || d > ref)) ref = d; }
  ref = ref || today;
  const withYear = (dd: number, mm: number) => {
    let y = +ref.slice(0, 4);
    let iso = `${y}-${pad(mm)}-${pad(dd)}`;
    if (D.valid(iso) && iso > addDays(ref, 45)) iso = `${--y}-${pad(mm)}-${pad(dd)}`;
    return D.valid(iso) ? iso : null;
  };

  const entries: any[] = []; let bad = 0, balance = 0;
  for (const raw of lines) {
    const line = raw.trim();
    // the date may come after a short column (e.g. last card digits); look in the first 14 chars
    const lead = line.slice(0, 40);
    let date: string | null = null, rest = line;
    const at = lead.search(/\d{1,2}\s*[\/.-]\s*\d{1,2}|\d{1,2}\s*[\/ ]\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);
    if (at < 0 || at > 14) continue;
    const s = line.slice(at);
    let m = s.match(DATE_START), m2 = !m && s.match(DATE_ABBR);
    if (m) {
      date = m[3] ? parseDateAny(`${m[1]}/${m[2]}/${m[3]}`) : withYear(+m[1], +m[2]);
      rest = s.slice(m[0].length);
    } else if (m2) {
      const mm = MONTH_ABBR.indexOf(m2[2].toLowerCase().slice(0, 3)) + 1;
      date = m2[3] ? parseDateAny(`${m2[1]}/${mm}/${m2[3]}`) : withYear(+m2[1], mm);
      rest = s.slice(m2[0].length);
    } else continue;
    const a = rest.match(AMOUNT_END);
    if (!date || !a) { if (date) bad++; continue; }
    let desc = cleanDesc(rest.slice(0, a.index));
    const nd = normDesc(desc), full = stripAccents(desc.toLowerCase());
    if (!desc || NOT_MOVEMENT.test(full)) { if (/^saldo/.test(full)) balance++; continue; }
    const cents = Math.round(parseFloat(a[4].replace(/\./g, "").replace(",", ".")) * 100);
    if (!cents) continue;
    const sign = (a[2] || a[3] || "").replace(/[−–]/, "-"), suf = (a[5] || "").toUpperCase();
    const out = sign === "-" || a[1] === "(" || suf === "D" || suf === "DB" || suf === "-";
    const inn = sign === "+" || suf === "C" || suf === "CR";
    let income: boolean;
    if (card) income = out || inn;                    // on a bill, anything marked is a credit to you
    else if (out) income = false;
    else if (inn) income = true;
    else income = IN_WORDS.test(full) && !OUT_WORDS.test(full.replace(/liberacao de credito/, ""));
    const inst = desc.match(/(?:parc(?:ela)?\.?\s*)?\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b(?!\/)/i);
    entries.push({ date, cents: income ? cents : -cents, description: desc || "Sem descrição", fitid: "",
      installment: inst && +inst[1] >= 1 && +inst[1] <= +inst[2] && +inst[2] > 1 ? { k: +inst[1], n: +inst[2] } : undefined, nd });
  }
  return { format: "pdf", kind, entries, bad, balance, dueDate };
}
