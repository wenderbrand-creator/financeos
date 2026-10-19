import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Money } from "../../domain/money";

export function MoneyInput({ id, value, onChange, invalid }: any) {
  return (
    <div className="money-input">
      <span className="pre">R$</span>
      <input id={id} className={"input" + (invalid ? " err" : "")} inputMode="numeric" value={value ? Money.plain(value) : ""} placeholder="0,00"
        onChange={e => onChange(Money.fromDigits(e.target.value))}
        onKeyDown={(e: any) => { if (e.key === "Backspace" && e.target.selectionStart === e.target.value.length) { e.preventDefault(); onChange(Math.floor(value / 10)); } }} />
    </div>
  );
}

export function Seg({ value, onChange, options }: any) {
  const ref = useRef(null);
  const [th, setTh] = useState(null);
  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    const b = el.querySelector("button.on");
    setTh(b ? { x: b.offsetLeft, w: b.offsetWidth } : null);
  }, []);
  const sig = options.map(o => `${o.value}:${o.count ?? ""}`).join("|");
  useLayoutEffect(measure, [value, sig]);
  useEffect(() => { const ro = new ResizeObserver(measure); ro.observe(ref.current); return () => ro.disconnect(); }, []);
  return <div className={"seg" + (th ? " measured" : "")} role="tablist" ref={ref}>
    {th && <span className="seg-thumb" style={{ width: th.w, transform: `translateX(${th.x}px)` }} />}
    {options.map(o =>
    <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
      {o.label}{o.count != null && <span className="count">{o.count}</span>}</button>)}</div>;
}
