import { useState, useMemo } from "react";
import { CategoryBars } from "../../components/charts/CategoryBars";
import { Icon } from "../../components/icons";
import { Amount } from "../../components/ui/Amount";
import { Modal } from "../../components/ui/Modal";
import { MoneyInput } from "../../components/ui/inputs";
import { CatPill } from "../../components/ui/pills";
import { CardMath, isCard, monthName } from "../../domain/cards";
import { CAT_COLORS, TRANSFER_CAT } from "../../domain/categories";
import { pad, D } from "../../domain/dates";
import { Finance } from "../../domain/finance";
import { uid } from "../../domain/ids";
import { Money } from "../../domain/money";
import { NUM_RE } from "../../domain/series";
import { range } from "../../import/parsers";
import { useApp } from "../../state/AppContext";

export const BILL_STATUS = {
  open: { label: "Aberta", cls: "accent" }, closed: { label: "Fechada", cls: "warn" }, late: { label: "Vencida", cls: "neg" },
  paid: { label: "Paga", cls: "pos" }, prepaid: { label: "Aberta · já quitada", cls: "pos" }, empty: { label: "Sem gastos", cls: "" },
};
/* ---------- visual card ---------- */
export function CardTile({ card, txs, active, onClick }: any) {
  const today = D.todayISO();
  const cur = CardMath.bill(card, txs, CardMath.billOf(card, today));
  const used = CardMath.used(card, txs);
  const pct = card.limitCents ? Math.min(used / card.limitCents, 1) : 0;
  return (
    <button type="button" className={"cc" + (active ? " on" : "")} style={{ "--cc": `var(--${card.color || "c1"})` }} onClick={onClick} aria-pressed={active}>
      <div className="cc-top"><span className="cc-name">{card.name}</span><span className="cc-chip" aria-hidden="true" /></div>
      <div className="cc-mid"><span>Fatura de {monthName(cur.key)}</span><b><Amount cents={cur.total} /></b></div>
      <div className="cc-bot">
        {card.limitCents ? <div className="cc-limit"><i style={{ width: `${pct * 100}%` }} /></div> : null}
        <span>{card.limitCents ? <>Disponível <Amount cents={Math.max(card.limitCents - used, 0)} /></> : "Sem limite cadastrado"}</span>
        <span>Fecha {pad(card.closingDay)} · vence {pad(card.dueDay)}</span>
      </div>
    </button>
  );
}

export function CardModal({ initial, onClose }: any) {
  const { data, actions } = useApp();
  const used = initial ? data.txs.some(t => t.accountId === initial.id) : false;
  const [f, setF] = useState({ name: initial?.name || "", color: initial?.color || "c1", closingDay: initial?.closingDay || 3, dueDay: initial?.dueDay || 10, limitCents: initial?.limitCents || 0 });
  const [touched, setTouched] = useState(false);
  const err = !f.name.trim() ? "Informe um nome." : f.name.trim().length > 30 ? "Use até 30 caracteres." : null;
  const save = async () => {
    setTouched(true); if (err) return;
    const acc = { id: initial?.id || uid("acc"), name: f.name.trim(), type: "cartao", openingCents: initial?.openingCents || 0, closingDay: f.closingDay, dueDay: f.dueDay, limitCents: f.limitCents, color: f.color };
    const accounts = initial ? data.settings.accounts.map(a => a.id === acc.id ? acc : a) : [...data.settings.accounts, acc];
    if (await actions.saveSettings({ ...data.settings, accounts }, initial ? "Cartão atualizado" : "Cartão adicionado")) onClose(acc.id);
  };
  const remove = async () => {
    if (await actions.confirm({ title: "Excluir cartão", body: `O cartão “${initial.name}” será removido.`, confirmLabel: "Excluir" }))
      if (await actions.saveSettings({ ...data.settings, accounts: data.settings.accounts.filter(a => a.id !== initial.id) }, "Cartão excluído")) onClose(null);
  };
  const days = range(31).map(i => i + 1);
  const sample = { closingDay: f.closingDay, dueDay: f.dueDay };
  const today = D.todayISO(), billNow = CardMath.billOf(sample, today), dts = CardMath.dates(sample, billNow);
  return (
    <Modal title={initial ? "Editar cartão" : "Novo cartão de crédito"} subtitle="Fechamento e vencimento definem em qual fatura cada compra cai." onClose={() => onClose()}
      footer={<>
        {initial && <button className="btn danger-ghost" onClick={remove} disabled={used} title={used ? "Cartão com lançamentos não pode ser excluído" : ""}><Icon name="trash" size={16} />Excluir</button>}
        <div className="spacer" /><button className="btn ghost" onClick={() => onClose()}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <div className="field"><label htmlFor="cc-name">Nome</label>
        <input id="cc-name" className={"input" + (touched && err ? " err" : "")} value={f.name} maxLength={40} placeholder="Ex.: Nubank, Inter, Itaú Platinum" onChange={e => setF({ ...f, name: e.target.value })} />
        {touched && err && <span className="err-text">{err}</span>}</div>
      <div className="grid2">
        <div className="field"><label htmlFor="cc-close">Dia de fechamento</label>
          <select id="cc-close" className="select" value={f.closingDay} onChange={e => setF({ ...f, closingDay: +e.target.value })}>{days.map(d => <option key={d} value={d}>Dia {d}</option>)}</select></div>
        <div className="field"><label htmlFor="cc-due">Dia de vencimento</label>
          <select id="cc-due" className="select" value={f.dueDay} onChange={e => setF({ ...f, dueDay: +e.target.value })}>{days.map(d => <option key={d} value={d}>Dia {d}</option>)}</select></div>
      </div>
      <span className="hint">Compras feitas a partir do dia {f.closingDay} entram na fatura seguinte. Hoje, uma compra cai na fatura de {monthName(billNow)}, que fecha em {D.br(dts.close)} e vence em {D.br(dts.due)}.</span>
      <div className="field"><label htmlFor="cc-limit">Limite (opcional)</label>
        <MoneyInput id="cc-limit" value={f.limitCents} onChange={v => setF({ ...f, limitCents: v })} /></div>
      <div className="field"><label>Cor</label>
        <div className="swatches">{CAT_COLORS.map(c => <button key={c} type="button" className={"sw-btn" + (f.color === c ? " on" : "")} style={{ "--sw": `var(--${c})` }} aria-label={`Cor ${c.slice(1)}`} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })}>
          <Icon name="check" size={14} sw={2.8} style={{ color: "#fff" }} /></button>)}</div></div>
    </Modal>
  );
}

export function PayBillModal({ cardId, billKey, onClose }: any) {
  const { data, actions } = useApp();
  const card = data.settings.accounts.find(a => a.id === cardId);
  const banks = data.settings.accounts.filter(a => !isCard(a));
  const bill = card ? CardMath.bill(card, data.txs, billKey) : null;
  const [from, setFrom] = useState(banks[0]?.id);
  const [amount, setAmount] = useState(bill ? bill.remaining : 0);
  const [date, setDate] = useState(D.todayISO());
  const [busy, setBusy] = useState(false);
  if (!card || !bill) return null;
  const err = !Money.isValid(amount) ? "Informe um valor maior que zero." : !D.valid(date) ? "Data inválida." : !from ? "Cadastre uma conta para pagar a fatura." : null;
  const pay = async () => {
    if (err || busy) return; setBusy(true);
    const now = Date.now(), tid = uid("x"), desc = `Fatura ${card.name} · ${monthName(bill.key)}`;
    const base = { description: desc, amountCents: amount, date, status: "paid", category: TRANSFER_CAT, transferId: tid, billMonth: bill.key, createdAt: now, updatedAt: now };
    const list = [{ ...base, id: uid("t"), type: "expense", accountId: from }, { ...base, id: uid("t"), type: "income", accountId: card.id }];
    const ok = await actions.payBill(list, amount < bill.remaining ? "Pagamento parcial registrado" : "Fatura paga");
    setBusy(false); if (ok) onClose();
  };
  return (
    <Modal title={`Pagar fatura de ${monthName(bill.key)}`} subtitle={`${card.name} · vence em ${D.br(bill.due)}`} onClose={onClose}
      footer={<><div className="spacer" /><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={pay} disabled={!!err || busy}>{busy ? "Registrando…" : "Registrar pagamento"}</button></>}>
      <dl className="kv"><dt>Total da fatura</dt><dd><Amount cents={bill.total} /></dd><dt>Já pago</dt><dd><Amount cents={bill.paid} /></dd><dt>Em aberto</dt><dd><Amount cents={bill.remaining} /></dd></dl>
      <div className="grid2">
        <div className="field"><label htmlFor="pay-amt">Valor pago</label><MoneyInput id="pay-amt" value={amount} onChange={setAmount} />
          {amount > 0 && amount < bill.remaining && <span className="hint">Pagamento parcial: ficam <Amount cents={bill.remaining - amount} /> em aberto.</span>}</div>
        <div className="field"><label htmlFor="pay-date">Data</label><input id="pay-date" type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="pay-from">Pagar com a conta</label>
        <select id="pay-from" className="select" value={from} onChange={e => setFrom(e.target.value)}>{banks.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      <div className="notice"><Icon name="info" size={18} /><div>O pagamento sai da conta e quita o cartão como transferência. Ele não conta como despesa, porque cada compra já foi contada no dia em que foi feita.</div></div>
    </Modal>
  );
}

export function CardsPage() {
  const { data, actions, cardBill, setCardBill } = useApp();
  const cards = data.settings.accounts.filter(isCard);
  const [sel, setSel] = useState(() => cards[0]?.id);
  const [cardModal, setCardModal] = useState(null);
  const card = cards.find(c => c.id === sel) || cards[0];
  const today = D.todayISO();
  const billsMap = useMemo(() => card ? CardMath.bills(card, data.txs) : new Map(), [card, data.txs]);
  if (!cards.length) {
    return <div className="pending stagger">
      <div className="card pending-hero"><div className="grid-bg" />
        <div className="ico"><Icon name="card" size={24} /></div>
        <h2>Seus cartões, com cada fatura no lugar certo.</h2>
        <p>Cadastre o cartão com o dia de fechamento e de vencimento. Depois, ao lançar uma compra, escolha “Cartão de crédito” e ela cai automaticamente na fatura certa, inclusive parcelada.</p>
        <div><button className="btn primary" onClick={() => setCardModal({})}><Icon name="plus" size={16} />Adicionar cartão</button></div>
      </div>
      <div className="card"><div className="card-head"><div><h3 className="card-title">Como funciona</h3></div></div>
        <ul className="plan-list" style={{ marginTop: 8 }}>
          {[["Compra no cartão", "Conta como gasto no dia da compra e entra na fatura do ciclo."], ["Parcelado", "Cada parcela vai para uma fatura, mês a mês."], ["Pagar a fatura", "Sai da conta como transferência, sem contar o gasto duas vezes."], ["Limite", "Mostra quanto ainda está disponível, contando parcelas futuras."]].map(([b, s], i) =>
            <li key={b}><span className="k">{pad(i + 1)}</span><div><b>{b}</b><span>{s}</span></div></li>)}
        </ul></div>
      {cardModal && <CardModal initial={null} onClose={(id) => { setCardModal(null); if (id) setSel(id); }} />}
    </div>;
  }
  const currentKey = CardMath.billOf(card, today);
  const month = cardBill || currentKey;
  const setMonth = (k) => setCardBill(k === currentKey ? null : k);
  const bill = CardMath.bill(card, data.txs, month, billsMap);
  const st = BILL_STATUS[bill.status];
  const items = bill.items.slice().sort((a, b) => b.date.localeCompare(a.date));
  const cats = Finance.byCategory(bill.items, "expense");
  const upcoming = range(6).map(i => CardMath.bill(card, data.txs, D.addMonths(currentKey, i), billsMap));
  const maxUp = Math.max(...upcoming.map(b => b.total), 1);
  const used = CardMath.used(card, data.txs);
  return (
    <div className="stagger cards-page">
      <div className="cc-row">
        {cards.map(c => <CardTile key={c.id} card={c} txs={data.txs} active={c.id === card.id} onClick={() => { setSel(c.id); setCardBill(null); }} />)}
        <button type="button" className="cc cc-add" onClick={() => setCardModal({})}><Icon name="plus" size={20} /><span>Novo cartão</span></button>
      </div>

      <div className="dash">
        <div className="card col-8">
          <div className="bill-head">
            <div>
              <div className="eyebrow">Fatura de {monthName(bill.key)}{bill.key.slice(0, 4) !== today.slice(0, 4) ? ` de ${bill.key.slice(0, 4)}` : ""} · {card.name}{bill.key === currentKey ? " · atual" : ""}</div>
              <div className="bill-total num"><Amount animate cents={bill.total} /></div>
              <div className="bill-meta">
                <span className={"pill " + st.cls}>{st.label}</span>
                <span>Fecha em <b>{D.br(bill.close)}</b></span><span>Vence em <b>{D.br(bill.due)}</b></span>
                {bill.paid > 0 && <span>Pago <b><Amount cents={bill.paid} /></b></span>}
              </div>
            </div>
            <div className="bill-acts">
              {bill.remaining > 0 && bill.status !== "open" && <button className="btn primary" onClick={() => actions.openPayBill(card.id, bill.key)}><Icon name="check" size={16} sw={2.2} />Pagar fatura</button>}
              {bill.remaining > 0 && bill.status === "open" && bill.total > 0 && <button className="btn" onClick={() => actions.openPayBill(card.id, bill.key)}>Antecipar pagamento</button>}
              <button className={"btn" + (bill.status === "open" || bill.status === "prepaid" ? " primary" : "")} onClick={() => actions.openTx({ type: "expense", accountId: card.id })}><Icon name="plus" size={16} />Nova compra</button>
              <button className="btn ghost icon" aria-label="Editar cartão" title="Editar cartão" onClick={() => setCardModal(card)}><Icon name="sliders" size={17} /></button>
            </div>
          </div>
          <div className="bill-nav">
            <button className="btn ghost sm" onClick={() => setMonth(D.addMonths(month, -1))}><Icon name="left" size={14} />{monthName(D.addMonths(month, -1))}</button>
            {month !== currentKey && <button className="link-btn" onClick={() => setMonth(currentKey)}>Ir para a fatura atual</button>}
            <button className="btn ghost sm" onClick={() => setMonth(D.addMonths(month, 1))}>{monthName(D.addMonths(month, 1))}<Icon name="right" size={14} /></button>
          </div>
          {items.length ? <div className="table-wrap"><table className="tbl resp bill-tbl">
            <thead><tr><th>Compra</th><th>Descrição</th><th>Categoria</th><th className="r">Valor</th><th className="r"><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Ações</span></th></tr></thead>
            <tbody>{items.map((t, i) => <tr key={t.id} className="tap-row" onClick={e => { if (!(e.target as HTMLElement).closest("button")) actions.openTx(t); }} style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}>
              <td className="date c-date">{D.brShort(t.date)}</td>
              <td className="desc c-desc"><b>{t.description}</b>{t.seriesId && <span><span className="series-tag" style={{ marginLeft: 0 }}><Icon name="repeat" size={11} sw={2} />{NUM_RE.test(t.description) ? "parcela" : "recorrente"} {t.seriesIndex}/{t.seriesTotal}</span></span>}</td>
              <td className="c-cat"><CatPill id={t.category} /></td>
              <td className="r amt c-amt" style={{ color: t.type === "income" ? "var(--pos)" : "var(--text)" }}><Amount cents={t.amountCents} sign={t.type === "income" ? "+" : undefined} /></td>
              <td className="c-act"><div className="row-acts">
                <button className="btn ghost icon sm" aria-label={`Editar ${t.description}`} onClick={() => actions.openTx(t)}><Icon name="pencil" size={15} /></button>
                <button className="btn ghost icon sm" aria-label={`Excluir ${t.description}`} onClick={() => actions.confirmDelete(t)}><Icon name="trash" size={15} /></button>
              </div></td>
            </tr>)}</tbody>
            {bill.payments.length > 0 && <tfoot><tr><td colSpan={5}><div className="tfoot-sum">{bill.payments.map(p => <div key={p.id}><span>Pagamento em {D.br(p.date)}</span><b style={{ color: "var(--pos)" }}><Amount cents={p.amountCents} /></b></div>)}</div></td></tr></tfoot>}
          </table></div>
            : <div className="empty-mini" style={{ padding: "48px 20px" }}><b>Nenhuma compra nesta fatura</b>Compras de {D.br(bill.open)} até a véspera de {D.br(bill.close)} entram aqui.
              <div style={{ marginTop: 12 }}><button className="btn sm" onClick={() => actions.openTx({ type: "expense", accountId: card.id })}><Icon name="plus" size={14} />Lançar compra</button></div></div>}
        </div>

        <div className="col-4" style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <div className="card">
            <div className="card-head"><div><h3 className="card-title">Limite</h3><div className="card-sub">Inclui parcelas futuras</div></div></div>
            <div className="card-body">
              {card.limitCents ? <>
                <div className="limit-figs"><div><span>Usado</span><b><Amount cents={used} /></b></div><div style={{ textAlign: "right" }}><span>Disponível</span><b style={{ color: "var(--pos)" }}><Amount cents={Math.max(card.limitCents - used, 0)} /></b></div></div>
                <div className="limit-bar"><i style={{ width: `${Math.min(used / card.limitCents, 1) * 100}%`, background: used > card.limitCents * 0.85 ? "var(--neg)" : "var(--accent)" }} /></div>
                <span className="hint">Limite total <Amount cents={card.limitCents} /></span>
              </> : <div className="empty-mini" style={{ padding: "8px 0" }}><b>Sem limite cadastrado</b><button className="link-btn" onClick={() => setCardModal(card)}>Informar limite</button></div>}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3 className="card-title">Próximas faturas</h3><div className="card-sub">Com as parcelas já lançadas</div></div></div>
            <div className="card-body"><div className="up-bills">{upcoming.map((b, i) =>
              <button key={b.key} className={"up-bill" + (b.key === month ? " on" : "")} onClick={() => setMonth(b.key)}>
                <span className="m">{monthName(b.key).slice(0, 3)}</span>
                <span className="bar"><i style={{ width: `${(b.total / maxUp) * 100}%`, animationDelay: `${120 + i * 60}ms` }} /></span>
                <span className="v"><Amount cents={b.total} /></span>
              </button>)}</div></div>
          </div>
          <div className="card">
            <div className="card-head"><div><h3 className="card-title">Gastos da fatura</h3><div className="card-sub">Por categoria</div></div></div>
            <div className="card-body"><CategoryBars data={cats} max={5} /></div>
          </div>
        </div>
      </div>
      {cardModal && <CardModal initial={cardModal.id ? cardModal : null} onClose={(id) => { setCardModal(null); if (id) setSel(id); }} />}
    </div>
  );
}
