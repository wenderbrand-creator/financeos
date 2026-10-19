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
        {(isDemo || storeKind !== "cloud") && <div className="store-chip" title={collapsed ? `${chip.t} · ${chip.s}` : undefined}><Icon name={chip.icon} size={17} style={{ color: "var(--warn)", flexShrink: 0 }} />
          <div className="side-foot-text"><b>{chip.t}</b>{chip.s}</div></div>}
        {storeKind === "cloud" && <UserCard collapsed={collapsed} />}
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}><Icon name="panel" size={17} /><span className="side-foot-text">Recolher menu</span></button>
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

/** Signed-in user at the bottom of the sidebar, with the sign-out button (asks for confirmation). */
function UserCard({ collapsed }: { collapsed: boolean }) {
  const { actions, userLogin } = useApp();
  const name = userLogin || "Você";
  return (
    <div className={"user-card" + (collapsed ? " is-collapsed" : "")}>
      <span className="uc-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <div className="side-foot-text uc-text"><b>{name}</b><span>Conectado</span></div>
      <button type="button" className="uc-out" onClick={actions.signOut} aria-label="Sair da conta" title="Sair da conta">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" /><path d="M10 16.5 5.5 12 10 7.5" /><path d="M5.5 12h10" />
        </svg>
        {!collapsed && <span className="uc-out-label">Sair</span>}
      </button>
      <style>{`
.user-card{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 10px;border-radius:var(--r-md);background:var(--surface-2);min-height:48px}
.user-card .uc-avatar{width:30px;height:30px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-weight:650;font-size:13px;background:var(--accent-soft);color:var(--accent-ink)}
.user-card .uc-text{flex:1;min-width:0;display:flex;flex-direction:column;font-size:12px;color:var(--text-3)}
.user-card .uc-text b{color:var(--text);font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-card .uc-out{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--text-2);font:inherit;font-size:12.5px;font-weight:550;cursor:pointer;transition:background .15s,color .15s}
.user-card .uc-out:hover{background:var(--neg-soft);color:var(--neg)}
.user-card.is-collapsed{flex-direction:column;padding:8px 0;gap:6px}
.user-card.is-collapsed .uc-out{padding:0;width:32px;justify-content:center}
@media (max-width:760px){.user-card.is-collapsed{flex-direction:row;padding:8px 8px 8px 10px}.user-card.is-collapsed .uc-out-label{display:inline}}
`}</style>
    </div>
  );
}
