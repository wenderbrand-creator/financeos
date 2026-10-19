import { useState, useMemo } from "react";
import { Donut } from "../../components/charts/Donut";
import { Icon } from "../../components/icons";
import { Amount } from "../../components/ui/Amount";
import { Seg } from "../../components/ui/inputs";
import { StatusPill, CatPill } from "../../components/ui/pills";
import { isTransfer, catOf } from "../../domain/categories";
import { D } from "../../domain/dates";
import { Finance } from "../../domain/finance";
import { Money } from "../../domain/money";
import { useApp } from "../../state/AppContext";

export function Ledger() {
  const { data, month, actions, hidden } = useApp();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [acc, setAcc] = useState("all");
  const [sort, setSort] = useState({ by: "date", dir: "asc" });
  const monthTx = useMemo(() => Finance.ofMonth(data.txs, month), [data.txs, month]);
  const counts = { all: monthTx.length, income: monthTx.filter(t => t.type === "income" && !isTransfer(t)).length, expense: monthTx.filter(t => t.type === "expense" && !isTransfer(t)).length, transfer: monthTx.filter(isTransfer).length };
  const today = D.todayISO();
  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let r = monthTx.filter(t => (tab === "all" || (tab === "transfer" ? isTransfer(t) : t.type === tab && !isTransfer(t)))
      && (status === "all" || (status === "late" ? t.status === "pending" && t.date < today : t.status === status))
      && (acc === "all" || t.accountId === acc)
      && (!qq || t.description.toLowerCase().includes(qq) || catOf(t.category).label.toLowerCase().includes(qq)));
    const dir = sort.dir === "asc" ? 1 : -1;
    r.sort((a, b) => sort.by === "amount" ? (a.amountCents - b.amountCents) * dir : sort.by === "desc" ? a.description.localeCompare(b.description, "pt-BR") * dir : (a.date.localeCompare(b.date) || a.createdAt - b.createdAt) * dir);
    return r;
  }, [monthTx, tab, q, status, acc, sort, today]);
  const s = Finance.summary(rows);
  const donutType = tab === "income" ? "income" : "expense";
  const cats = Finance.byCategory(monthTx, donutType);
  const catTotal = cats.reduce((x, c) => x + c.cents, 0);
  const accName = id => data.settings.accounts.find(a => a.id === id)?.name || "—";
  const SortTh = ({ by, children, r }: any) => <th className={r ? "r" : ""}><button className={sort.by === by ? "on" : ""} onClick={() => setSort(p => ({ by, dir: p.by === by && p.dir === "asc" ? "desc" : "asc" }))}>
    {children}{sort.by === by && <Icon name={sort.dir === "asc" ? "up" : "down"} size={12} sw={2} />}</button></th>;
  const filtered = q || status !== "all" || acc !== "all";

  return (
    <div className="stagger">
      <div className="toolbar">
        <Seg value={tab} onChange={setTab} options={[{ value: "all", label: "Todos", count: counts.all }, { value: "income", label: "Receitas", count: counts.income }, { value: "expense", label: "Despesas", count: counts.expense }, ...(counts.transfer ? [{ value: "transfer", label: "Transferências", count: counts.transfer }] : [])]} />
        <div className="grow" />
        <button className="btn" onClick={actions.openImport}><Icon name="upload" size={16} />Importar extrato</button>
        <button className="btn primary" onClick={() => actions.openTx({ type: tab === "income" ? "income" : "expense" })}><Icon name="plus" size={16} />Adicionar</button>
      </div>
      <div className="ledger">
        <div className="card">
          <div className="filters">
            <div className="search"><Icon name="search" size={15} /><input className="input" aria-label="Buscar" placeholder="Buscar descrição ou categoria" value={q} onChange={e => setQ(e.target.value)} /></div>
            <select className="select" aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">Todos os status</option><option value="paid">Pagos / recebidos</option><option value="pending">Pendentes</option><option value="late">Atrasados</option>
            </select>
            <select className="select" aria-label="Conta" value={acc} onChange={e => setAcc(e.target.value)}>
              <option value="all">Todas as contas</option>{data.settings.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {filtered && <button className="btn ghost sm" onClick={() => { setQ(""); setStatus("all"); setAcc("all"); }}>Limpar filtros</button>}
          </div>
          {rows.length ? <div className="table-wrap"><table className="tbl resp ledger-tbl">
            <thead><tr>
              <SortTh by="date">Data</SortTh><SortTh by="desc">Descrição</SortTh><th>Categoria</th><th>Status</th><SortTh by="amount" r>Valor</SortTh><th className="r"><span className="sr" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Ações</span></th>
            </tr></thead>
            <tbody>{rows.map((t, i) => <tr key={t.id} className="tap-row" onClick={e => { if (!(e.target as HTMLElement).closest("button")) actions.openTx(t); }} style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}>
              <td className="date c-date">{D.brShort(t.date)}</td>
              <td className="desc c-desc"><b>{t.description}</b><span>{accName(t.accountId)}{t.seriesId && <span className="series-tag" title="Lançamento recorrente"><Icon name="repeat" size={11} sw={2} />{t.seriesIndex}/{t.seriesTotal}</span>}</span></td>
              <td className="c-cat"><CatPill id={t.category} /></td>
              <td className="c-status"><StatusPill tx={t} onToggle={() => actions.togglePaid(t)} /></td>
              <td className="r amt c-amt" style={{ color: isTransfer(t) ? "var(--text-2)" : t.type === "income" ? "var(--pos)" : "var(--text)" }}><Amount cents={t.amountCents} sign={t.type === "income" ? "+" : "-"} /></td>
              <td className="c-act"><div className="row-acts">
                <button className="btn ghost icon sm" aria-label={`Editar ${t.description}`} onClick={() => actions.openTx(t)}><Icon name="pencil" size={15} /></button>
                <button className="btn ghost icon sm" aria-label={`Excluir ${t.description}`} onClick={() => actions.confirmDelete(t)}><Icon name="trash" size={15} /></button>
              </div></td>
            </tr>)}</tbody>
            <tfoot><tr><td colSpan={6}><div className="tfoot-sum">
              {tab === "transfer" && <div><span>Movimentado entre contas</span><Amount cents={rows.filter(t => t.type === "expense").reduce((a, t) => a + t.amountCents, 0)} /></div>}
              {tab !== "expense" && tab !== "transfer" && <div><span>Receitas</span><Amount cents={s.income} className="" /></div>}
              {tab !== "income" && tab !== "transfer" && <div><span>Despesas</span><Amount cents={s.expense} /></div>}
              {tab === "all" && <div><span>Resultado</span><b style={{ color: s.result < 0 ? "var(--neg)" : "var(--pos)" }}><Amount cents={s.result} /></b></div>}
              <div><span>Itens</span><b className="num">{rows.length}</b></div>
            </div></td></tr></tfoot>
          </table></div>
            : <div className="empty-mini" style={{ padding: "56px 20px" }}><b>{filtered ? "Nenhum lançamento com esses filtros" : `Nenhum lançamento em ${D.label(month).toLowerCase()}`}</b>
              {filtered ? "Ajuste a busca ou limpe os filtros." : "Use Adicionar para registrar receitas e despesas deste mês."}</div>}
        </div>

        <div className="card">
          <div className="card-head"><div><h3 className="card-title">{donutType === "income" ? "Receitas" : "Despesas"} por categoria</h3><div className="card-sub">{D.label(month)}</div></div></div>
          <div className="card-body">
            {cats.length ? <div className="donut-wrap">
              <Donut data={cats} centerLabel={donutType === "income" ? "Receitas" : "Despesas"} centerValue={Money.compact(catTotal).replace(/^/, "R$ ")} />
              <div className="donut-legend">{cats.map(c => <div className="row" key={c.id}>
                <i style={{ background: c.cat.color }} /><span>{c.cat.label}</span><Amount cents={c.cents} /><span className="pc">{(c.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
              </div>)}</div>
            </div> : <div className="empty-mini"><b>Sem dados</b>A distribuição aparece quando houver {donutType === "income" ? "receitas" : "despesas"} no mês.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
