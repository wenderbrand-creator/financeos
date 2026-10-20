import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark, Icon } from "../../components/icons";
import { MoneyInput, Seg } from "../../components/ui/inputs";
import { ThemeMini, pointOf } from "../settings/Appearance";
import { ACCENTS, hexRgb, luminance } from "../../services/prefs";
import { ACCOUNT_TYPES } from "../../domain/constants";
import { CardMath, isCard, monthName } from "../../domain/cards";
import { D } from "../../domain/dates";
import { Money } from "../../domain/money";
import { uid } from "../../domain/ids";
import { useApp } from "../../state/AppContext";

/**
 * First-run welcome: 5 short steps that turn an empty account into "my" app.
 * Every step can be skipped; "Pular introdução" leaves at any time. Nothing is written
 * until the end (or skip), in one settings save, so a half-finished intro never leaves partial data.
 * Theme and accent apply live through setPrefs (already persisted per account).
 */
type Draft = {
  name: string;
  accName: string; accType: string; opening: number;
  usesCard: "yes" | "no" | null; cardName: string; closingDay: number; dueDay: number; limit: number;
};
const STEPS = ["nome", "aparencia", "conta", "cartao", "comecar"] as const;
const STEP_LABEL = ["Você", "Aparência", "Conta", "Cartão", "Começar"];
/** Light-theme values of the chart/card palette (tokens c1…c10), to pick the card color closest to the chosen accent. */
const CARD_TONES: [string, string][] = [["c1", "#5856D6"], ["c2", "#2E86B8"], ["c3", "#C9744A"], ["c4", "#8B68C8"], ["c5", "#2F9C8B"], ["c6", "#C9922C"], ["c7", "#C2577F"], ["c8", "#6C7A98"], ["c9", "#4E9A57"], ["c10", "#B4544B"]];
function toneNear(hex: string): string {
  const [r, g, b] = hexRgb(hex);
  let best = "c1", dist = Infinity;
  for (const [id, h] of CARD_TONES) { const [r2, g2, b2] = hexRgb(h); const dd = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2; if (dd < dist) { dist = dd; best = id; } }
  return best;
}

export function Welcome({ onClose, fallbackName }: { onClose: () => void; fallbackName: string }) {
  const { realData, actions, prefs, setPrefs, go, motionOn } = useApp();
  const settings = realData.settings;
  const bank = settings.accounts.find((a: any) => !isCard(a)) || settings.accounts[0];
  const hasCard = settings.accounts.some(isCard);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [d, setD] = useState<Draft>(() => ({
    name: (settings.profileName || fallbackName || "").trim(),
    accName: bank?.name || "Conta principal", accType: bank?.type || "corrente", opening: bank?.openingCents || 0,
    usesCard: hasCard ? "no" : null, cardName: "", closingDay: 3, dueDay: 10, limit: 0,
  }));
  const set = (patch: Partial<Draft>) => setD(p => ({ ...p, ...patch }));
  const bodyRef = useRef<HTMLDivElement>(null);
  const today = D.todayISO();

  // focus the first field of each step (keyboard users keep flowing with Enter)
  useEffect(() => {
    const t = setTimeout(() => { const el = bodyRef.current?.querySelector<HTMLElement>("input:not([type=color]), [data-autofocus]"); el?.focus({ preventScroll: true }); }, motionOn ? 260 : 0);
    return () => clearTimeout(t);
  }, [step]);
  // Escape = skip the whole introduction (same as the visible link)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) finish("skip"); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });

  const cardErr = d.usesCard === "yes" && !d.cardName.trim() ? "Dê um nome ao cartão." : null;
  const [touched, setTouched] = useState(false);
  const cardBill = useMemo(() => {
    if (d.usesCard !== "yes") return null;
    const c = { closingDay: d.closingDay, dueDay: d.dueDay };
    const key = CardMath.billOf(c, today); return { key, ...CardMath.dates(c, key) };
  }, [d.usesCard, d.closingDay, d.dueDay, today]);

  const go2 = (n: number) => { setDir(n > step ? 1 : -1); setTouched(false); setStep(Math.max(0, Math.min(STEPS.length - 1, n))); };
  const next = () => {
    if (STEPS[step] === "cartao" && d.usesCard === "yes" && cardErr) { setTouched(true); return; }
    go2(step + 1);
  };
  const skipStep = () => {
    // skipping a step discards what was typed in it
    if (STEPS[step] === "cartao") set({ usesCard: hasCard ? "no" : null });
    if (STEPS[step] === "conta") set({ accName: bank?.name || "Conta principal", accType: bank?.type || "corrente", opening: bank?.openingCents || 0 });
    go2(step + 1);
  };

  /** Saves everything once. mode "skip" only marks the intro as seen. */
  async function finish(mode: "done" | "skip", then?: () => void) {
    if (busy) return;
    setBusy(true);
    const onboarding = { ...(settings.onboarding || {}), done: true, skipped: mode === "skip", at: Date.now() };
    let next: any = { ...settings, prefs, onboarding };
    if (mode === "done") {
      next.profileName = d.name.trim().slice(0, 40);
      next.accounts = settings.accounts.map((a: any) => a.id === bank?.id
        ? { ...a, name: d.accName.trim().slice(0, 40) || a.name, type: d.accType, openingCents: d.opening } : a);
      if (d.usesCard === "yes" && d.cardName.trim()) {
        next.accounts = [...next.accounts, { id: uid("acc"), name: d.cardName.trim().slice(0, 30), type: "cartao", openingCents: 0,
          closingDay: d.closingDay, dueDay: d.dueDay, limitCents: d.limit, color: toneNear(prefs.accent) }];
      }
    }
    const ok = await actions.saveSettings(next, mode === "done" ? (next.profileName ? `Tudo pronto, ${next.profileName.split(" ")[0]}!` : "Tudo pronto!") : null);
    setBusy(false);
    if (!ok) return; // error toast already shown; keep the intro open so nothing is lost
    setLeaving(true);
    setTimeout(() => { onClose(); then && then(); }, motionOn ? 220 : 0);
  }

  const key = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const firstName = d.name.trim().split(" ")[0];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  let content: JSX.Element;
  if (key === "nome") content = <>
    <h2 className="wl-title">Boas-vindas ao Finance OS</h2>
    <p className="wl-lead">Em cinco passos rápidos o painel fica com a sua cara e já mostra os seus números. Dá para pular qualquer um.</p>
    <div className="field">
      <label htmlFor="wl-name">Como quer ser chamado?</label>
      <input id="wl-name" className="input wl-big" value={d.name} maxLength={40} autoComplete="given-name" placeholder="Seu nome ou apelido"
        onChange={e => set({ name: e.target.value })} onKeyDown={e => { if (e.key === "Enter") next(); }} />
      <span className="hint">Aparece na saudação do painel. Só você vê.</span>
    </div>
  </>;
  else if (key === "aparencia") content = <>
    <h2 className="wl-title">{firstName ? `Deixe com a sua cara, ${firstName}` : "Deixe com a sua cara"}</h2>
    <p className="wl-lead">Escolha o tema e a cor. A mudança é na hora, e dá para trocar depois em Configurações.</p>
    <div className="wl-themes" role="radiogroup" aria-label="Tema">
      {[["system", "Sistema", "monitor"], ["light", "Claro", "sun"], ["dark", "Escuro", "moon"]].map(([v, l, ic]) =>
        <button key={v} type="button" role="radio" aria-checked={prefs.theme === v} className={"theme-opt" + (prefs.theme === v ? " on" : "")}
          data-autofocus={prefs.theme === v ? "" : undefined} onClick={e => setPrefs({ theme: v }, pointOf(e))}>
          <ThemeMini kind={v} />
          <span className="lbl"><Icon name={ic} size={15} />{l}<span className="ck"><Icon name="check" size={11} sw={2.8} /></span></span>
        </button>)}
    </div>
    <div className="field">
      <label>Cor de destaque</label>
      <div className="swatches" role="radiogroup" aria-label="Cor de destaque">
        {ACCENTS.map(([n, h]) => <button key={h} type="button" role="radio" aria-checked={prefs.accent === h} className={"sw-btn" + (prefs.accent === h ? " on" : "")}
          style={{ "--sw": h }} aria-label={n} title={n} onClick={e => setPrefs({ accent: h }, pointOf(e))}>
          <Icon name="check" size={14} sw={2.8} style={{ color: luminance(hexRgb(h)) > 0.4 ? "#0D0F14" : "#fff" }} /></button>)}
      </div>
    </div>
    <div className="wl-preview" aria-hidden="true">
      <div className="wl-pcard"><span>{d.usesCard === "yes" && d.cardName ? d.cardName : "Seu cartão"}</span><b>R$ 1.284,90</b><i><em style={{ width: "38%" }} /></i></div>
      <div className="wl-pside">
        <span className="btn primary sm" style={{ pointerEvents: "none" }}><Icon name="plus" size={14} />Novo lançamento</span>
        <span className="pill accent">Selecionado</span>
        <span className="hint">Prévia</span>
      </div>
    </div>
  </>;
  else if (key === "conta") content = <>
    <h2 className="wl-title">Onde está o seu dinheiro hoje?</h2>
    <p className="wl-lead">Informe a conta que você mais usa e quanto tem nela agora. É o ponto de partida do seu saldo.</p>
    <div className="grid2">
      <div className="field"><label htmlFor="wl-acc">Nome da conta</label>
        <input id="wl-acc" className="input" value={d.accName} maxLength={40} placeholder="Ex.: Conta do banco" onChange={e => set({ accName: e.target.value })} /></div>
      <div className="field"><label htmlFor="wl-acctype">Tipo</label>
        <select id="wl-acctype" className="select" value={d.accType} onChange={e => set({ accType: e.target.value })}>
          {Object.entries(ACCOUNT_TYPES).filter(([k]) => k !== "cartao").map(([k, v]) => <option key={k} value={k}>{v as string}</option>)}
        </select></div>
    </div>
    <div className="field"><label htmlFor="wl-open">Saldo de hoje</label>
      <MoneyInput id="wl-open" value={d.opening} onChange={(v: number) => set({ opening: v })} />
      <span className="hint">{d.opening ? `Seu painel começa com ${Money.fmt(d.opening)} nesta conta.` : "Pode deixar em zero e ajustar depois em Configurações."}</span>
    </div>
  </>;
  else if (key === "cartao") content = <>
    <h2 className="wl-title">Você usa cartão de crédito?</h2>
    <p className="wl-lead">Com o dia de fechamento e de vencimento, cada compra cai na fatura certa e você vê o limite que sobra de verdade.</p>
    <div className="wl-choice">
      <button type="button" data-autofocus="" className={"wl-opt" + (d.usesCard === "yes" ? " on" : "")} onClick={() => set({ usesCard: "yes" })} aria-pressed={d.usesCard === "yes"}>
        <Icon name="card" size={20} /><b>Sim, uso</b><span>Vou cadastrar agora</span></button>
      <button type="button" className={"wl-opt" + (d.usesCard === "no" ? " on" : "")} onClick={() => set({ usesCard: "no" })} aria-pressed={d.usesCard === "no"}>
        <Icon name="wallet" size={20} /><b>{hasCard ? "Já cadastrei" : "Não uso"}</b><span>{hasCard ? "Seguir em frente" : "Dá para adicionar depois"}</span></button>
    </div>
    {d.usesCard === "yes" && <div className="wl-cardform">
      <div className="field"><label htmlFor="wl-cname">Nome do cartão</label>
        <input id="wl-cname" className={"input" + (touched && cardErr ? " err" : "")} value={d.cardName} maxLength={30} placeholder="Ex.: Cartão do banco" onChange={e => set({ cardName: e.target.value })} />
        {touched && cardErr && <span className="err-text">{cardErr}</span>}</div>
      <div className="grid2">
        <div className="field"><label htmlFor="wl-close">Fecha no dia</label>
          <select id="wl-close" className="select" value={d.closingDay} onChange={e => set({ closingDay: +e.target.value })}>{days.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
        <div className="field"><label htmlFor="wl-due">Vence no dia</label>
          <select id="wl-due" className="select" value={d.dueDay} onChange={e => set({ dueDay: +e.target.value })}>{days.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="wl-limit">Limite (opcional)</label><MoneyInput id="wl-limit" value={d.limit} onChange={(v: number) => set({ limit: v })} /></div>
      {cardBill && <div className="bill-hint"><Icon name="calendar" size={16} /><span>Uma compra feita hoje entra na fatura de <b>{monthName(cardBill.key)}</b>, que fecha em {D.br(cardBill.close)} e vence em {D.br(cardBill.due)}.</span></div>}
    </div>}
  </>;
  else content = <>
    <h2 className="wl-title">{firstName ? `Tudo pronto, ${firstName}. Como quer começar?` : "Tudo pronto. Como quer começar?"}</h2>
    <p className="wl-lead">Escolha um caminho. O painel ganha vida assim que entram os primeiros lançamentos.</p>
    <div className="wl-paths">
      <button type="button" className="wl-path" data-autofocus="" disabled={busy} onClick={() => finish("done", actions.openImport)}>
        <span className="wl-pico"><Icon name="upload" size={20} /></span>
        <span><b>Importar o extrato do banco</b><span>Arquivo OFX ou CSV. As categorias vêm sugeridas e nada se repete.</span></span><Icon name="right" size={16} /></button>
      <button type="button" className="wl-path" disabled={busy} onClick={() => finish("done", () => actions.openTx())}>
        <span className="wl-pico"><Icon name="plus" size={20} /></span>
        <span><b>Lançar o primeiro gasto ou receita</b><span>Leva segundos. Dica: aperte N em qualquer tela.</span></span><Icon name="right" size={16} /></button>
      <button type="button" className="wl-path" disabled={busy} onClick={() => finish("done", actions.enterDemo)}>
        <span className="wl-pico"><Icon name="flask" size={20} /></span>
        <span><b>Ver um exemplo primeiro</b><span>Dados fictícios, separados dos seus. Saia quando quiser.</span></span><Icon name="right" size={16} /></button>
    </div>
  </>;

  return (
    <div className={"wl-overlay" + (leaving ? " leaving" : "")} role="dialog" aria-modal="true" aria-labelledby="wl-heading">
      <div className="wl">
        <header className="wl-head">
          <div className="auth-brand"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
          <button type="button" className="link-btn wl-skipall" onClick={() => finish("skip")} disabled={busy}>Pular introdução</button>
        </header>
        <ol className="wl-progress" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "on" : ""}>
            <button type="button" onClick={() => i < step && go2(i)} disabled={i >= step} aria-label={`${STEP_LABEL[i]}${i < step ? " (voltar)" : ""}`}><i /></button>
            <span>{STEP_LABEL[i]}</span></li>)}
        </ol>
        <div className="wl-body" ref={bodyRef}>
          <div key={step} id="wl-heading" className={"wl-step " + (dir > 0 ? "fwd" : "back")}>{content}</div>
        </div>
        <footer className="wl-foot">
          {step > 0 ? <button type="button" className="btn ghost" onClick={() => go2(step - 1)} disabled={busy}><Icon name="left" size={16} />Voltar</button> : <span />}
          <div className="wl-foot-r">
            {!isLast && <button type="button" className="btn ghost" onClick={skipStep} disabled={busy}>Pular este passo</button>}
            {!isLast
              ? <button type="button" className="btn primary" onClick={next} disabled={busy}>Continuar<Icon name="right" size={16} /></button>
              : <button type="button" className="btn" onClick={() => finish("done", () => go("inicio"))} disabled={busy}>{busy ? "Salvando…" : "Só ir para o painel"}</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}

/** "Primeiros passos" card on the dashboard. Items tick themselves from real data. */
export function FirstSteps() {
  const { realData, actions, go, isDemo } = useApp();
  const s = realData.settings, txs = realData.txs;
  const ob = s.onboarding || {};
  if (isDemo || !ob.done || ob.checklistDismissed) return null;
  const items = [
    { id: "tx", done: txs.some((t: any) => t.category !== "__transfer"), label: "Lance seu primeiro gasto ou receita", hint: "Aperte N em qualquer tela.", cta: "Lançar", run: () => actions.openTx() },
    { id: "card", done: s.accounts.some(isCard), label: "Cadastre seu cartão de crédito", hint: "Cada compra cai na fatura certa.", cta: "Cadastrar", run: () => actions.goCards() },
    { id: "import", done: txs.some((t: any) => t.importId), label: "Importe um extrato do banco", hint: "OFX ou CSV, sem repetir lançamentos.", cta: "Importar", run: actions.openImport },
    { id: "repeat", done: txs.some((t: any) => t.seriesId), label: "Cadastre uma conta fixa ou assinatura", hint: "Aluguel, internet, streaming: use “Repetir todo mês”.", cta: "Criar", run: () => actions.openTx() },
  ];
  const doneCount = items.filter(i => i.done).length;
  if (doneCount === items.length) return null;
  const dismiss = () => actions.saveSettings({ ...s, onboarding: { ...ob, checklistDismissed: true } }, "Primeiros passos ocultos. Você encontra a introdução em Ajuda.");
  return (
    <section className="card col-12 fs" aria-label="Primeiros passos">
      <div className="fs-head">
        <div><h3 className="card-title">Primeiros passos</h3><div className="card-sub">{doneCount} de {items.length} concluídos</div></div>
        <div className="fs-bar" aria-hidden="true"><i style={{ width: `${(doneCount / items.length) * 100}%` }} /></div>
        <button type="button" className="btn ghost icon sm" onClick={dismiss} aria-label="Ocultar primeiros passos" title="Ocultar"><Icon name="x" size={16} /></button>
      </div>
      <ul className="fs-list">{items.map(i =>
        <li key={i.id} className={i.done ? "done" : ""}>
          <span className="fs-check" aria-hidden="true">{i.done && <Icon name="check" size={12} sw={2.8} />}</span>
          <div className="fs-text"><b>{i.label}</b><span>{i.done ? "Feito" : i.hint}</span></div>
          {!i.done && <button type="button" className="btn sm" onClick={i.run}>{i.cta}</button>}
        </li>)}</ul>
    </section>
  );
}

/** One-time contextual tip, remembered per account. */
export function OnceTip({ id, children }: { id: string; children: React.ReactNode }) {
  const { realData, actions, isDemo, storeKind } = useApp();
  const s = realData.settings, tips = (s.onboarding && s.onboarding.tips) || {};
  const [hidden, setHidden] = useState(false);
  if (isDemo || !storeKind || tips[id] || hidden) return null;
  const close = () => { setHidden(true); actions.saveSettings({ ...s, onboarding: { ...(s.onboarding || {}), tips: { ...tips, [id]: true } } }, null); };
  return (
    <div className="notice once-tip" role="note"><Icon name="info" size={18} /><div style={{ flex: 1 }}>{children}</div>
      <button type="button" className="btn ghost sm" onClick={close}>Entendi</button></div>
  );
}

