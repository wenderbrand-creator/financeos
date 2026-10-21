import { Icon } from "../icons";
import { isTransfer, catOf } from "../../domain/categories";
import { D } from "../../domain/dates";

export function StatusPill({ tx, onToggle, both }: any) {
  if (isTransfer(tx)) return <span className="pill"><Icon name="arrows" size={12} sw={2} />{both ? "Entre contas" : tx.type === "income" ? "Entrada" : "Saída"}</span>;
  const today = D.todayISO();
  const late = tx.status === "pending" && tx.date < today;
  const label = tx.status === "paid" ? (tx.type === "income" ? "Recebido" : "Pago") : late ? "Atrasado" : "Pendente";
  const cls = tx.status === "paid" ? "pos" : late ? "neg" : "warn";
  const inner = <><Icon name={tx.status === "paid" ? "check" : "clock"} size={12} sw={2} />{label}</>;
  return onToggle ? <button className={"pill " + cls} onClick={onToggle} title="Alternar status">{inner}</button> : <span className={"pill " + cls}>{inner}</span>;
}
export function CatPill({ id }: any) {
  const c = catOf(id);
  return <span className="pill"><span className="d" style={{ background: c.color }} />{c.label}</span>;
}

export function TxIcon({ tx }: any) {
  const c = catOf(tx.category);
  return <div className="tx-ico" style={{ background: `color-mix(in srgb, ${c.color} 14%, transparent)`, color: c.color }}>{c.label.slice(0, 2).toUpperCase()}</div>;
}
