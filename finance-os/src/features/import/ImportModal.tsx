import { reauthenticate } from "../../services/auth";
import { useState, useEffect, useRef } from "react";
import { Icon } from "../icons";
import { useApp } from "../../state/AppContext";

export function Modal({ title, subtitle, onClose, children, footer, wide, xl }: any) {
  const ref = useRef(null);
  const { motionOn } = useApp();
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(null);
  closeRef.current = () => { if (closing) return; if (!motionOn) return onClose(); setClosing(true); setTimeout(onClose, 170); };
  const close = () => closeRef.current();
  useEffect(() => {
    const k = e => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", k);
    const el = ref.current && ref.current.querySelector("input:not([type=hidden]),select,textarea,button.primary");
    el && setTimeout(() => el.focus(), 30);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <div className={"overlay" + (closing ? " closing" : "")} onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className={"modal" + (wide ? " wide" : "") + (xl ? " xl" : "")} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="btn ghost icon sm x" onClick={close} aria-label="Fechar"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, body, confirmLabel = "Confirmar", altLabel, tone = "danger", requireText, requirePassword, onResolve }: any) {
  const [typed, setTyped] = useState("");
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const ok = (!requireText || typed.trim().toUpperCase() === requireText) && (!requirePassword || pw.length > 0) && !checking;
  /** destructive actions in the cloud re-check the password on the server before running */
  const confirmIt = async () => {
    if (!requirePassword) return onResolve(true);
    setChecking(true); setPwErr(null);
    const err = await reauthenticate(pw);
    setChecking(false);
    if (err) { setPwErr(err); setPw(""); } else onResolve(true);
  };
  return (
    <Modal title={title} onClose={() => onResolve(false)}
      footer={<><div className="spacer" /><button className="btn ghost" onClick={() => onResolve(false)}>Cancelar</button>
        {altLabel && <button className="btn" onClick={() => onResolve("alt")}>{altLabel}</button>}
        <button className={"btn " + (tone === "danger" ? "danger" : "primary")} disabled={!ok} onClick={confirmIt}>{checking ? "Verificando…" : confirmLabel}</button></>}>
      <div style={{ color: "var(--text-2)" }}>{body}</div>
      {requireText && <div className="field"><label htmlFor="confirm-text">Digite <b className="mono">{requireText}</b> para confirmar</label>
        <input id="confirm-text" className="input" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" /></div>}
      {requirePassword && <div className="field"><label htmlFor="confirm-pw">Sua senha</label>
        <input id="confirm-pw" type="password" className={"input" + (pwErr ? " err" : "")} value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password"
          onKeyDown={e => { if (e.key === "Enter" && ok) confirmIt(); }} />
        {pwErr ? <span className="err-text">{pwErr}</span> : <span className="hint">Por segurança, confirme sua senha para continuar.</span>}</div>}
    </Modal>
  );
}
