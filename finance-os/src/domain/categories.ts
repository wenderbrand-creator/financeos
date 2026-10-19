export const CAT_COLORS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"];
export const DEFAULT_CATEGORIES = {
  expense: [
    { id: "moradia", label: "Moradia", color: "c1" },
    { id: "alimentacao", label: "Alimentação", color: "c3" },
    { id: "transporte", label: "Transporte", color: "c2" },
    { id: "saude", label: "Saúde", color: "c5" },
    { id: "educacao", label: "Educação", color: "c4" },
    { id: "lazer", label: "Lazer", color: "c7" },
    { id: "assinaturas", label: "Assinaturas", color: "c6" },
    { id: "compras", label: "Compras", color: "c10" },
    { id: "impostos", label: "Impostos e taxas", color: "c8" },
    { id: "outros-d", label: "Outros", color: "c9" },
  ],
  income: [
    { id: "salario", label: "Salário", color: "c5" },
    { id: "freelance", label: "Projetos e freelas", color: "c1" },
    { id: "vendas", label: "Vendas", color: "c6" },
    { id: "rendimentos", label: "Rendimentos", color: "c2" },
    { id: "outros-r", label: "Outros", color: "c8" },
  ],
};
/* Transfers between your own accounts (ex.: paying the card bill) move money but are not income or spending. */
export const TRANSFER_CAT = "__transfer";
export const isTransfer = (t) => t.category === TRANSFER_CAT;
export const UNKNOWN_CAT = { id: "", label: "Sem categoria", color: "var(--c8)", tone: "c8", type: null };
/* Live category registry: rebuilt from the settings currently on screen (real or demo). */
export let CAT_INDEX = {};
export let CATS = { expense: [], income: [] };
export function registerCategories(cats) {
  const map = {}, lists = { expense: [], income: [] };
  for (const type of ["expense", "income"]) for (const c of (cats && cats[type]) || []) {
    const e = { ...c, type, tone: c.color, color: `var(--${c.color})` }; map[c.id] = e; lists[type].push(e);
  }
  map[TRANSFER_CAT] = { id: TRANSFER_CAT, label: "Transferência", color: "var(--c8)", tone: "c8", type: "transfer", system: true };
  CAT_INDEX = map; CATS = lists;
}
export const catOf = id => CAT_INDEX[id] || UNKNOWN_CAT;
export function defaultCategories() { return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)); }
export function normalizeCategories(raw) {
  if (!raw || typeof raw !== "object") return defaultCategories();
  const seen = new Set(), out = {};
  for (const type of ["expense", "income"]) {
    const list = Array.isArray(raw[type]) ? raw[type].filter(c => c && typeof c.id === "string" && c.id && typeof c.label === "string" && !seen.has(c.id))
      .map(c => { seen.add(c.id); return { id: c.id, label: c.label.slice(0, 40), color: CAT_COLORS.includes(c.color) ? c.color : "c8", ...(c.archived ? { archived: true } : {}) }; }) : [];
    out[type] = list.length ? list : defaultCategories()[type].filter(c => !seen.has(c.id));
  }
  return out;
}
registerCategories(DEFAULT_CATEGORIES);
