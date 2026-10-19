import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { NAV } from "../../app/nav";
import { Icon, BrandMark } from "../icons";
import { Finance } from "../../domain/finance";
import { useApp } from "../../state/AppContext";

export function Sidebar({ page, go, collapsed, setCollapsed, open, storeKind, isDemo }: any) {
  const chip = isDemo ? { icon: "flask", t: "Demonstração", s: "Nada é salvo" }
    : storeKind === "cloud" ? { icon: "cloud", t: "Nuvem privada", s: "Supabase · só você acessa" }
    : storeKind === "local" ? { icon: "drive", t: "Este navegador", s: "Exporte backups" }
    : storeKind === "memory" ? { icon: "alert", t: "Sem persistência", s: "Exporte antes de sair" }
    : { icon: "clock", t: "Conectando", s: "Verificando armazenamento" };
  const navRef = useRef(null);
  const [glow, setGlow] = useState(null);
  const [live, setLive] = useState(false);
  const measure = useCallback(() => {
    const el = navRef.current && navRef.current.querySelector(".nav-item.active");
    setGlow(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, []);
  useLayoutEffect(measure, [page, collapsed]);
  useEffect(() => { const t = setTimeout(() => setLive(true), 120); const ro = new ResizeObserver(measure); ro.observe(navRef.current); return () => { clearTimeout(t); ro.disconnect(); }; }, []);
  return (
    <aside className={"side" + (collapsed ? " collapsed" : "") + (open ? " open" : "")} aria-label="Navegação principal">
      <div className="brand"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
      <nav className={"nav" + (glow ? " glowing" : "")} ref={navRef}>
        {glow && <span aria-hidden="true" className={"nav-glow" + (live ? " live" : "")} style={{ height: glow.h, "--gy": `${glow.y}px` }} />}
        {NAV.map((g, gi) => <React.Fragment key={g.group}>
        {collapsed ? gi > 0 && <div className="nav-group-sep" /> : <div className="nav-group-label">{g.group}</div>}
        {g.items.map(it => <button key={it.id} className={"nav-item" + (page === it.id ? " active" : "")} onClick={() => go(it.id)} title={collapsed ? it.label : undefined} aria-current={page === it.id ? "page" : undefined}>
          <Icon name={it.icon} size={18} /><span className="nav-label">{it.label}</span>{!it.ready && <span className="nav-tag">em breve</span>}
        </button>)}
      </React.Fragment>)}</nav>
      <div className="side-foot">
        <div className="store-chip" title={collapsed ? `${chip.t} · ${chip.s}` : undefined}><Icon name={chip.icon} size={17} style={{ color: isDemo || storeKind !== "cloud" ? "var(--warn)" : "var(--pos)", flexShrink: 0 }} />
          <div className="side-foot-text"><b>{chip.t}</b>{chip.s}</div></div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}><Icon name="panel" size={17} /><span className="side-foot-text">Recolher menu</span></button>
        {storeKind === "cloud" && <LogoutButton collapsed={collapsed} />}
      </div>
    </aside>
  );
}

export function SaveIndicator({ state, kind, isDemo, onRetry }: any) {
  if (isDemo) return <span className="save-ind demo"><span className="dot" />Demonstração</span>;
  if (state.pending) return <span className="save-ind saving" aria-live="polite"><span className="dot" />Salvando…</span>;
  if (state.error) return <button className="save-ind error btn ghost sm" onClick={onRetry} title={state.error}><span className="dot" />Falha ao salvar</button>;
  if (kind === "local") return <span className="save-ind local hide-sm" title="Dados salvos apenas neste navegador"><span className="dot" />Salvo no navegador</span>;
  if (kind === "memory") return <span className="save-ind error hide-sm"><span className="dot" />Não salvo</span>;
  if (kind === "cloud") return <span className="save-ind hide-sm"><span className="dot" />{state.at ? "Salvo" : "Sincronizado"}</span>;
  return <span className="save-ind saving"><span className="dot" />Conectando…</span>;
}

/** Sign-out entry at the bottom of the sidebar (cloud mode only). Asks for confirmation first. */
function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { actions, userLogin } = useApp();
  return (
    <button className="collapse-btn logout-btn" onClick={actions.signOut} title={collapsed ? `Sair (${userLogin})` : undefined} aria-label="Sair da conta">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" /><path d="M10 16.5 5.5 12 10 7.5" /><path d="M5.5 12h10" />
      </svg>
      <span className="side-foot-text">Sair{userLogin ? <span style={{ color: "var(--text-3)", fontWeight: 400 }}> · {userLogin}</span> : null}</span>
      <style>{`.logout-btn:hover{color:var(--neg)!important;background:var(--neg-soft)!important}@media (max-width:760px){.logout-btn{display:flex!important}}`}</style>
    </button>
  );
}
