import { useState, useMemo } from "react";
import { Icon } from "../../components/icons";
import { Modal } from "../../components/ui/Modal";
import { MoneyInput, Seg } from "../../components/ui/inputs";
import { CardMath, buildInstallments, isCard, monthName } from "../../domain/cards";
import { TRANSFER_CAT, CATS, catOf } from "../../domain/categories";
import { pad, D } from "../../domain/dates";
import { uid } from "../../domain/ids";
import { Money } from "../../domain/money";
import { NUM_RE, stripNum, buildSeries } from "../../domain/series";
import { makeCategorizer } from "../../import/categorizer";
import { range } from "../../import/parsers";
import { useApp } from "../../state/AppContext";

/* =====================================================================
   9. TRANSACTION FORM
   ===================================================================== */
export function TxModal({ initial, onClose }: any) {
  const { data, month, actions } = useApp();
  const today = D.todayISO();
  const isEdit = !!(initial && initial.id);
  const firstCat = (type) => (CATS[type].find(c => !c.archived) || CATS[type][0] || {}).id || "";
  const cards = data.settings.accounts.filter(isCard), banks = data.settings.accounts.filter(a => !isCard(a));
  const initAcc = data.settings.accounts.find(a => a.id === initial?.accountId);
  const [f, setF] = useState(() => ({
    type: initial?.type || "expense",
    description: initial?.description || "",
    amountCents: initial?.amountCents || 0,
    category: initial?.category || firstCat(initial?.type || "expense"),
    date: initial?.date || (D.monthOf(today) === month ? today : `${month}-01`),
    status: initial?.status || "paid",
    accountId: initAcc && (!isCard(initAcc) || initial?.type === "income") ? initAcc.id : banks[0]?.id,
    payWith: isCard(initAcc) && initial?.type !== "income" ? "card" : "account",
    cardId: isCard(initAcc) ? initAcc.id : cards[0]?.id,
    installments: 1,
    repeat: false, times: 12, numbered: false,
  }));
  const [scope, setScope] = useState("one");
  const [catTouched, setCatTouched] = useState(isEdit || !!initial?.category);
  const categorize = useMemo(() => makeCategorizer(data.txs), [data.txs]);
  const setDesc = (v) => setF(p => {
    if (catTouched || !v.trim()) return { ...p, description: v };
    const sug = categorize(v, p.type);
    return { ...p, description: v, category: sug.unsure ? p.category : sug.id };
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setType = (t) => setF(p => ({ ...p, type: t, category: p.category === TRANSFER_CAT || catOf(p.category).type === t ? p.category : firstCat(t) }));
  const isTr = f.category === TRANSFER_CAT;
  const onCard = f.type === "expense" && f.payWith === "card" && cards.length > 0 && !isTr;
  const card = onCard ? cards.find(c => c.id === f.cardId) : null;
  const effAccount = onCard ? f.cardId : f.accountId;
  const split = onCard && !isEdit && f.installments > 1;
  const accountOptions = banks.concat(initAcc && isCard(initAcc) && !onCard ? [initAcc] : []);
  const series = isEdit && initial.seriesId ? data.txs.filter(t => t.seriesId === initial.seriesId) : null;
  const following = series ? series.filter(t => t.seriesIndex >= initial.seriesIndex).sort((a, b) => a.seriesIndex - b.seriesIndex) : [];
  const catOptions = CATS[f.type].filter(c => !c.archived || c.id === f.category);

  const errors: Record<string, string> = {};
  if (!f.description.trim()) errors.description = "Informe uma descrição.";
  else if (f.description.trim().length > 80) errors.description = "Use até 80 caracteres.";
  if (!Money.isValid(f.amountCents)) errors.amount = "Informe um valor maior que zero.";
  if (!D.valid(f.date)) errors.date = "Data inválida.";
  if (!isTr && catOf(f.category).type !== f.type) errors.category = "Escolha uma categoria.";
  if (!data.settings.accounts.some(a => a.id === effAccount)) errors.account = onCard ? "Escolha um cartão." : "Escolha uma conta.";
  const repeating = !isEdit && f.repeat && !split;
  if (repeating && (!Number.isInteger(f.times) || f.times < 2 || f.times > 120)) errors.times = "Use entre 2 e 120 meses.";
  const billInfo = (() => {
    if (!card || !D.valid(f.date)) return null;
    const bk = CardMath.billOf(card, f.date), dt = CardMath.dates(card, bk);
    return { bk, ...dt, last: D.addMonths(bk, Math.max(f.installments, 1) - 1) };
  })();
  const ok = !Object.keys(errors).length;

  const lastDate = (() => { if (!repeating || errors.times || !D.valid(f.date)) return null; const k = D.addMonths(D.monthOf(f.date), f.times - 1); return `${k}-${pad(Math.min(+f.date.slice(8), D.days(k)))}`; })();

  const submit = async (e) => {
    e && e.preventDefault(); setTouched(true); if (!ok || busy) return;
    setBusy(true);
    const now = Date.now();
    const tx = { id: initial?.id || uid("t"), type: f.type, description: f.description.trim(), amountCents: f.amountCents, category: f.category, date: f.date, status: onCard ? "paid" : f.status, accountId: effAccount,
      createdAt: initial?.createdAt || now, updatedAt: now,
      ...(initial?.seriesId ? { seriesId: initial.seriesId, seriesIndex: initial.seriesIndex, seriesTotal: initial.seriesTotal } : {}) };
    let saved;
    if (split) {
      saved = await actions.saveMany(buildInstallments(tx, f.installments), `Compra em ${f.installments}x lançada no ${card.name}`);
    } else if (repeating) {
      const list = buildSeries(tx, f.times, f.numbered, today).map(t => onCard ? { ...t, status: "paid" } : t);
      saved = await actions.saveMany(list, `${f.times} lançamentos mensais criados`);
    } else if (series && scope === "following" && following.length > 1) {
      const numbered = NUM_RE.test(initial.description), base = stripNum(tx.description);
      const label = (x) => numbered ? `${base} (${x.seriesIndex}/${x.seriesTotal})` : base;
      const list = following.map(x => x.id === tx.id ? { ...tx, description: label(x) }
        : { ...x, description: label(x), type: tx.type, amountCents: tx.amountCents, category: tx.category, accountId: tx.accountId, updatedAt: now });
      saved = await actions.saveMany(list, `${list.length} lançamentos atualizados`);
    } else {
      saved = await actions.saveTx(tx, isEdit ? "Lançamento atualizado" : onCard ? `Compra lançada na fatura de ${monthName(billInfo.bk)}` : "Lançamento adicionado");
    }
    setBusy(false); if (saved) onClose();
  };
  const remove = async () => { if (await actions.confirmDelete(initial)) onClose(); };
  const paidLabel = f.type === "income" ? "Recebido" : "Pago";

  return (
    <Modal title={isEdit ? "Editar lançamento" : "Novo lançamento"} subtitle={isEdit ? `Criado em ${initial.createdAt ? D.br(new Date(initial.createdAt).toISOString().slice(0, 10)) : "—"}` : "Registre uma receita ou despesa."} onClose={onClose}
      footer={<>
        {isEdit && <button className="btn danger-ghost" onClick={remove}><Icon name="trash" size={16} />Excluir</button>}
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={submit} disabled={busy}>{busy ? "Salvando…" : isEdit ? "Salvar alterações" : split ? `Lançar ${f.installments}x` : repeating && !errors.times ? `Criar ${f.times} lançamentos` : "Adicionar"}</button>
      </>}>
      <form onSubmit={submit} style={{ display: "contents" }}>
        <div className="pay-row">
          <Seg value={f.type} onChange={setType} options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }]} />
          {f.type === "expense" && !isTr && <div className="pay-with"><span>Pagar com</span>
            <Seg value={f.payWith} onChange={v => set("payWith", v)} options={[{ value: "account", label: "Conta" }, { value: "card", label: "Cartão de crédito" }]} /></div>}
        </div>
        {f.type === "expense" && f.payWith === "card" && !cards.length && <div className="notice"><Icon name="card" size={18} /><div style={{ flex: 1 }}>Você ainda não tem cartões cadastrados.
          <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => { onClose(); actions.goCards(); }}><Icon name="plus" size={14} />Adicionar cartão</button></div></div></div>}
        {series && <div className="notice"><Icon name="repeat" size={18} /><div>Lançamento {initial.seriesIndex} de {initial.seriesTotal} de uma recorrência mensal.
          {following.length > 1 && <div style={{ marginTop: 10 }}><Seg value={scope} onChange={setScope} options={[{ value: "one", label: "Alterar só este" }, { value: "following", label: `Este e os próximos (${following.length})` }]} /></div>}
          {scope === "following" && following.length > 1 && <div className="hint" style={{ marginTop: 6 }}>Descrição, valor, categoria e conta mudam em todos. Data e status mudam só neste.</div>}
        </div></div>}
        <div className="field">
          <label htmlFor="tx-desc">Descrição</label>
          <input id="tx-desc" className={"input" + (touched && errors.description ? " err" : "")} value={f.description} maxLength={90}
            placeholder={f.type === "income" ? "Ex.: Projeto de identidade visual" : "Ex.: Aluguel"} onChange={e => setDesc(e.target.value)} />
          {touched && errors.description && <span className="err-text">{errors.description}</span>}
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="tx-amount">{split ? "Valor total da compra" : repeating ? "Valor por mês" : "Valor"}</label>
            <MoneyInput id="tx-amount" value={f.amountCents} onChange={v => set("amountCents", v)} invalid={touched && errors.amount} />
            {touched && errors.amount && <span className="err-text">{errors.amount}</span>}
          </div>
          <div className="field">
            <label htmlFor="tx-date">{repeating ? "Primeira data" : onCard ? "Data da compra" : "Data"}</label>
            <input id="tx-date" type="date" className={"input" + (touched && errors.date ? " err" : "")} value={f.date} onChange={e => set("date", e.target.value)} />
            {touched && errors.date && <span className="err-text">{errors.date}</span>}
          </div>
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="tx-cat">Categoria</label>
            <select id="tx-cat" className="select" value={f.category} onChange={e => { setCatTouched(true); set("category", e.target.value); }}>
              {isTr && <option value={TRANSFER_CAT}>Transferência entre contas</option>}
              {!isTr && catOf(f.category).type !== f.type && <option value="">Escolha…</option>}
              {catOptions.map(c => <option key={c.id} value={c.id}>{c.label}{c.archived ? " (arquivada)" : ""}</option>)}
            </select>
            {touched && errors.category && <span className="err-text">{errors.category}</span>}
          </div>
          {onCard ? <div className="field">
            <label htmlFor="tx-card">Cartão</label>
            <select id="tx-card" className="select" value={f.cardId} onChange={e => set("cardId", e.target.value)}>
              {cards.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div> : <div className="field">
            <label htmlFor="tx-acc">Conta</label>
            <select id="tx-acc" className="select" value={f.accountId} onChange={e => set("accountId", e.target.value)}>
              {accountOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>}
        </div>
        {onCard && <div className="card-box">
          {!isEdit && <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="tx-inst">Parcelas</label>
            <select id="tx-inst" className="select" value={f.installments} onChange={e => set("installments", +e.target.value)}>
              {range(24).map(i => <option key={i} value={i + 1}>{i === 0 ? "À vista (1x)" : `${i + 1}x${f.amountCents ? " de " + Money.fmt(Math.floor(f.amountCents / (i + 1))) : ""}`}</option>)}
            </select>
          </div>}
          {billInfo && <div className="bill-hint"><Icon name="calendar" size={16} />
            <span>{split ? <>{f.installments} parcelas, nas faturas de <b>{monthName(billInfo.bk)}</b> a <b>{monthName(billInfo.last)}</b>{billInfo.last.slice(0, 4) !== billInfo.bk.slice(0, 4) ? ` de ${billInfo.last.slice(0, 4)}` : ""}.</>
              : <>Entra na fatura de <b>{monthName(billInfo.bk)}</b>, que fecha em {D.br(billInfo.close)} e vence em {D.br(billInfo.due)}.</>}</span></div>}
        </div>}
        {!onCard && <div className="field">
          <label>Status</label>
          <Seg value={f.status} onChange={v => set("status", v)} options={[{ value: "paid", label: paidLabel }, { value: "pending", label: "Pendente" }]} />
          <span className="hint">{f.status === "paid" ? `Entra no saldo atual a partir de ${D.br(D.valid(f.date) ? f.date : today)}.` : "Fica em próximos vencimentos e entra apenas no saldo previsto."}</span>
        </div>}
        {!isEdit && !split && <div className={"repeat-box" + (f.repeat ? " on" : "")}>
          <div className="pref-line">
            <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 550, fontSize: 13.5 }}><Icon name="repeat" size={16} />Repetir todo mês</span>
            <button type="button" role="switch" aria-checked={f.repeat} aria-label="Repetir todo mês" className={"switch" + (f.repeat ? " on" : "")} onClick={() => set("repeat", !f.repeat)} />
          </div>
          {f.repeat && onCard && <span className="hint" style={{ display: "block", marginTop: 8 }}>Assinatura mensal: cada cobrança entra na fatura do seu mês e só ocupa o limite quando for cobrada. Diferente de parcelamento.</span>}
          {f.repeat && <div className="repeat-body">
            <div className="grid2">
              <div className="field">
                <label htmlFor="tx-times">Quantidade de meses</label>
                <input id="tx-times" type="number" min="2" max="120" className={"input" + (errors.times ? " err" : "")} value={Number.isInteger(f.times) ? f.times : ""} onChange={e => set("times", parseInt(e.target.value, 10))} />
                {errors.times && <span className="err-text">{errors.times}</span>}
              </div>
              <div className="field" style={{ justifyContent: "flex-end" }}>
                <label className="check" style={{ paddingBottom: 10 }}><input type="checkbox" checked={f.numbered} onChange={e => set("numbered", e.target.checked)} />Numerar parcelas (1/{Number.isInteger(f.times) ? f.times : "N"})</label>
              </div>
            </div>
            {lastDate && <span className="hint">Cria {f.times} lançamentos, de {D.br(f.date)} a {D.br(lastDate)}. {onCard ? "Cada cobrança entra na fatura do seu mês." : "Os que vencerem depois de hoje ficam pendentes."} Dias que não existem no mês usam o último dia.</span>}
          </div>}
        </div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
