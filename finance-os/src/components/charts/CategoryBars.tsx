import { Amount } from "../ui/Amount";

export function CategoryBars({ data, max = 6 }: any) {
  if (!data.length) return <div className="empty-mini"><b>Nenhuma despesa no mês</b>Os lançamentos aparecem aqui agrupados por categoria.</div>;
  const shown = data.slice(0, max), rest = data.slice(max);
  const rows = rest.length ? [...shown, { id: "__rest", cents: rest.reduce((s, d) => s + d.cents, 0), share: rest.reduce((s, d) => s + d.share, 0), cat: { label: `Outras ${rest.length}`, color: "var(--line-strong)" } }] : shown;
  return <div className="cat-list">{rows.map((d, i) =>
    <div className="cat-row" key={d.id}>
      <div className="n"><i style={{ background: d.cat.color }} /><span>{d.cat.label}</span></div>
      <div className="a"><Amount cents={d.cents} /><span className="p">{Math.round(d.share * 100)}%</span></div>
      <div className="track"><i style={{ width: `${Math.max(d.share * 100, 1.5)}%`, background: d.cat.color, animationDelay: `${120 + i * 60}ms` }} /></div>
    </div>)}</div>;
}
