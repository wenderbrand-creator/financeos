import { useApp } from "../../state/AppContext";

export function Donut({ data, size = 196, thickness = 22, centerLabel, centerValue }: any) {
  const { hidden } = useApp();
  const r = (size - thickness) / 2, C = 2 * Math.PI * r;
  let off = 0; const gap = data.length > 1 ? 2 : 0;
  const sig = data.map(d => d.id + d.cents).join(",");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribuição por categoria" style={{ maxWidth: "100%" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={thickness} />
      <g key={sig} className="donut-spin">{data.map((d, i) => {
        const len = Math.max(d.share * C - gap, 0.5);
        const el = <circle key={d.id} className="donut-seg" style={{ animationDelay: `${i * 70}ms` }} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.cat.color} strokeWidth={thickness}
          strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
        off += d.share * C; return el;
      })}</g>
      <text x="50%" y="46%" textAnchor="middle" className="donut-center">{centerLabel}</text>
      <text x="50%" y="58%" textAnchor="middle" fill="var(--text)" fontSize="17" fontWeight="650" style={{ fontVariantNumeric: "tabular-nums" }}>{hidden ? "R$ •••" : centerValue}</text>
    </svg>
  );
}
