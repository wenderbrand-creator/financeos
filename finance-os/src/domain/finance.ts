import { isTransfer, catOf } from "./categories";
import { pad, D } from "./dates";

/* =====================================================================
   3. FINANCE CORE — every indicator is derived here, from records only
   ===================================================================== */
export const Finance = {
  sumBy(list, pred) { let s = 0; for (const t of list) if (pred(t)) s += t.amountCents; return s; },
  ofMonth(txs, key) { return txs.filter(t => t.date.startsWith(key)); },
  ofRange(txs, fromKey, toKey) { return txs.filter(t => { const k = t.date.slice(0, 7); return k >= fromKey && k <= toKey; }); },
  summary(list) {
    list = list.filter(t => !isTransfer(t));
    const inc = Finance.sumBy(list, t => t.type === "income");
    const exp = Finance.sumBy(list, t => t.type === "expense");
    const incPaid = Finance.sumBy(list, t => t.type === "income" && t.status === "paid");
    const expPaid = Finance.sumBy(list, t => t.type === "expense" && t.status === "paid");
    return { income: inc, expense: exp, incomePaid: incPaid, expensePaid: expPaid, incomePending: inc - incPaid, expensePending: exp - expPaid, result: inc - exp, resultPaid: incPaid - expPaid, count: list.length };
  },
  openingTotal(accounts) { return accounts.reduce((s, a) => s + (a.openingCents || 0), 0); },
  /** realized balance across all accounts up to a date (inclusive) */
  balanceAt(txs, accounts, iso, includePending = false) {
    let s = Finance.openingTotal(accounts);
    for (const t of txs) {
      if (t.date > iso) continue;
      if (!includePending && t.status !== "paid") continue;
      s += t.type === "income" ? t.amountCents : -t.amountCents;
    }
    return s;
  },
  accountBalance(txs, acc, iso) {
    let s = acc.openingCents || 0;
    for (const t of txs) if (t.accountId === acc.id && t.status === "paid" && t.date <= iso) s += t.type === "income" ? t.amountCents : -t.amountCents;
    return s;
  },
  monthlySeries(txs, endKey, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = D.addMonths(endKey, -i);
      const l = Finance.ofMonth(txs, k).filter(t => !isTransfer(t));
      out.push({ key: k, label: D.short(k), a: Finance.sumBy(l, t => t.type === "income"), b: Finance.sumBy(l, t => t.type === "expense") });
    }
    return out;
  },
  dailyCumulative(txs, key) {
    const n = D.days(key), l = Finance.ofMonth(txs, key).filter(t => !isTransfer(t)), out = [];
    let a = 0, b = 0;
    for (let d = 1; d <= n; d++) {
      const iso = `${key}-${pad(d)}`;
      for (const t of l) if (t.date === iso) { if (t.type === "income") a += t.amountCents; else b += t.amountCents; }
      out.push({ key: iso, label: String(d), a, b });
    }
    return out;
  },
  byCategory(list, type) {
    const map = new Map();
    for (const t of list) if (t.type === type && !isTransfer(t)) map.set(t.category, (map.get(t.category) || 0) + t.amountCents);
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()].map(([id, cents]) => ({ id, cents, share: total ? cents / total : 0, cat: catOf(id) }))
      .sort((x, y) => y.cents - x.cents);
  },
  /** pending items: overdue (any month, before today) + pending of selected month */
  upcoming(txs, key, today) {
    return txs.filter(t => t.status === "pending" && (t.date < today || t.date.startsWith(key)))
      .map(t => ({ ...t, late: t.date < today }))
      .sort((x, y) => x.date.localeCompare(y.date));
  },
  delta(cur, prev) { if (!prev) return null; return (cur - prev) / Math.abs(prev); },
};
