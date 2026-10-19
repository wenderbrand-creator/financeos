import { useState } from "react";
import { CategoryBars } from "../../components/charts/CategoryBars";
import { FlowChart } from "../../components/charts/FlowChart";
import { Icon } from "../../components/icons";
import { Amount } from "../../components/ui/Amount";
import { Seg } from "../../components/ui/inputs";
import { D } from "../../domain/dates";
import { Finance } from "../../domain/finance";
import { useApp } from "../../state/AppContext";

export function Overview() {
  const { data, month } = useApp();
  const [n, setN] = useState(6);
  const from = D.addMonths(month, -(n - 1)), prevTo = D.addMonths(from, -1), prevFrom = D.addMonths(prevTo, -(n - 1));
  const cur = Finance.summary(Finance.ofRange(data.txs, from, month));
  const prevList = Finance.ofRange(data.txs, prevFrom, prevTo);
  const prev = Finance.summary(prevList);
  const points = n === 1 ? Finance.dailyCumulative(data.txs, month).map(p => ({ ...p, title: D.br(p.key) })) : Finance.monthlySeries(data.txs, month, n).map(p => ({ ...p, title: D.label(p.key) }));
  const cats = Finance.byCategory(Finance.ofRange(data.txs, from, month), "expense");
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
      <div className="card col-12">
        <div className="card-head"><div><h3 className="card-title">Despesas por categoria no período</h3><div className="card-sub">{periodLabel}</div></div></div>
        <div className="card-body"><CategoryBars data={cats} max={10} /></div>
      </div>
    </div>
  );
}
