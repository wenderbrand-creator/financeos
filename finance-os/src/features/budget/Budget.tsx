import { useMemo, useState } from "react";
import { Icon } from "../../components/icons";
import { Amount } from "../../components/ui/Amount";
import { Modal } from "../../components/ui/Modal";
import { MoneyInput } from "../../components/ui/inputs";
import { CATS, catOf, isTransfer } from "../../domain/categories";
import { D } from "../../domain/dates";
import { useApp } from "../../state/AppContext";

/* =====================================================================
   BUDGET — a monthly spending limit per expense category.
   Spent = expenses of the month in that category (paid + pending, card
   purchases included on the purchase date), transfers excluded.
   ===================================================================== */
export function budgetRows(txs: any[], budgets: Record<string, number>, month: string) {
  const spent = new Map<string, number>();
  for (const t of txs) if (t.type === "expense" && !isTransfer(t) && t.date.startsWith(month)) spent.set(t.category, (spent.get(t.category) || 0) + t.amountCents);
  return Object.entries(budgets || {}).filter(([id]) => catOf(id).type === "expense")
    .map(([id, limit]) => { const s = spent.get(id) || 0; return { id, cat: catOf(id), limit, spent: s, left: limit - s, pct: limit ? s / limit : 0 }; })
    .sort((a, b) => b.pct - a.pct);
}
/** average monthly spending per category over the 3 months before `month` (suggested limits) */
export function averageSpend(txs: any[], month: string) {
  const months = [1, 2, 3].map(n => D.addMonths(month, -n));
  const sum = new Map<string, number>();
  for (const t of txs) if (t.type === "expense" && !isTransfer(t) && months.includes(t.date.slice(0, 7))) sum.set(t.category, (sum.get(t.category) || 0) + t.amountCents);
  const out: Record<string, number> = {};
  for (const [id, v] of sum) { const avg = Math.round(v / 3 / 1000) * 1000; if (avg > 0) out[id] = avg; } // rounded to R$ 10
  return out;
}
const tone = (pct: number) => pct >= 1 ? "over" : pct >= 0.8 ? "near" : "ok";

export function BudgetModal({ onClose }: any) {
  const { realData, data, month, actions } = useApp();
  const [vals, setVals] = useState<Record<string, number>>(() => ({ ...(realData.settings.budgets || {}) }));
  const avg = useMemo(() => averageSpend(data.txs, month), [data.txs, month]);
  const cats = CATS.expense.filter(c => !c.archived || vals[c.id]);
  const total = Object.values(vals).reduce((s, v) => s + (v || 0), 0);
  const save = async () => {
    const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => v > 0));
    if (await actions.saveSettings({ ...realData.settings, budgets: clean }, "Limites salvos")) onClose();
  };
  return (
    <Modal wide title="Limites por categoria" subtitle="Quanto você quer gastar por mês em cada categoria. Deixe em branco o que não quiser controlar." onClose={onClose}
      footer={<><span className="hint">Total planejado <b className="num"><Amount cents={total} /></b></span><div className="spacer" /><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar limites</button></>}>
      {Object.keys(avg).length > 0 && <div className="notice"><Icon name="chart" size={18} /><div style={{ flex: 1 }}>Sem ideia de valores? Comece pela sua média dos últimos 3 meses.
        <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => setVals(v => ({ ...avg, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x > 0)) }))}>Preencher com a média</button></div></div></div>}
      <div className="budget-edit">{cats.map(c => <div className="budget-edit-row" key={c.id}>
        <label htmlFor={"bud-" + c.id}><span className="d" style={{ background: c.color }} />{c.label}{avg[c.id] ? <small>média <Amount cents={avg[c.id]} /></small> : null}</label>
        <MoneyInput id={"bud-" + c.id} value={vals[c.id] || 0} onChange={v => setVals(p => ({ ...p, [c.id]: v }))} />
      </div>)}</div>
    </Modal>
  );
}

/** Card for Início and Lançamentos: how each limited category is doing this month. */
export function BudgetCard({ compact, className = "" }: { compact?: boolean; className?: string }) {
  const { data, month } = useApp();
  const [edit, setEdit] = useState(false);
  const rows = useMemo(() => budgetRows(data.txs, data.settings.budgets, month), [data.txs, data.settings.budgets, month]);
  const over = rows.filter(r => r.pct >= 1).length;
  const shown = compact ? rows.slice(0, 5) : rows;
  return (
    <div className={"card budget-card " + className}>
      <div className="card-head"><div><h3 className="card-title">Orçamento do mês</h3>
        <div className="card-sub">{rows.length ? (over ? `${over} categoria${over === 1 ? "" : "s"} acima do limite` : `${D.label(month)} · dentro do planejado`) : D.label(month)}</div></div>
        <button type="button" className="link-btn card-head-act" onClick={() => setEdit(true)}>{rows.length ? "Editar limites" : "Definir"}</button></div>
      {rows.length ? <div className="budget-list">{shown.map(r => <div className={"budget-row " + tone(r.pct)} key={r.id}>
        <div className="budget-top"><span className="nm"><span className="d" style={{ background: r.cat.color }} />{r.cat.label}</span>
          <span className="vals"><Amount cents={r.spent} /> <span className="of">de <Amount cents={r.limit} /></span></span></div>
        <div className="budget-bar" role="progressbar" aria-label={`${r.cat.label}: ${Math.round(r.pct * 100)}% do limite`} aria-valuenow={Math.round(r.pct * 100)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${Math.min(100, r.pct * 100)}%` }} /></div>
        <div className="budget-foot"><span>{r.left >= 0 ? <>Restam <Amount cents={r.left} /></> : <>Passou <Amount cents={-r.left} /></>}</span><span className="pc">{Math.round(r.pct * 100)}%</span></div>
      </div>)}
        {compact && rows.length > shown.length && <p className="hint">e mais {rows.length - shown.length} em Lançamentos</p>}</div>
        : <div className="empty-mini"><b>Controle quanto gasta por categoria</b>Defina um limite mensal para Alimentação, Lazer ou o que quiser. O app avisa quando estiver perto de passar.
          <div style={{ marginTop: 12 }}><button type="button" className="btn sm" onClick={() => setEdit(true)}><Icon name="plus" size={14} />Definir limites</button></div></div>}
      {edit && <BudgetModal onClose={() => setEdit(false)} />}
    </div>
  );
}

/** Settings entry point. */
export function BudgetSection() {
  const { realData } = useApp();
  const [edit, setEdit] = useState(false);
  const n = Object.keys(realData.settings.budgets || {}).length;
  return (
    <section className="card sec" id="orcamento">
      <div className="sec-row"><div><h4>Orçamento por categoria</h4><p>Limites mensais de gasto. O acompanhamento aparece no Início e em Lançamentos.</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="hint">{n ? `${n} categoria${n === 1 ? "" : "s"} com limite` : "Nenhum limite definido"}</span>
          <button type="button" className="btn" onClick={() => setEdit(true)}><Icon name="sliders" size={15} />{n ? "Editar limites" : "Definir limites"}</button>
        </div></div>
      {edit && <BudgetModal onClose={() => setEdit(false)} />}
    </section>
  );
}
