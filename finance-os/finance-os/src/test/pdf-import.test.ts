import { describe, it, expect } from "vitest";
import { parsePdfLines, groupRows } from "../import/pdf";

// linhas no formato do extrato em PDF do Sicredi (nomes e documentos fictícios)
const SICREDI = [
  "Momento de emissão   Período das movimentações",
  "21/10/2026 às 00:37:35   De 21/09/2026 a 21/10/2026",
  "Extrato de conta corrente",
  "Saldo atual   -R$ 351,86",
  "Data   Descrição   Valor",
  "Saldo Anterior   -R$ 1,07",
  "23/09/2026   PAGAMENTO PIX - 00000000000 Fulano de Tal   - R$ 21,50",
  "Saldo do dia 23/09/2026   -R$ 57,57",
  "30/09/2026   RECEBIMENTO PIX - 11111111111 Ciclana Souza   + R$ 38,00",
  "01/10/2026   CHEQUE ESPECIAL-IOF   - R$ 1,58",
  "13/10/2026   PAGAMENTO PIX - 22222222000100 LOJA   - R$ 50,00",
  "13/10/2026   PAGAMENTO PIX - 22222222000100 LOJA   - R$ 50,00",
  "13/10/2026   LIBERAÇÃO DE CRÉDITO 1004805261   + R$ 500,00",
  "Limite contratado   R$ 1.500,00",
];

describe("PDF: extrato de conta", () => {
  const r = parsePdfLines(SICREDI, { today: "2026-10-21" });
  it("reconhece extrato e ignora saldos e limites", () => {
    expect(r.kind).toBe("bank");
    expect(r.entries.length).toBe(6);
  });
  it("usa o sinal do PDF para separar entrada e saída", () => {
    const by = r.entries.map(e => [e.date, e.cents]);
    expect(by).toEqual([["2026-09-23", -2150], ["2026-09-30", 3800], ["2026-10-01", -158], ["2026-10-13", -5000], ["2026-10-13", -5000], ["2026-10-13", 50000]]);
  });
  it("sem sinal, decide pela descrição", () => {
    const x = parsePdfLines(["Extrato de conta corrente", "05/10/2026 DEPOSITO EM DINHEIRO 200,00", "06/10/2026 COMPRA DEBITO MERCADO 45,10", "07/10/2026 TARIFA PACOTE 30,00"], { today: "2026-10-21" });
    expect(x.entries.map(e => e.cents)).toEqual([20000, -4510, -3000]);
  });
});

describe("PDF: fatura de cartão", () => {
  const NUBANK = ["Fatura do cartão de crédito", "Vencimento 10/11/2026", "Total da fatura R$ 341,55", "Pagamento mínimo R$ 51,23",
    "12 OUT   Mercado Bom Preço   R$ 145,90", "15 OUT   Magazine Luiza - Parcela 3/10   R$ 150,00", "20 OUT   Estorno Netflix   −R$ 39,90", "28 SET   Pagamento recebido   −R$ 1.200,00"];
  const ITAU = ["Itaú Cartões - Fatura", "Vencimento: 20/10/2026", "03/10 POSTO SHELL   210,00", "05/10 AMAZON MKTPLACE 02/06   89,90", "07/10 PAGAMENTO EFETUADO   980,00-", "15/10 TOTAL DA FATURA   325,92"];
  it("compras sem sinal são gastos; '-' é crédito (estorno, pagamento)", () => {
    const r = parsePdfLines(NUBANK, { today: "2026-10-21" });
    expect(r.kind).toBe("card");
    expect(r.dueDate).toBe("2026-11-10");
    expect(r.entries.map(e => [e.date, e.cents])).toEqual([["2026-10-12", -14590], ["2026-10-15", -15000], ["2026-10-20", 3990], ["2026-09-28", 120000]]);
    expect(r.entries[1].installment).toEqual({ k: 3, n: 10 });
  });
  it("datas dd/mm ganham o ano da fatura e o TOTAL não vira lançamento", () => {
    const r = parsePdfLines(ITAU, { today: "2026-10-21" });
    expect(r.entries.map(e => [e.date, e.cents])).toEqual([["2026-10-03", -21000], ["2026-10-05", -8990], ["2026-10-07", 98000]]);
  });
  it("fatura de dezembro com compras de novembro não pula de ano", () => {
    const r = parsePdfLines(["Fatura", "Vencimento 05/01/2027", "28/12 LOJA A 10,00", "02/01 LOJA B 20,00"], { today: "2026-12-30" });
    expect(r.entries.map(e => e.date)).toEqual(["2026-12-28", "2027-01-02"]);
  });
});

describe("PDF: montagem das linhas", () => {
  it("junta itens da mesma linha na ordem horizontal", () => {
    const it = (s: string, x: number, y: number) => ({ str: s, transform: [1, 0, 0, 10, x, y], width: s.length * 5, height: 10 });
    expect(groupRows([it("R$ 10,00", 500, 700), it("13/10/2026", 40, 700.5), it("PIX LOJA", 120, 699.8), it("outra linha", 40, 680)]))
      .toEqual(["13/10/2026   PIX LOJA   R$ 10,00", "outra linha"]);
  });
});
