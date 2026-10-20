import { CardMath, buildInstallments } from "./cards";
import { defaultCategories } from "./categories";
import { SCHEMA_VERSION } from "./constants";
import { pad, MONTHS, D } from "./dates";

/* =====================================================================
   6. DEMO DATA — fixed values, lives only in memory, never persisted
   ===================================================================== */
export function buildDemoData() {
  const today = D.todayISO(), cur = D.monthOf(today);
  const settings = { schemaVersion: SCHEMA_VERSION, profileName: "Visitante", categories: defaultCategories(), accounts: [
    { id: "d-pessoal", name: "Conta pessoal", type: "corrente", openingCents: 1250000 },
    { id: "d-pj", name: "Conta PJ", type: "pj", openingCents: 820000 },
    { id: "d-carteira", name: "Carteira", type: "carteira", openingCents: 30000 },
    { id: "d-cartao", name: "Cartão de crédito", type: "cartao", openingCents: 0, closingDay: 3, dueDay: 10, limitCents: 800000, color: "c1" },
  ]};
  const plan = [
    // [description, type, category, account, day, [values in reais for months -5..+1]]
    ["Pró-labore", "income", "salario", "d-pessoal", 5, [9800, 9800, 9800, 9800, 9800, 9800, 9800]],
    ["Serviços prestados", "income", "freelance", "d-pj", 12, [4200, 0, 6800, 3500, 5100, 7400, 2800]],
    ["Vendas online", "income", "vendas", "d-pj", 22, [890, 1240, 0, 760, 1530, 980, 0]],
    ["Rendimento CDB", "income", "rendimentos", "d-pessoal", 28, [212, 218, 225, 231, 236, 241, 0]],
    ["Aluguel", "expense", "moradia", "d-pessoal", 10, [2450, 2450, 2450, 2450, 2450, 2450, 2450]],
    ["Condomínio", "expense", "moradia", "d-pessoal", 10, [680, 680, 680, 695, 695, 695, 695]],
    ["Energia elétrica", "expense", "moradia", "d-pessoal", 15, [214, 198, 231, 256, 240, 219, 205]],
    ["Internet fibra", "expense", "assinaturas", "d-pessoal", 15, [129.9, 129.9, 129.9, 129.9, 129.9, 129.9, 129.9]],
    ["Plano de saúde", "expense", "saude", "d-pessoal", 20, [612, 612, 612, 612, 612, 612, 612]],
    ["Supermercado", "expense", "alimentacao", "d-pessoal", 8, [1180, 1320, 1090, 1410, 1265, 1340, 0]],
    ["Restaurantes e delivery", "expense", "alimentacao", "d-cartao", 18, [420, 380, 510, 465, 398, 452, 0]],
    ["Combustível", "expense", "transporte", "d-cartao", 9, [420, 390, 455, 410, 470, 430, 0]],
    ["Apps e softwares", "expense", "assinaturas", "d-cartao", 7, [189, 189, 189, 189, 214, 214, 214]],
    ["Curso online", "expense", "educacao", "d-pessoal", 25, [297, 297, 297, 297, 297, 297, 297]],
    ["Lazer e passeios", "expense", "lazer", "d-cartao", 21, [320, 540, 210, 880, 460, 390, 0]],
    ["DAS — Simples Nacional", "expense", "impostos", "d-pj", 20, [412, 236, 498, 318, 389, 512, 380]],
  ];
  const txs = []; let n = 0;
  for (let i = -5; i <= 1; i++) {
    const k = D.addMonths(cur, i), dim = D.days(k);
    for (const [desc, type, cat, acc, day, vals] of plan as [string, string, string, string, number, number[]][]) {
      const reais = vals[i + 5]; if (!reais) continue;
      const date = `${k}-${pad(Math.min(day, dim))}`;
      txs.push({ id: `demo${++n}`, description: desc, amountCents: Math.round(reais * 100), type, category: cat, accountId: acc, date, status: date <= today ? "paid" : "pending", createdAt: 0, updatedAt: 0 });
    }
    if (i === 0) txs.push({ id: `demo${++n}`, description: "IPTU — parcela 9/10", amountCents: 31840, type: "expense", category: "impostos", accountId: "d-pessoal", date: `${k}-${pad(Math.min(3, dim))}`, status: "pending", createdAt: 0, updatedAt: 0 });
  }
  // card purchases are always "paid"; one installment purchase; bills paid from the personal account on the due date
  for (const t of txs) if (t.accountId === "d-cartao") t.status = "paid";
  const prev = D.addMonths(cur, -1);
  buildInstallments({ id: "demo-mon", description: "Monitor 27 polegadas", amountCents: 189000, type: "expense", category: "compras", accountId: "d-cartao", date: `${prev}-14`, status: "paid", createdAt: 0, updatedAt: 0 }, 3).forEach(t => txs.push(t));
  const card = settings.accounts.find(a => a.id === "d-cartao");
  const bills = CardMath.bills(card, txs);
  for (const [key, b] of bills) {
    const due = CardMath.dates(card, key).due;
    if (due > today || b.total <= 0) continue;
    const base = { description: `Fatura Cartão de crédito · ${MONTHS[+key.slice(5) - 1]}`, amountCents: b.total, date: due, status: "paid", category: "__transfer", transferId: "demo-x" + key, billMonth: key, createdAt: 0, updatedAt: 0 };
    txs.push({ ...base, id: `demo${++n}`, type: "expense", accountId: "d-pessoal" }, { ...base, id: `demo${++n}`, type: "income", accountId: "d-cartao" });
  }
  return { settings, txs };
}
