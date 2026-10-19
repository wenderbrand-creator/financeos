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

export function ConfirmDialog({ title, body, confirmLabel = "Confirmar", altLabel, tone = "danger", requireText, onResolve }: any) {
  const [typed, setTyped] = useState("");
  const ok = !requireText || typed.trim().toUpperCase() === requireText;
  return (
    <Modal title={title} onClose={() => onResolve(false)}
      footer={<><div className="spacer" /><button className="btn ghost" onClick={() => onResolve(false)}>Cancelar</button>
        {altLabel && <button className="btn" onClick={() => onResolve("alt")}>{altLabel}</button>}
        <button className={"btn " + (tone === "danger" ? "danger" : "primary")} disabled={!ok} onClick={() => onResolve(true)}>{confirmLabel}</button></>}>
      <div style={{ color: "var(--text-2)" }}>{body}</div>
      {requireText && <div className="field"><label htmlFor="confirm-text">Digite <b className="mono">{requireText}</b> para confirmar</label>
        <input id="confirm-text" className="input" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" /></div>}
    </Modal>
  );
}
