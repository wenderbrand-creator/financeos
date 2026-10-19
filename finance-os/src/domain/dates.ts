export const pad = n => String(n).padStart(2, "0");
export const MONTHS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
export const MONTHS_S = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const D = {
  todayISO() { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; },
  monthOf(iso) { return iso.slice(0, 7); },
  addMonths(key, n) { let [y, m] = key.split("-").map(Number); m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return `${y}-${pad(m)}`; },
  label(key) { const [y, m] = key.split("-").map(Number); const s = MONTHS[m - 1]; return `${s[0].toUpperCase() + s.slice(1)} de ${y}`; },
  short(key) { const [y, m] = key.split("-").map(Number); const s = MONTHS_S[m - 1]; return `${s[0].toUpperCase() + s.slice(1)} ${String(y).slice(2)}`; },
  days(key) { const [y, m] = key.split("-").map(Number); return new Date(y, m, 0).getDate(); },
  endOf(key) { return `${key}-${pad(D.days(key))}`; },
  br(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; },
  brShort(iso) { const [, m, d] = iso.split("-"); return `${d}/${m}`; },
  dayMon(iso) { const [, m, d] = iso.split("-"); return { d: +d, m: MONTHS_S[+m - 1] }; },
  valid(iso) { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false; const [y, m, d] = iso.split("-").map(Number); const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d && y >= 1990 && y <= 2100; },
  greeting() { const h = new Date().getHours(); return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"; },
};
