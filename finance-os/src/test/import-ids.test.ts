import { describe, it, expect } from "vitest";
import { parseCSV, autoMapCSV, csvToEntries } from "../import/parsers";
import { buildImportRows } from "../import/categorizer";

describe("importação: documento repetido no extrato", () => {
  it("gera um importId diferente para cada linha, mesmo com o mesmo número de documento", () => {
    const text = "Data;Descricao;Documento;Valor\n13/10/2026;PAGAMENTO PIX LOJA CENTRAL;4319;-100,00\n13/10/2026;PAGAMENTO PIX LOJA CENTRAL;4319;-30,00\n13/10/2026;PAGAMENTO PIX LOJA CENTRAL;4319;-50,00\n01/10/2026;CHEQUE ESPECIAL-IOF;4319;-1,58\n";
    const csv = parseCSV(text);
    const map = autoMapCSV(csv.headers, csv.records);
    const { entries } = csvToEntries(csv, map, true);
    expect(entries.length).toBe(4);
    const acc = { id: "acc1", name: "Conta", type: "corrente" };
    const rows = buildImportRows(entries, acc, [], [acc]);
    const ids = rows.map((r: any) => r.importId);
    expect(new Set(ids).size).toBe(ids.length);
    // reimportar o mesmo arquivo reconhece tudo como já importado
    const saved = rows.map((r: any, i: number) => ({ id: "t" + i, accountId: "acc1", importId: r.importId, date: r.date, amountCents: r.amountCents, type: r.type, description: r.description }));
    expect(buildImportRows(entries, acc, saved, [acc]).every((r: any) => r.dup)).toBe(true);
  });
});
