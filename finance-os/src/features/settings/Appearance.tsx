import { Icon } from "../../components/icons";
import { Seg } from "../../components/ui/inputs";
import { ACCENTS, DEFAULT_PREFS, normPrefs, hexRgb, luminance } from "../../services/prefs";
import { useApp } from "../../state/AppContext";

export function ThemeMini({ kind }: any) {
  const pal = { light: { s: "#FFFFFF", m: "#F5F6F8", l: "#E3E6EE", c: "#FFFFFF" }, dark: { s: "#151821", m: "#0D0F14", l: "#2A3040", c: "#1A1E29" } };
  const half = (k) => { const p = pal[k]; return (
    <div className="mini-half" key={k} style={{ background: p.m }}>
      <div className="s" style={{ background: p.s }}><i style={{ background: "var(--accent-base)", width: "70%" }} /><i style={{ background: p.l }} /><i style={{ background: p.l, width: "80%" }} /><i style={{ background: p.l, width: "60%" }} /></div>
      <div className="m"><i style={{ background: p.l, width: "55%" }} /><div className="c" style={{ background: p.c, border: `1px solid ${p.l}` }} /></div>
    </div>); };
  return <div className="mini" style={{ border: "1px solid var(--line)" }}>{kind === "system" ? [half("light"), half("dark")] : half(kind)}</div>;
}
export const pointOf = (e) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top + r.height / 2 }; };

export function AppearanceSection() {
  const { prefs, setPrefs } = useApp();
  const custom = !ACCENTS.some(a => a[1] === prefs.accent);
  const isDefault = JSON.stringify(prefs) === JSON.stringify(normPrefs(DEFAULT_PREFS));
  return (
    <section className="card sec" id="aparencia">
      <div className="sec-row"><div><h4>Tema</h4><p>Claro, escuro ou acompanhando o sistema.</p></div>
        <div className="theme-opts">{[["system", "Sistema", "monitor"], ["light", "Claro", "sun"], ["dark", "Escuro", "moon"]].map(([v, l, ic]) =>
          <button key={v} type="button" className={"theme-opt" + (prefs.theme === v ? " on" : "")} aria-pressed={prefs.theme === v} onClick={e => setPrefs({ theme: v }, pointOf(e))}>
            <ThemeMini kind={v} />
            <span className="lbl"><Icon name={ic} size={15} />{l}<span className="ck"><Icon name="check" size={11} sw={2.8} /></span></span>
          </button>)}</div></div>
      <div className="sec-row"><div><h4>Cor de destaque</h4><p>Botões, seleção, foco e menu. Receitas e despesas mantêm verde e vermelho para não confundir a leitura.</p></div>
        <div>
          <div className="swatches">
            {ACCENTS.map(([n, h]) => <button key={h} type="button" className={"sw-btn" + (prefs.accent === h ? " on" : "")} style={{ "--sw": h }} aria-label={n} title={n} aria-pressed={prefs.accent === h} onClick={() => setPrefs({ accent: h })}>
              <Icon name="check" size={14} sw={2.8} style={{ color: luminance(hexRgb(h)) > 0.4 ? "#0D0F14" : "#fff" }} /></button>)}
            <label className={"sw-btn sw-custom" + (custom ? " on" : "")} style={{ "--sw": prefs.accent }} title="Cor personalizada">
              {custom && <span className="dot" />}
              <input type="color" id="accent-custom" aria-label="Escolher cor personalizada" value={prefs.accent.toLowerCase()} onChange={e => setPrefs({ accent: e.target.value })} />
            </label>
            <span className="hex">{prefs.accent}</span>
          </div>
          <div className="preview-row" aria-hidden="true">
            <span className="btn primary sm" style={{ pointerEvents: "none" }}><Icon name="plus" size={14} />Novo lançamento</span>
            <span className="pill accent">Selecionado</span>
            <span className="switch on" style={{ pointerEvents: "none" }} />
            <div className="progress"><i style={{ width: "64%" }} /></div>
            <span className="hint">Pré-visualização</span>
          </div>
        </div></div>
      <div className="sec-row"><div><h4>Densidade</h4><p>Compacta mostra mais linhas por tela.</p></div>
        <div><Seg value={prefs.density} onChange={v => setPrefs({ density: v })} options={[{ value: "comfortable", label: "Confortável" }, { value: "compact", label: "Compacta" }]} /></div></div>
      <div className="sec-row"><div><h4>Animações</h4><p>Transições, contagem dos valores e desenho dos gráficos.</p></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div><Seg value={prefs.motion} onChange={v => setPrefs({ motion: v })} options={[{ value: "system", label: "Seguir sistema" }, { value: "on", label: "Ativadas" }, { value: "off", label: "Desligadas" }]} /></div>
          <span className="hint">{prefs.motion === "system" ? "Respeita a opção de reduzir movimento do seu sistema operacional." : prefs.motion === "on" ? "Animações sempre ativas." : "Tudo muda instantaneamente."}</span>
        </div></div>
      <div className="sec-row"><div><h4>Ao abrir o app</h4><p>Tela inicial e privacidade dos valores.</p></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="pref-line"><label htmlFor="pref-start" style={{ fontSize: 13.5 }}>Abrir em</label>
            <select id="pref-start" className="select" style={{ width: 200 }} value={prefs.startPage} onChange={e => setPrefs({ startPage: e.target.value })}>
              <option value="inicio">Início</option><option value="visao">Visão geral</option><option value="orcamento">Orçamento</option></select></div>
          <div className="pref-line"><span style={{ fontSize: 13.5 }}>Começar com valores ocultos</span>
            <button type="button" role="switch" aria-checked={prefs.hideOnOpen} aria-label="Começar com valores ocultos" className={"switch" + (prefs.hideOnOpen ? " on" : "")} onClick={() => setPrefs({ hideOnOpen: !prefs.hideOnOpen })} /></div>
        </div></div>
      <div className="sec-row"><div><h4>Padrão</h4><p>As preferências ficam salvas com seus dados e valem em qualquer dispositivo.</p></div>
        <div><button type="button" className="btn" disabled={isDefault} onClick={e => setPrefs(normPrefs(DEFAULT_PREFS), pointOf(e))}><Icon name="repeat" size={15} />Restaurar aparência padrão</button></div></div>
    </section>
  );
}
