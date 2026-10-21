import { describe, it, expect } from "vitest";
import { makeCategorizer, buildImportRows } from "../import/categorizer";
import { normalizeRules, normalizeBudgets } from "../domain/model";
import { budgetRows, averageSpend } from "../features/budget/Budget";

describe("regras de categoria", () => {
  const rules = normalizeRules([{ id: "r1", type: "expense", match: "loja central", category: "lazer" }, { type: "expense", match: "x", category: "lazer" }, { type: "bad", match: "abc", category: "lazer" }]);
  it("descarta regras inválidas", () => { expect(rules.length).toBe(1); });
  it("a regra vence o histórico e as palavras-chave", () => {
    const hist = [{ id: "t1", type: "expense", description: "PAGAMENTO PIX - 431 LOJA CENTRAL", category: "outros-d", updatedAt: 1 }];
    const cat = makeCategorizer(hist, rules)("PAGAMENTO PIX - 43192126000118 LOJA CENTRAL", "expense");
    expect(cat).toMatchObject({ id: "lazer", rule: true });
  });
  it("na importação, linhas parecidas têm a mesma chave", () => {
    const acc = { id: "a", name: "C", type: "corrente" };
    const rows = buildImportRows([{ date: "2026-10-13", cents: -5000, description: "PAGAMENTO PIX - 431 LOJA CENTRAL" }, { date: "2026-10-14", cents: -3000, description: "PAGAMENTO PIX - 999 LOJA CENTRAL" }], acc, [], [acc], rules);
    expect(rows[0].nd).toBe(rows[1].nd);
    expect(rows.every((r: any) => r.category === "lazer" && r.rule)).toBe(true);
  });
});

describe("orçamento por categoria", () => {
  const txs = [
    { type: "expense", category: "alimentacao", amountCents: 90000, date: "2026-10-05" },
    { type: "expense", category: "alimentacao", amountCents: 30000, date: "2026-10-20" },
    { type: "expense", category: "lazer", amountCents: 10000, date: "2026-10-02" },
    { type: "expense", category: "__transfer", amountCents: 500000, date: "2026-10-10" },
    { type: "expense", category: "alimentacao", amountCents: 60000, date: "2026-09-10" },
  ];
  it("calcula gasto, sobra e porcentagem, sem contar transferências", () => {
    const rows = budgetRows(txs, normalizeBudgets({ alimentacao: 100000, lazer: 50000, bad: -1 }), "2026-10");
    expect(rows.map(r => [r.id, r.spent, r.left, Math.round(r.pct * 100)])).toEqual([["alimentacao", 120000, -20000, 120], ["lazer", 10000, 40000, 20]]);
  });
  it("sugere a média dos 3 meses anteriores, arredondada", () => {
    expect(averageSpend(txs, "2026-11")).toEqual({ alimentacao: 60000, lazer: 3000 });
  });
});
