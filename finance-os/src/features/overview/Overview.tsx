import { useState, useMemo } from "react";
import { CategoryBars } from "../../components/charts/CategoryBars";
import { FlowChart } from "../../components/charts/FlowChart";
import { Icon } from "../../components/icons";
import { Amount } from "../../components/ui/Amount";
import { Seg } from "../../components/ui/inputs";
import { D } from "../../domain/dates";
import { Finance } from "../../domain/finance";
import { useApp } from "../../state/AppContext";
import { catOf, isTransfer } from "../../domain/categories";
import { normDesc } from "../../import/parsers";

/** per-category change between two periods, biggest moves first */
function categoryChanges(cur: any[], prev: any[]) {
  const sum = (list) => { const m = new Map<string, number>(); for (const t of list) if (t.type === "expense" && !isTransfer(t)) m.set(t.category, (m.get(t.category) || 0) + t.amountCents); return m; };
  const a = sum(cur), b = sum(prev);
  return [...new Set([...a.keys(), ...b.keys()])].map(id => ({ id, cat: catOf(id), cur: a.get(id) || 0, prev: b.get(id) || 0 }))
    .map(r => ({ ...r, diff: r.cur - r.prev })).filter(r => r.diff !== 0).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}
/** expenses that show up in at least 2 different months of the period (same description), with the monthly average */
function repeating(list: any[], months: number) {
  const g = new Map<string, { desc: string; cat: string; months: Set<string>; total: number }>();
  for (const t of list) {
    if (t.type !== "expense" || isTransfer(t)) continue;
    const k = normDesc(t.description); if (k.length < 3) continue;
    const e = g.get(k) || { desc: t.description, cat: t.category, months: new Set(), total: 0 };
    e.months.add(t.date.slice(0, 7)); e.total += t.amountCents; g.set(k, e);
  }
  return [...g.values()].filter(e => e.months.size >= Math.min(2, months)).map(e => ({ ...e, avg: Math.round(e.total / e.months.size) })).sort((x, y) => y.avg - x.avg);
}

export function Overview() {
  const { data, month } = useApp();
  const [n, setN] = useState(6);
  const from = D.addMonths(month, -(n - 1)), prevTo = D.addMonths(from, -1), prevFrom = D.addMonths(prevTo, -(n - 1));
  const cur = Finance.summary(Finance.ofRange(data.txs, from, month));
  const prevList = Finance.ofRange(data.txs, prevFrom, prevTo);
  const prev = Finance.summary(prevList);
  const points = n === 1 ? Finance.dailyCumulative(data.txs, month).map(p => ({ ...p, title: D.br(p.key) })) : Finance.monthlySeries(data.txs, month, n).map(p => ({ ...p, title: D.label(p.key) }));
  const curList = useMemo(() => Finance.ofRange(data.txs, from, month), [data.txs, from, month]);
  const cats = Finance.byCategory(curList, "expense");
  const changes = useMemo(() => categoryChanges(curList, prevList).slice(0, 6), [curList, prevList]);
  // one line per kind of expense: six "Aluguel" rows would hide everything else
  const biggest = useMemo(() => { const seen = new Set(); return curList.filter(t => t.type === "expense" && !isTransfer(t)).sort((x, y) => y.amountCents - x.amountCents)
    .filter(t => { const k = normDesc(t.description); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6); }, [curList]);
  const repeats = useMemo(() => n > 1 ? repeating(curList, n).slice(0, 8) : [], [curList, n]);
  const repeatTotal = repeats.reduce((s, r) => s + r.avg, 0);
  const periodLabel = n === 1 ? D.label(month) : `${D.label(from)} – ${D.label(month)}`;
  const Delta = ({ c, p, invert }: any) => {
    if (!prevList.length) return <div className="delta flat">Sem dados no período anterior</div>;
    const d = Finance.delta(c, p);
    if (d === null) return <div className="delta flat">Período anterior zerado</div>;
    const up = d > 0, good = invert ? !up : up;
    if (Math.abs(d) < 0.0005) return <div className="delta flat">Igual ao período anterior</div>;
    return <div className={"delta " + (good ? "good" : "bad")}><Icon name={up ? "up" : "down"} size={13} sw={2.2} />{Math.abs(d * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% <span style={{ color: "var(--text-3)", fontWeight: 500 }}>vs. período anterior</span></div>;
  };
  return (
    <div className="dash stagger">
      <div className="col-12 toolbar" style={{ marginBottom: 0 }}>
        <Seg value={n} onChange={setN} options={[{ value: 1, label: "Mês atual" }, { value: 3, label: "3 meses" }, { value: 6, label: "6 meses" }, { value: 12, label: "12 meses" }]} />
        <span className="card-sub">{periodLabel}, comparado {n === 1 ? "ao mês anterior" : `aos ${n} meses anteriores`}</span>
      </div>
      <div className="card col-12">
        <div className="ov-cards">
          <div className="ov-card"><div className="metric" style={{ padding: 0 }}><div className="k"><span className="sw" style={{ background: "var(--pos)" }} />Receitas</div></div><div className="v"><Amount animate cents={cur.income} /></div><Delta c={cur.income} p={prev.income} /></div>
          <div className="ov-card"><div className="metric" style={{ padding: 0 }}><div className="k"><span className="sw" style={{ background: "var(--neg)" }} />Despesas</div></div><div className="v"><Amount animate cents={cur.expense} /></div><Delta c={cur.expense} p={prev.expense} invert /></div>
          <div className="ov-card"><div className="metric" style={{ padding: 0 }}><div className="k"><span className="sw" style={{ background: "var(--accent)" }} />Saldo do período</div></div><div className="v" style={{ color: cur.result < 0 ? "var(--neg)" : "var(--text)" }}><Amount animate cents={cur.result} /></div><Delta c={cur.result} p={prev.result} /></div>
        </div>
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <div className="card-head"><div><h3 className="card-title">{n === 1 ? "Acumulado no mês" : "Receitas e despesas por mês"}</h3><div className="card-sub">{n === 1 ? "Soma diária acumulada" : "Valores totais, incluindo pendentes"}</div></div>
            <div className="right legend"><span><i style={{ background: "var(--pos)" }} />Receitas</span><span><i style={{ background: "var(--neg)" }} />Despesas</span></div></div>
          <div className="card-body"><FlowChart points={points} height={300} labelEvery={n === 1 ? 5 : 1} /></div>
        </div>
      </div>
      <div className="card col-7">
        <div className="card-head"><div><h3 className="card-title">O que mudou nos gastos</h3><div className="card-sub">Por categoria, {n === 1 ? "contra o mês anterior" : `contra os ${n} meses anteriores`}</div></div></div>
        {prevList.length && changes.length ? <div className="chg-list">{changes.map(r => {
          const pct = r.prev ? r.diff / r.prev : null, up = r.diff > 0;
          return <div className="chg-row" key={r.id}>
            <span className="nm"><span className="d" style={{ background: r.cat.color }} />{r.cat.label}</span>
            <span className="cur"><Amount cents={r.cur} /></span>
            <span className={"chg " + (up ? "bad" : "good")}><Icon name={up ? "up" : "down"} size={12} sw={2.2} />{pct === null ? "novo" : `${Math.abs(pct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}<small>{up ? "+" : "−"}<Amount cents={Math.abs(r.diff)} /></small></span>
          </div>; })}</div>
          : <div className="empty-mini"><b>Ainda sem comparação</b>Aparece quando houver lançamentos também no período anterior.</div>}
      </div>
      <div className="card col-5">
        <div className="card-head"><div><h3 className="card-title">Maiores gastos</h3><div className="card-sub">{periodLabel}</div></div></div>
        {biggest.length ? <div className="big-list">{biggest.map(t => <div className="big-row" key={t.id}>
          <div style={{ minWidth: 0 }}><b>{t.description}</b><span>{D.br(t.date)} · {catOf(t.category).label}</span></div><Amount cents={t.amountCents} />
        </div>)}</div> : <div className="empty-mini"><b>Sem despesas</b>Nenhuma despesa no período.</div>}
      </div>
      <div className="card col-6">
        <div className="card-head"><div><h3 className="card-title">Despesas por categoria</h3><div className="card-sub">{periodLabel}</div></div></div>
        <div className="card-body"><CategoryBars data={cats} max={8} /></div>
      </div>
      <div className="card col-6">
        <div className="card-head"><div><h3 className="card-title">Gastos que se repetem</h3><div className="card-sub">{n === 1 ? "Escolha 3 meses ou mais para ver" : repeats.length ? <>Cerca de <Amount cents={repeatTotal} /> por mês</> : "Aparecem em mais de um mês"}</div></div></div>
        {repeats.length ? <div className="big-list">{repeats.map(r => <div className="big-row" key={r.desc}>
          <div style={{ minWidth: 0 }}><b>{r.desc}</b><span>{catOf(r.cat).label} · em {r.months.size} de {n} meses</span></div><span className="num"><Amount cents={r.avg} /><small>/mês</small></span>
        </div>)}</div> : <div className="empty-mini"><b>{n === 1 ? "Período curto demais" : "Nada se repete ainda"}</b>{n === 1 ? "Assinaturas e contas fixas aparecem quando o período tem vários meses." : "Contas fixas e assinaturas aparecem aqui quando surgem em mais de um mês."}</div>}
      </div>
    </div>
  );
}
