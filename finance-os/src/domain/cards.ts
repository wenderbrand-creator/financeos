import { isTransfer } from "./categories";
import { pad, MONTHS, D } from "./dates";
import { uid } from "./ids";
import { isRecurring } from "./series";

/* =====================================================================
   CREDIT CARDS — bill cycles, installments, bill payments
   A card is an account with type "cartao" + closingDay, dueDay, limitCents, color.
   Purchases are expenses on the card (counted on the purchase date).
   Paying the bill is a transfer bank → card (never counted as spending twice).
   Bills are identified by the month of their due date ("2026-11").
   ===================================================================== */
export const CardMath = {
  day(key, d) { return Math.min(d, D.days(key)); },
  /** which bill (due month) a purchase on `iso` belongs to */
  billOf(card, iso) {
    const key = iso.slice(0, 7), d = +iso.slice(8);
    const closeKey = d >= CardMath.day(key, card.closingDay) ? D.addMonths(key, 1) : key;
    return card.dueDay > card.closingDay ? closeKey : D.addMonths(closeKey, 1);
  },
  dates(card, billKey) {
    const closeKey = card.dueDay > card.closingDay ? billKey : D.addMonths(billKey, -1);
    const prev = D.addMonths(closeKey, -1);
    return {
      close: `${closeKey}-${pad(CardMath.day(closeKey, card.closingDay))}`,
      due: `${billKey}-${pad(CardMath.day(billKey, card.dueDay))}`,
      open: `${prev}-${pad(CardMath.day(prev, card.closingDay))}`,
    };
  },
  bills(card, txs) {
    const map = new Map();
    const get = k => { if (!map.has(k)) map.set(k, { key: k, total: 0, paid: 0, items: [], payments: [] }); return map.get(k); };
    for (const t of txs) {
      if (t.accountId !== card.id) continue;
      if (isTransfer(t)) {
        if (t.type === "income") { const b = get(t.billMonth || D.addMonths(CardMath.billOf(card, t.date), -1)); b.paid += t.amountCents; b.payments.push(t); }
        continue;
      }
      const b = get(CardMath.billOf(card, t.date));
      b.items.push(t);
      b.total += t.type === "expense" ? t.amountCents : -t.amountCents;
    }
    return map;
  },
  bill(card: any, txs: any[], key: string, map?: Map<string, any>) {
    map = map || CardMath.bills(card, txs);
    const b = map.get(key) || { key, total: 0, paid: 0, items: [], payments: [] };
    const dt = CardMath.dates(card, key), today = D.todayISO();
    const remaining = Math.max(b.total - b.paid, 0);
    let status;
    if (today < dt.close) status = b.total > 0 && remaining === 0 ? "prepaid" : "open";
    else if (b.total <= 0) status = "empty";
    else if (remaining === 0) status = "paid";
    else if (today > dt.due) status = "late";
    else status = "closed";
    return { ...b, ...dt, remaining, status };
  },
  /** everything still owed on the card, including future installments */
  /**
   * Limit in use: everything already charged and not yet paid, plus future installments
   * (an installment purchase holds the whole amount on the limit). Future charges of a
   * recurring subscription do NOT hold limit: each month only counts once it is charged.
   */
  used(card, txs, today = D.todayISO()) {
    let u = 0;
    for (const t of txs) {
      if (t.accountId !== card.id) continue;
      if (t.type === "expense" && t.date > today && isRecurring(t)) continue;
      u += t.type === "expense" ? t.amountCents : -t.amountCents;
    }
    return Math.max(u, 0);
  },
  /** bills that need attention for a given month (due that month, or overdue) */
  dueBills(cards, txs, monthKey, today) {
    const out = [];
    for (const c of cards) {
      const map = CardMath.bills(c, txs);
      const keys = new Set([monthKey, ...[...map.keys()].filter(k => k < monthKey)]);
      for (const k of keys) {
        const b = CardMath.bill(c, txs, k, map);
        if (b.remaining <= 0 || b.status === "open") continue;
        if (k === monthKey || b.due < today) out.push({ ...b, card: c, late: b.due < today });
      }
    }
    return out.sort((a, b) => a.due.localeCompare(b.due));
  },
};
export function buildInstallments(first, n) {
  const sid = uid("p"), base = Math.floor(first.amountCents / n), rem = first.amountCents - base * n;
  const [y, m, d] = first.date.split("-").map(Number), out = [];
  for (let i = 0; i < n; i++) {
    const k = D.addMonths(`${y}-${pad(m)}`, i), date = `${k}-${pad(Math.min(d, D.days(k)))}`;
    out.push({ ...first, id: i === 0 ? first.id : uid("t"), date, amountCents: base + (i === 0 ? rem : 0), description: `${first.description} (${i + 1}/${n})`,
      status: "paid", seriesId: sid, seriesIndex: i + 1, seriesTotal: n });
  }
  return out;
}
export const isCard = (a) => a && a.type === "cartao";
export const monthName = (key) => MONTHS[+key.slice(5) - 1];
