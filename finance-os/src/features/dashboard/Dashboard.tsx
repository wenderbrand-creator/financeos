import { useMemo } from "react";
import { CategoryBars } from "../../components/charts/CategoryBars";
import { FlowChart } from "../../components/charts/FlowChart";
import { Icon } from "../../components/icons";
import { useTween, Amount } from "../../components/ui/Amount";
import { TxIcon } from "../../components/ui/pills";
import { CardMath, isCard } from "../../domain/cards";
import { isTransfer, catOf } from "../../domain/categories";
import { pad, MONTHS, D } from "../../domain/dates";
import { Finance } from "../../domain/finance";
import { Money } from "../../domain/money";
import { useApp } from "../../state/AppContext";

/* =====================================================================
   10. PAGES
   ===================================================================== */
export function Dashboard() {
  const { data, month, setMonth, actions, isDemo, go, hidden } = useApp();
  const today = D.todayISO();
  const { txs, settings } = data;
  const monthTx = useMemo(() => Finance.ofMonth(txs, month), [txs, month]);
  const sum = useMemo(() => Finance.summary(monthTx), [monthTx]);
  const isFuture = month > D.monthOf(today), isPast = month < D.monthOf(today);
  const refDate = isPast || isFuture ? D.endOf(month) : today;
  const cards = settings.accounts.filter(isCard), cardIds = new Set(cards.map(c => c.id));
  const bankTxs = useMemo(() => txs.filter(t => !cardIds.has(t.accountId)), [txs, settings.accounts]);
  const banks = settings.accounts.filter(a => !isCard(a));
  const balance = Finance.balanceAt(bankTxs, banks, isFuture ? today : refDate);
  const projected = Finance.balanceAt(bankTxs, banks, D.endOf(month), true);
  const cardDebt = cards.reduce((s, c) => s + CardMath.used(c, txs), 0);
  const series = useMemo(() => Finance.monthlySeries(txs, month, 6).map(p => ({ ...p, title: D.label(p.key) })), [txs, month]);
  const cats = useMemo(() => Finance.byCategory(monthTx, "expense"), [monthTx]);
  const latest = useMemo(() => monthTx.slice().sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 6), [monthTx]);
  const due = useMemo(() => {
    const list = Finance.upcoming(bankTxs, month, today).map(t => ({ ...t, kind: "tx" }));
    const bills = CardMath.dueBills(cards, txs, month, today).map(b => ({ kind: "bill", id: b.card.id + b.key, date: b.due, late: b.late, description: `Fatura ${b.card.name}`, amountCents: b.remaining, card: b.card, key: b.key }));
    return [...list, ...bills].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  }, [bankTxs, txs, month, today, settings.accounts]);
  const accName = id => settings.accounts.find(a => a.id === id)?.name || "—";
  const isEmpty = txs.length === 0;
  const maxFlow = Math.max(sum.income, sum.expense, 1);
  const balanceT = useTween(balance, 900);

  return (
    <div className="dash stagger">
      {isEmpty && !isDemo && <div className="welcome">
        <div><div className="eyebrow">Primeiros passos</div>
          <h3 style={{ marginTop: 6 }}>Seu painel começa vazio, e os números só mudam com lançamentos reais.</h3>
          <p>Registre uma receita ou despesa para ver saldo, gráficos e vencimentos calculados. Para conhecer a interface com dados fictícios, abra a demonstração; ela fica separada dos seus registros.</p></div>
        <div className="acts">
          <button className="btn" onClick={actions.enterDemo}><Icon name="flask" size={16} />Explorar demonstração</button>
          <button className="btn" onClick={actions.openImport}><Icon name="upload" size={16} />Importar extrato</button>
          <button className="btn primary" onClick={() => actions.openTx()}><Icon name="plus" size={16} />Primeiro lançamento</button>
        </div>
      </div>}

      <section className="hero">
        <div className="balance">
          <div>
            <div className="eyebrow">Saldo {isFuture ? "atual" : isPast ? `em ${D.br(refDate)}` : "atual"} · {cards.length ? "contas, sem cartões" : "todas as contas"}</div>
            <div className="balance-value num">{hidden ? "R$ •••••" : <><span className="cur">R$</span>{(balanceT < 0 ? "−" : "") + Money.plain(Math.abs(balanceT))}</>}</div>
          </div>
          <div className="balance-meta">
            <div className="meta-item"><div className="k">Previsto ao fim de {MONTHS[+month.slice(5) - 1]}</div><div className="v"><Amount animate cents={projected} /></div></div>
            {cards.length > 0 ? <div className="meta-item"><div className="k">Cartões a pagar</div><div className="v" style={{ cursor: "pointer" }} onClick={() => go("cartoes")}><Amount animate cents={cardDebt} /></div></div>
              : <div className="meta-item"><div className="k">Contas</div><div className="v num">{banks.length}</div></div>}
            <div className="meta-item"><div className="k">Lançamentos no mês</div><div className="v num">{sum.count}</div></div>
          </div>
        </div>
        <div className="card metrics">
          <div className="metric">
            <div className="k"><span className="sw" style={{ background: "var(--pos)" }} />Receitas</div>
            <div className="v"><Amount animate cents={sum.income} /></div>
            <div className="s">{sum.incomePending ? <>A receber: <Amount cents={sum.incomePending} /></> : "Tudo recebido"}</div>
            <div className="bar"><i style={{ width: `${(sum.income / maxFlow) * 100}%`, background: "var(--pos)" }} /></div>
          </div>
          <div className="metric">
            <div className="k"><span className="sw" style={{ background: "var(--neg)" }} />Despesas</div>
            <div className="v"><Amount animate cents={sum.expense} /></div>
            <div className="s">{sum.expensePending ? <>A pagar: <Amount cents={sum.expensePending} /></> : "Tudo pago"}</div>
            <div className="bar"><i style={{ width: `${(sum.expense / maxFlow) * 100}%`, background: "var(--neg)" }} /></div>
          </div>
          <div className="metric">
            <div className="k"><span className="sw" style={{ background: "var(--accent)" }} />Resultado do mês</div>
            <div className="v" style={{ color: sum.result < 0 ? "var(--neg)" : sum.result > 0 ? "var(--pos)" : "var(--text)" }}><Amount animate cents={sum.result} sign={sum.result > 0 ? "+" : undefined} /></div>
            <div className="s">Realizado: <Amount cents={sum.resultPaid} /></div>
            <div className="s">{sum.income ? `${Math.round((sum.result / sum.income) * 100)}% da receita` : "—"}</div>
          </div>
        </div>
      </section>

      <div className="card col-8">
        <div className="card-head">
          <div><h3 className="card-title">Evolução financeira</h3><div className="card-sub">Últimos 6 meses até {D.label(month).toLowerCase()}</div></div>
          <div className="right legend"><span><i style={{ background: "var(--pos)" }} />Receitas</span><span><i style={{ background: "var(--neg)" }} />Despesas</span></div>
        </div>
        <div className="card-body"><FlowChart points={series} height={268} /></div>
      </div>

      <div className="card col-4">
        <div className="card-head">
          <div><h3 className="card-title">Despesas por categoria</h3><div className="card-sub">{D.label(month)}</div></div>
          <div className="right"><button className="link-btn" onClick={() => go("orcamento")}>Detalhar</button></div>
        </div>
        <div className="card-body"><CategoryBars data={cats} /></div>
      </div>

      <div className="card col-7">
        <div className="card-head">
          <div><h3 className="card-title">Últimas transações</h3><div className="card-sub">Mais recentes do mês</div></div>
          <div className="right"><button className="link-btn" onClick={() => go("orcamento")}>Ver todas</button></div>
        </div>
        <div style={{ padding: "8px 0 8px" }}>
          {latest.length ? <div className="tx-list">{latest.map(t =>
            <button key={t.id} className="tx-item" onClick={() => actions.openTx(t)}>
              <TxIcon tx={t} />
              <div className="tx-main"><div className="t">{t.description}</div><div className="m">{D.brShort(t.date)} · {catOf(t.category).label} · {accName(t.accountId)}{t.status === "pending" ? " · pendente" : ""}</div></div>
              <div className={"tx-amt " + (isTransfer(t) ? "tr" : t.type === "income" ? "pos" : "neg")}><Amount cents={t.amountCents} sign={t.type === "income" ? "+" : "-"} /></div>
            </button>)}</div>
            : <div className="empty-mini"><b>Nenhum lançamento em {D.label(month).toLowerCase()}</b>
              <button className="btn sm" style={{ marginTop: 12 }} onClick={() => actions.openTx()}><Icon name="plus" size={14} />Adicionar lançamento</button></div>}
        </div>
      </div>

      <div className="card col-5">
        <div className="card-head">
          <div><h3 className="card-title">Próximos vencimentos</h3><div className="card-sub">Pendentes, faturas e atrasados</div></div>
          {due.length > 0 && <div className="right"><span className="pill warn num">{due.length}</span></div>}
        </div>
        <div style={{ padding: "8px 0 8px" }}>
          {due.length ? due.map(t => { const dm = D.dayMon(t.date); return t.kind === "bill" ? (
            <div className="due-item" key={t.id}>
              <div className={"due-date" + (t.late ? " late" : "")}><b className="num">{pad(dm.d)}</b><span>{dm.m}</span></div>
              <div className="tx-main" style={{ cursor: "pointer" }} onClick={() => actions.goCards(t.key)}>
                <div className="t"><Icon name="card" size={13} style={{ verticalAlign: "-2px", marginRight: 6, color: `var(--${t.card.color || "c1"})` }} />{t.description}</div>
                <div className="m">{t.late ? <span style={{ color: "var(--neg)" }}>Vencida</span> : "Fatura fechada"} · {MONTHS[+t.key.slice(5) - 1]}</div>
              </div>
              <div className="tx-amt neg"><Amount cents={t.amountCents} /></div>
              <button className="btn sm" onClick={() => actions.openPayBill(t.card.id, t.key)}><Icon name="check" size={14} sw={2} />Pagar</button>
            </div>) : (
            <div className="due-item" key={t.id}>
              <div className={"due-date" + (t.late ? " late" : "")}><b className="num">{pad(dm.d)}</b><span>{dm.m}</span></div>
              <div className="tx-main" style={{ cursor: "pointer" }} onClick={() => actions.openTx(t)}>
                <div className="t">{t.description}</div>
                <div className="m">{t.late ? <span style={{ color: "var(--neg)" }}>Atrasado</span> : t.type === "income" ? "A receber" : "A pagar"} · {accName(t.accountId)}</div>
              </div>
              <div className={"tx-amt " + (t.type === "income" ? "pos" : "neg")}><Amount cents={t.amountCents} /></div>
              <button className="btn sm" onClick={() => actions.togglePaid(t)} title={t.type === "income" ? "Marcar como recebido" : "Marcar como pago"}><Icon name="check" size={14} sw={2} />{t.type === "income" ? "Recebido" : "Pago"}</button>
            </div>); })
            : <div className="empty-mini"><b>Nada pendente</b>Lançamentos com status pendente aparecem aqui.</div>}
        </div>
      </div>
    </div>
  );
}
