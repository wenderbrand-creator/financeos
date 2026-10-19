import { NAV_FLAT, PENDING } from "../../app/nav";
import { Icon } from "../../components/icons";
import { pad } from "../../domain/dates";

export function PendingModule({ id }: any) {
  const p = PENDING[id]; const nav = NAV_FLAT.find(n => n.id === id);
  return (
    <div className="pending stagger">
      <div className="card pending-hero">
        <div className="grid-bg" />
        <div className="ico"><Icon name={nav.icon} size={24} /></div>
        <span className="pill warn" style={{ alignSelf: "flex-start" }}><Icon name="clock" size={12} sw={2} />Em desenvolvimento</span>
        <h2>{p.lead}</h2>
        <p>Este módulo ainda não está ativo. Nenhum dado é exibido aqui até ele ser construído e conectado aos seus lançamentos.</p>
      </div>
      <div className="card">
        <div className="card-head"><div><h3 className="card-title">O que está planejado</h3><div className="card-sub">Escopo previsto para {p.title.toLowerCase()}</div></div></div>
        <ul className="plan-list" style={{ marginTop: 8 }}>{p.steps.map(([b, s], i) =>
          <li key={b}><span className="k">{pad(i + 1)}</span><div><b>{b}</b><span>{s}</span></div></li>)}</ul>
      </div>
    </div>
  );
}
