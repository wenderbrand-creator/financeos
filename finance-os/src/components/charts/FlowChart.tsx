import { useState } from "react";
import { Amount } from "../ui/Amount";
import { Money } from "../../domain/money";
import { useWidth } from "../../hooks/useWidth";
import { useApp } from "../../state/AppContext";

/* ---------- charts (custom SVG; see note in summary) ---------- */
export function monotonePath(p) {
  const n = p.length; if (!n) return ""; if (n === 1) return `M${p[0].x},${p[0].y}`;
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += ` C${p[i].x + h},${p[i].y + t[i] * h} ${p[i + 1].x - h},${p[i + 1].y - t[i + 1] * h} ${p[i + 1].x},${p[i + 1].y}`; }
  return d;
}
export function niceScale(maxCents, ticks = 4) {
  const max = Math.max(maxCents, 100000);
  const raw = max / ticks, pow = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  return { top: step * ticks, step };
}

export function FlowChart({ points, height = 260, labelEvery = 1, aLabel = "Receitas", bLabel = "Despesas", showResult = true }: any) {
  const { hidden } = useApp();
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const L = 52, R = 12, T = 12, B = 28;
  const iw = Math.max(0, w - L - R), ih = height - T - B;
  const max = Math.max(...points.map(p => Math.max(p.a, p.b)), 0);
  const { top, step } = niceScale(max);
  const x = i => L + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = v => T + ih - (v / top) * ih;
  const pa = points.map((p, i) => ({ x: x(i), y: y(p.a) })), pb = points.map((p, i) => ({ x: x(i), y: y(p.b) }));
  const la = monotonePath(pa), lb = monotonePath(pb);
  const base = T + ih;
  const area = (l, pts) => pts.length ? `${l} L${pts[pts.length - 1].x},${base} L${pts[0].x},${base} Z` : "";
  const ticks = []; for (let v = 0; v <= top + 1; v += step) ticks.push(v);
  const empty = max === 0;
  const hp = hover != null ? points[hover] : null;
  const sig = points.map(p => p.a + ":" + p.b).join(",");
  return (
    <div className="chart-wrap" ref={ref} style={{ height }} onMouseLeave={() => setHover(null)}>
      {w > 0 && <svg width={w} height={height} role="img" aria-label={`Gráfico de ${aLabel.toLowerCase()} e ${bLabel.toLowerCase()}`}>
        <defs>
          <linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "var(--pos)", stopOpacity: .18 }} /><stop offset="1" style={{ stopColor: "var(--pos)", stopOpacity: 0 }} /></linearGradient>
          <linearGradient id="gb" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style={{ stopColor: "var(--neg)", stopOpacity: .12 }} /><stop offset="1" style={{ stopColor: "var(--neg)", stopOpacity: 0 }} /></linearGradient>
        </defs>
        {ticks.map(v => <g key={v}>
          <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0 ? "" : "3 4"} />
          <text className="axis" x={L - 10} y={y(v) + 3.5} textAnchor="end">{hidden ? "•••" : Money.compact(v)}</text>
        </g>)}
        {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) &&
          <text key={p.key} className="axis" x={x(i)} y={height - 8} textAnchor={i === 0 && points.length > 8 ? "start" : i === points.length - 1 && points.length > 8 ? "end" : "middle"}>{p.label}</text>)}
        {!empty && <g key={sig}>
          <path className="area-in" d={area(la, pa)} fill="url(#ga)" />
          <path className="area-in" d={area(lb, pb)} fill="url(#gb)" />
          <path className="line-draw" pathLength="1" d={la} fill="none" stroke="var(--pos)" strokeWidth="2" strokeLinecap="round" />
          <path className="line-draw b" pathLength="1" d={lb} fill="none" stroke="var(--neg)" strokeWidth="2" strokeLinecap="round" />
        </g>}
        {hp && !empty && <g style={{ pointerEvents: "none" }}>
          <line className="cross" x1="0" x2="0" y1={T} y2={base} stroke="var(--line-strong)" style={{ transform: `translateX(${x(hover)}px)` }} />
          <circle className="cross" cx="0" cy="0" r="4" fill="var(--surface)" stroke="var(--pos)" strokeWidth="2" style={{ transform: `translate(${x(hover)}px,${y(hp.a)}px)` }} />
          <circle className="cross" cx="0" cy="0" r="4" fill="var(--surface)" stroke="var(--neg)" strokeWidth="2" style={{ transform: `translate(${x(hover)}px,${y(hp.b)}px)` }} />
        </g>}
        {!empty && points.map((p, i) => {
          const half = points.length === 1 ? iw / 2 : iw / (points.length - 1) / 2;
          return <rect key={p.key} x={x(i) - half} y={T} width={half * 2} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />;
        })}
        {empty && <text x={L + iw / 2} y={T + ih / 2} textAnchor="middle" fill="var(--text-3)" fontSize="13">Sem lançamentos no período</text>}
      </svg>}
      {hp && !empty && <div className="tip" style={{ left: Math.min(Math.max(x(hover), 110), w - 110), top: Math.min(y(Math.max(hp.a, hp.b)), base - 40) - 12 }}>
        <h4>{hp.title || hp.label}</h4>
        <div className="row"><span><i style={{ background: "var(--pos)" }} />{aLabel}</span><Amount cents={hp.a} /></div>
        <div className="row"><span><i style={{ background: "var(--neg)" }} />{bLabel}</span><Amount cents={hp.b} /></div>
        {showResult && <div className="row tot"><span>Resultado</span><Amount cents={hp.a - hp.b} className={hp.a - hp.b >= 0 ? "" : ""} /></div>}
      </div>}
    </div>
  );
}
