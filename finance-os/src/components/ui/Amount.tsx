import { useState, useEffect, useRef } from "react";
import { Money } from "../../domain/money";
import { useApp } from "../../state/AppContext";

export function useTween(target, dur = 750) {
  const { motionOn } = useApp();
  const [v, setV] = useState(motionOn ? 0 : target);
  const cur = useRef(motionOn ? 0 : target), raf = useRef(0);
  useEffect(() => {
    if (!motionOn) { cur.current = target; setV(target); return; }
    const a = cur.current, b = target; if (a === b) return;
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4); const val = Math.round(a + (b - a) * e); cur.current = val; setV(val); if (p < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, motionOn]);
  return v;
}
export function TweenAmount(props) { const v = useTween(props.cents); return <StaticAmount {...props} cents={v} />; }
export function Amount({ animate, ...props }: any) { return animate ? <TweenAmount {...props} /> : <StaticAmount {...props} />; }
export function StaticAmount({ cents, sign, className = "", hideCur }: any) {
  const { hidden } = useApp();
  if (hidden) return <span className={"num " + className}>R$ •••••</span>;
  const s = sign === "+" ? "+ " : sign === "-" ? "− " : "";
  const txt = Money.fmt(Math.abs(cents)); const neg = cents < 0 && !sign;
  return <span className={"num " + className}>{neg ? "− " : s}{hideCur ? txt.replace(/^R\$\s?/, "") : txt}</span>;
}
