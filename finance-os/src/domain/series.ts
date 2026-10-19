import { pad, D } from "./dates";
import { uid } from "./ids";

/* ---------- recurring series (each month becomes its own record) ---------- */
export const NUM_RE = /\s*\(\d+\/\d+\)$/;
export const stripNum = (s) => s.replace(NUM_RE, "");
export function buildSeries(first, times, numbered, today) {
  const sid = uid("s"), [y, m, d] = first.date.split("-").map(Number), out = [];
  for (let i = 0; i < times; i++) {
    const k = D.addMonths(`${y}-${pad(m)}`, i), date = `${k}-${pad(Math.min(d, D.days(k)))}`;
    out.push({ ...first, id: i === 0 ? first.id : uid("t"), date,
      description: numbered ? `${first.description} (${i + 1}/${times})` : first.description,
      status: i === 0 ? first.status : date <= today ? first.status : "pending",
      seriesId: sid, seriesIndex: i + 1, seriesTotal: times });
  }
  return out;
}
