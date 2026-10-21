import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { pickStore } from "./storage";
import { signOut } from "./services/auth";
import { NAV, NAV_FLAT } from "./app/nav";
import { Icon } from "./components/icons";
import { Sidebar, SaveIndicator } from "./components/layout/Sidebar";
import { ConfirmDialog } from "./components/ui/Modal";
import { registerCategories } from "./domain/categories";
import { D } from "./domain/dates";
import { buildDemoData } from "./domain/demo";
import { uid } from "./domain/ids";
import { defaultSettings } from "./domain/model";
import { Money } from "./domain/money";
import { PayBillModal, CardsPage } from "./features/cards/CardsPage";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Help } from "./features/help/Help";
import { ImportModal } from "./features/import/ImportModal";
import { Ledger } from "./features/ledger/Ledger";
import { Overview } from "./features/overview/Overview";
import { PendingModule } from "./features/pending/PendingModule";
import { pointOf } from "./features/settings/Appearance";
import { Settings } from "./features/settings/Settings";
import { Welcome } from "./features/onboarding/Welcome";
import { TxModal } from "./features/tx-form/TxModal";
import { normPrefs, applyPrefs, motionAllowed, effectiveTheme, loadUI, saveUI } from "./services/prefs";
import { AppCtx } from "./state/AppContext";
import { errMessage } from "./storage/core";
import { createMemoryStore } from "./storage/local";

export function App({ userId = null, userLogin = "" }: { userId?: string | null; userLogin?: string }) {
  const ui0 = useMemo(loadUI, []);
  const [prefs, setPrefsState] = useState(() => normPrefs(ui0.prefs));
  // routing: /inicio, /orcamento, /cartoes … (old "#orcamento" links are redirected)
  const location = useLocation(), navigate = useNavigate();
  const pathId = location.pathname.replace(/^\/+|\/+$/g, "");
  const page = NAV_FLAT.some(n => n.id === pathId) ? pathId : null;
  useEffect(() => {
    if (page) return;
    const h = (window.location.hash || "").slice(1);
    navigate("/" + (NAV_FLAT.some(n => n.id === h) ? h : normPrefs(ui0.prefs).startPage), { replace: true });
  }, [page]);
  const [collapsed, setCollapsedState] = useState(!!ui0.collapsed);
  const [hidden, setHidden] = useState(() => normPrefs(ui0.prefs).hideOnOpen || !!ui0.hidden);
  const [drawer, setDrawer] = useState(false);
  const [month, setMonth] = useState(() => D.monthOf(D.todayISO()));
  const [storeKind, setStoreKind] = useState(null);
  const [real, setReal] = useState({ settings: defaultSettings(), txs: [], ready: false, error: null });
  const [demo, setDemo] = useState(null);
  const [saveState, setSaveState] = useState({ pending: 0, error: null, at: null });
  const [modal, setModal] = useState(null);
  const [confirmReq, setConfirmReq] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [cardBill, setCardBill] = useState(null);
  const [cardSel, setCardSel] = useState(null);
  const [welcomeForced, setWelcomeForced] = useState(false);
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  const storeRef = useRef(null), demoRef = useRef(null), lastFailed = useRef(null);
  const prefsRef = useRef(prefs), realRef = useRef(real), prefsTimer = useRef<any>(0), prefsPending = useRef(false);
  realRef.current = real;
  useLayoutEffect(() => { applyPrefs(prefs); }, [prefs]);
  // adopt preferences saved with the account (another device) once data arrives
  useEffect(() => {
    if (!real.ready || prefsPending.current || !real.settings.prefs) return;
    const remote = normPrefs(real.settings.prefs);
    if (JSON.stringify(remote) !== JSON.stringify(prefsRef.current)) { prefsRef.current = remote; setPrefsState(remote); saveUI({ ...loadUI(), prefs: remote }); }
  }, [real.ready, real.settings.prefs]);
  const motionOn = motionAllowed(prefs);
  const setPrefs = (patch, point) => {
    const prev = prefsRef.current, next = normPrefs({ ...prev, ...patch });
    if (JSON.stringify(prev) === JSON.stringify(next)) return;
    const root = document.documentElement;
    const commit = () => { prefsRef.current = next; flushSync(() => setPrefsState(next)); applyPrefs(next); };
    const themeShift = effectiveTheme(prev) !== effectiveTheme(next) || prev.accent !== next.accent && !!point;
    if (themeShift && point && motionAllowed(next) && document.startViewTransition) {
      try {
        const vt = document.startViewTransition(commit);
        vt.ready.then(() => {
          const r = Math.hypot(Math.max(point.x, innerWidth - point.x), Math.max(point.y, innerHeight - point.y));
          root.animate({ clipPath: [`circle(0px at ${point.x}px ${point.y}px)`, `circle(${r}px at ${point.x}px ${point.y}px)`] },
            { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", pseudoElement: "::view-transition-new(root)" });
        }).catch(() => {});
      } catch { commit(); }
    } else {
      if (motionAllowed(next) && (effectiveTheme(prev) !== effectiveTheme(next) || prev.accent !== next.accent)) { root.classList.add("theme-fade"); setTimeout(() => root.classList.remove("theme-fade"), 450); }
      commit();
    }
    saveUI({ ...loadUI(), prefs: next });
    prefsPending.current = true;
    clearTimeout(prefsTimer.current);
    prefsTimer.current = setTimeout(async () => {
      const st = storeRef.current, r = realRef.current;
      if (st && r.ready) {
        setSaveState(x => ({ ...x, pending: x.pending + 1 }));
        try { await st.saveSettings({ ...r.settings, prefs: prefsRef.current }); setSaveState(x => ({ pending: x.pending - 1, error: null, at: Date.now() })); }
        catch (e) { const msg = errMessage(e); setSaveState(x => ({ pending: x.pending - 1, error: msg, at: x.at })); toast(msg, "err"); }
      }
      prefsPending.current = false;
    }, 700);
  };

  useEffect(() => {
    let off, dead = false;
    pickStore(userId).then(s => { if (dead) return; storeRef.current = s; setStoreKind(s.kind); off = s.subscribe(st => setReal(st)); });
    return () => { dead = true; off && off(); storeRef.current?.dispose?.(); };
  }, []);
  useEffect(() => {
    const k = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea"].includes(tag) || e.target.isContentEditable || document.querySelector(".overlay")) return;
      if (e.key === "n" || e.key === "N") { if (!realRef.current.ready && !demoRef.current) return; e.preventDefault(); setModal({ kind: "tx", tx: null }); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { const f = () => setScrolled(window.scrollY > 4); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  const setCollapsed = v => { setCollapsedState(v); saveUI({ ...loadUI(), collapsed: v }); };
  const toggleHidden = () => { setHidden(h => { saveUI({ ...loadUI(), hidden: !h }); return !h; }); };

  const isDemo = !!demo;
  const data = isDemo ? demo : real;
  const active = () => isDemo ? demoRef.current : storeRef.current;

  const dismissToast = useCallback((id) => {
    setToasts(t => t.map(x => x.id === id ? { ...x, out: true } : x));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 250);
  }, []);
  const toast = useCallback((msg: any, tone?: any, action?: any) => {
    const id = uid("n"); setToasts(t => [...t.slice(-2), { id, msg, tone, action }]);
    setTimeout(() => dismissToast(id), action ? 7000 : 3000);
  }, []);
  const run = async (fn: any, okMsg?: any) => {
    const store = active();
    if (!store) { toast("O armazenamento ainda está carregando.", "err"); return false; }
    const demoOp = store.kind === "demo";
    if (!demoOp) setSaveState(s => ({ ...s, pending: s.pending + 1 }));
    try {
      await fn(store);
      if (!demoOp) { setSaveState(s => ({ pending: s.pending - 1, error: null, at: Date.now() })); lastFailed.current = null; }
      okMsg && toast(okMsg);
      return true;
    } catch (e) {
      const msg = e && e.code === "local_write" ? "O navegador recusou a gravação local (espaço cheio ou bloqueado)." : errMessage(e);
      if (!demoOp) { setSaveState(s => ({ pending: s.pending - 1, error: msg, at: s.at })); lastFailed.current = { fn, okMsg }; }
      toast(msg, "err");
      return false;
    }
  };
  const confirm = (opts) => new Promise(res => setConfirmReq({ ...opts, res }));

  const actions = {
    toast,
    confirm,
    openTx: (tx?: any) => setModal({ kind: "tx", tx: tx || null }),
    saveTx: (tx, msg) => run(s => s.saveTx(tx), msg),
    saveMany: (list, msg) => run(s => s.saveMany(list), msg),
    togglePaid: (tx) => run(s => s.saveTx({ ...tx, late: undefined, status: tx.status === "paid" ? "pending" : "paid", updatedAt: Date.now() }),
      tx.status === "paid" ? "Marcado como pendente" : tx.type === "income" ? "Marcado como recebido" : "Marcado como pago"),
    confirmDelete: async (tx) => {
      const following = tx.seriesId ? data.txs.filter(x => x.seriesId === tx.seriesId && x.seriesIndex >= tx.seriesIndex) : [];
      let list = [tx];
      if (following.length > 1) {
        const r = await confirm({ title: "Excluir lançamento recorrente", body: <>“{tx.description}” faz parte de uma recorrência ({tx.seriesIndex} de {tx.seriesTotal}). Você pode excluir só este mês ou este e os {following.length - 1} seguintes.</>,
          altLabel: "Só este", confirmLabel: `Este e os próximos (${following.length})` });
        if (!r) return false;
        if (r === true) list = following;
      } else {
        const ok = await confirm({ title: "Excluir lançamento", body: <>“{tx.description}” de <b className="num">{Money.fmt(tx.amountCents)}</b> em {D.br(tx.date)} será removido. Os indicadores serão recalculados.</>, confirmLabel: "Excluir" });
        if (!ok) return false;
      }
      if (tx.transferId) list = data.txs.filter(x => x.transferId === tx.transferId); // remove both sides of a transfer
      const snapshot = list.map(({ late, kind, ...t }: any) => t);
      const done = await run(s => s.deleteMany(snapshot.map(t => t.id)));
      if (done) toast(snapshot.length > 1 ? `${snapshot.length} lançamentos excluídos` : "Lançamento excluído", null,
        { label: "Desfazer", fn: () => run(s => s.saveMany(snapshot), "Exclusão desfeita") });
      return done;
    },
    saveSettings: (s, msg) => { if (isDemo) { toast("Saia da demonstração para alterar seus dados.", "err"); return Promise.resolve(false); } return run(st => st.saveSettings(s), msg); },
    replaceAll: async (d, onP, msg) => {
      if (isDemo) { toast("Saia da demonstração para alterar seus dados.", "err"); return false; }
      const snap = { settings: real.settings, txs: real.txs };
      const ok = await run(st => st.replaceAll(d, onP), msg);
      if (!ok) {
        toast("A operação parou no meio. Voltando aos dados anteriores…", "err");
        const back = await run(st => st.replaceAll(snap, null), "Dados anteriores restaurados");
        if (!back) toast("Não foi possível voltar automaticamente. Restaure um backup exportado.", "err");
      }
      return ok;
    },
    openImport: (cardId?: string) => setModal({ kind: "import", cardId: typeof cardId === "string" ? cardId : undefined }),
    openWelcome: () => { if (demoRef.current) { demoRef.current = null; setDemo(null); } setWelcomeClosed(false); setWelcomeForced(true); },
    goCards: (billKey, cardId?) => { setCardBill(billKey || null); if (cardId) setCardSel(cardId); go("cartoes"); },
    openPayBill: (cardId, key) => setModal({ kind: "paybill", cardId, key }),
    payBill: async (list, msg) => {
      const ok = await run(s => s.saveMany(list));
      if (ok) toast(msg, null, { label: "Desfazer", fn: () => run(s => s.deleteMany(list.map(t => t.id)), "Pagamento desfeito") });
      return ok;
    },
    importTxs: (list, onP) => run(s => s.saveMany(list, onP)),
    undoImport: async (ids) => {
      const ok = await confirm({ title: "Desfazer importação", body: `Os ${ids.length} lançamentos criados por esta importação serão removidos.`, confirmLabel: "Desfazer importação" });
      if (!ok) return false;
      return run(s => s.deleteMany(ids), "Importação desfeita");
    },
    signOut: async () => {
      if (await confirm({ title: "Sair da conta", body: "Você vai precisar do e-mail e da senha para entrar de novo. Seus dados continuam salvos na nuvem.", confirmLabel: "Sair", tone: "primary" })) await signOut();
    },
    /** Re-reads the cloud and compares with what was sent: count, and totals per month and per account. */
    verifyData: async (expected) => {
      const st = storeRef.current; if (!st || !st.reload) return { ok: false, detail: "Armazenamento indisponível." };
      const fresh = await st.reload();
      const key = (t) => `${t.date.slice(0, 7)}|${t.accountId}|${t.type}`;
      const sum = (list) => { const m = new Map(); for (const t of list) m.set(key(t), (m.get(key(t)) || 0) + t.amountCents); return m; };
      const a = sum(expected), b = sum(fresh.txs);
      const diff = [...new Set([...a.keys(), ...b.keys()])].filter(k => a.get(k) !== b.get(k));
      const ok = fresh.txs.length === expected.length && diff.length === 0;
      return { ok, count: fresh.txs.length, expected: expected.length, groups: a.size, diff: diff.slice(0, 5) };
    },
    enterDemo: () => { const st = createMemoryStore(buildDemoData(), "demo"); demoRef.current = st; st.subscribe(v => setDemo(v)); setMonth(D.monthOf(D.todayISO())); go("inicio"); toast("Demonstração aberta. Seus dados não foram alterados."); },
    exitDemo: () => { demoRef.current = null; setDemo(null); toast("Demonstração encerrada"); },
  };
  // settings writes always target the real store, even if called from Settings while in demo
  const go = (id) => { if (id !== "cartoes") setCardBill(null); setDrawer(false); if (id !== page) navigate("/" + id); window.scrollTo({ top: 0 }); };

  registerCategories(data.settings.categories);
  const ctx = { userLogin, cardBill, setCardBill, cardSel, setCardSel, data, realData: real, month, setMonth, hidden, actions, isDemo, go, storeKind, saveState, prefs, setPrefs, motionOn };
  const effTheme = effectiveTheme(prefs);
  if (!page) return <div className="boot">Carregando Finance OS…</div>;
  const nav = NAV_FLAT.find(n => n.id === page);
  const curMonth = D.monthOf(D.todayISO());
  // greeting: the name set in Settings; otherwise the login (when it is a username, not an e-mail)
  const fallbackName = !isDemo && userLogin && !userLogin.includes("@") ? userLogin.charAt(0).toUpperCase() + userLogin.slice(1) : "";
  // first-run welcome: new accounts (never finished/skipped and no data yet), or reopened from Ajuda
  const ob = real.settings.onboarding;
  const showWelcome = !isDemo && real.ready && !real.error && !!storeKind && !welcomeClosed &&
    (welcomeForced || (!(ob && ob.done) && real.txs.length === 0));
  const name = ((data.settings.profileName || "").trim() || fallbackName).trim();
  const eyebrow = page === "inicio" ? `${D.greeting()}${name ? ", " + name : ""}` : NAV.find(g => g.items.includes(nav))?.group;
  const showMonth = ["inicio", "visao", "orcamento"].includes(page);

  let body;
  if (!real.ready && !isDemo) body = <div className="dash"><div className="skeleton col-12" style={{ height: 150 }} /><div className="skeleton col-8" style={{ height: 320 }} /><div className="skeleton col-4" style={{ height: 320 }} /></div>;
  else if (page === "inicio") body = <Dashboard />;
  else if (page === "visao") body = <Overview />;
  else if (page === "orcamento") body = <Ledger />;
  else if (page === "cartoes") body = <CardsPage />;
  else if (page === "ajuda") body = <Help />;
  else if (page === "config") body = <Settings />;
  else body = <PendingModule id={page} />;

  return (
    <AppCtx.Provider value={ctx}>
      <div className={"app" + (collapsed ? " is-collapsed" : "")}>
        <Sidebar page={page} go={go} collapsed={collapsed} setCollapsed={setCollapsed} open={drawer} storeKind={storeKind} isDemo={isDemo} />
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
        <main className="main">
          {isDemo && <div className="demo-strip"><span className="tag">Modo demonstração</span><span>Você está vendo dados fictícios. Nada do que fizer aqui é salvo ou misturado aos seus registros.</span>
            <button className="btn sm" onClick={actions.exitDemo}>Sair da demonstração</button></div>}
          {real.error && !isDemo && <div className="demo-strip" style={{ background: "var(--neg-soft)" }}><span className="tag" style={{ color: "var(--neg)" }}>Erro de leitura</span><span>Não foi possível carregar seus dados ({errMessage(real.error)}). Nada foi sobrescrito.</span>
            <button className="btn sm" onClick={() => window.location.reload()}>Recarregar</button></div>}
          <header className={"topbar" + (scrolled ? " scrolled" : "")}>
            <div className="topbar-in">
              <button className="btn icon menu-btn" onClick={() => setDrawer(true)} aria-label="Abrir menu"><Icon name="menu" /></button>
              <div className="page-head" key={page}><div className="eyebrow title-in">{eyebrow}</div><h1 className="page-title title-in" style={{ animationDelay: ".04s" }}>{nav.label}</h1></div>
              <div className="top-actions">
                <SaveIndicator state={saveState} kind={storeKind} isDemo={isDemo} onRetry={() => { const f = lastFailed.current; f && run(f.fn, f.okMsg); }} />
                <button className="btn icon ghost" onClick={e => setPrefs({ theme: effTheme === "dark" ? "light" : "dark" }, pointOf(e))} aria-label={effTheme === "dark" ? "Usar tema claro" : "Usar tema escuro"} title={effTheme === "dark" ? "Tema claro" : "Tema escuro"}><Icon name={effTheme === "dark" ? "sun" : "moon"} /></button>
                <button className="btn icon ghost" onClick={toggleHidden} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} title={hidden ? "Mostrar valores" : "Ocultar valores"}><Icon name={hidden ? "eyeOff" : "eye"} /></button>
                {showMonth && <div className="month-picker">
                  <button onClick={() => setMonth(D.addMonths(month, -1))} aria-label="Mês anterior"><Icon name="left" size={16} /></button>
                  <button className="label" onClick={() => setMonth(curMonth)} title="Voltar ao mês atual"><span className="full">{D.label(month)}</span><span className="short">{D.short(month)}</span></button>
                  <button onClick={() => setMonth(D.addMonths(month, 1))} aria-label="Próximo mês"><Icon name="right" size={16} /></button>
                </div>}
                <button className="btn primary top-new" onClick={() => actions.openTx(page === "cartoes" && cardSel ? { type: "expense", accountId: cardSel } : undefined)} disabled={!real.ready && !isDemo} title="Novo lançamento (atalho: N)"><Icon name="plus" size={16} /><span className="hide-sm">Novo lançamento</span></button>
              </div>
            </div>
          </header>
          <div className="content" key={page + (isDemo ? "-d" : "")}>{body}</div>
        </main>
        {/* phones: the main places and the "+" within thumb reach */}
        <nav className="tabbar" aria-label="Navegação rápida">
          {[["inicio", "grid", "Início"], ["orcamento", "arrows", "Lançamentos"]].map(([id, ic, l]) => <button key={id} type="button" className={page === id ? "on" : ""} aria-current={page === id ? "page" : undefined} onClick={() => go(id)}><Icon name={ic} size={20} /><span>{l}</span></button>)}
          <button type="button" className="tab-add" aria-label="Novo lançamento" disabled={!real.ready && !isDemo} onClick={() => actions.openTx(page === "cartoes" && cardSel ? { type: "expense", accountId: cardSel } : undefined)}><Icon name="plus" size={24} sw={2.2} /></button>
          <button type="button" className={page === "cartoes" ? "on" : ""} aria-current={page === "cartoes" ? "page" : undefined} onClick={() => go("cartoes")}><Icon name="card" size={20} /><span>Cartões</span></button>
          <button type="button" className={drawer || !["inicio", "orcamento", "cartoes"].includes(page) ? "on" : ""} onClick={() => setDrawer(true)}><Icon name="menu" size={20} /><span>Mais</span></button>
        </nav>
      </div>
      {modal && modal.kind === "tx" && <TxModal initial={modal.tx} onClose={() => setModal(null)} />}
      {modal && modal.kind === "import" && <ImportModal cardId={modal.cardId} onClose={() => setModal(null)} />}
      {showWelcome && <Welcome fallbackName={fallbackName} onClose={() => { setWelcomeClosed(true); setWelcomeForced(false); }} />}
      {modal && modal.kind === "paybill" && <PayBillModal cardId={modal.cardId} billKey={modal.key} onClose={() => setModal(null)} />}
      {confirmReq && <ConfirmDialog {...confirmReq} onResolve={(v) => { confirmReq.res(v); setConfirmReq(null); }} />}
      <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={"toast" + (t.tone === "err" ? " err" : "") + (t.out ? " out" : "")}><Icon name={t.tone === "err" ? "alert" : "checkCircle"} size={16} /><span>{t.msg}</span>
        {t.action && <button className="toast-act" onClick={() => { dismissToast(t.id); t.action.fn(); }}>{t.action.label}</button>}
        {t.action && <i className="toast-timer" />}</div>)}</div>
    </AppCtx.Provider>
  );
}
