// Same scenario used to generate expected.json from the original Artifact build.
// Shared scenario: runs the same calls against either implementation and returns plain JSON.
export function scenario(m: any): any {
  const strip = (t) => { const { id, seriesId, transferId, createdAt, updatedAt, ...r } = t; return r; };
  const out: any = {};
  const demo = m.buildDemoData();
  out.demoShape = demo.txs.map(strip).sort((a, b) => (a.date + a.description + a.amountCents).localeCompare(b.date + b.description + b.amountCents));
  out.demoSettings = demo.settings;
  const txs = m.FIXTURE ? m.FIXTURE.txs : demo.txs, accounts = m.FIXTURE ? m.FIXTURE.settings.accounts : demo.settings.accounts;
  out.fixture = { settings: m.FIXTURE ? m.FIXTURE.settings : demo.settings, txs };
  const months = []; for (let i = -7; i <= 3; i++) months.push(m.D.addMonths("2026-10", i));
  out.summary = months.map(k => [k, m.Finance.summary(m.Finance.ofMonth(txs, k))]);
  out.byCat = months.map(k => [k, m.Finance.byCategory(m.Finance.ofMonth(txs, k), "expense").map(c => [c.id, c.cents, +c.share.toFixed(10)]), m.Finance.byCategory(m.Finance.ofMonth(txs, k), "income").map(c => [c.id, c.cents])]);
  out.series12 = m.Finance.monthlySeries(txs, "2026-10", 12);
  out.daily = m.Finance.dailyCumulative(txs, "2026-10");
  out.upcoming = m.Finance.upcoming(txs, "2026-10", "2026-10-19").map(t => [t.id, t.late]);
  const banks = accounts.filter(a => a.type !== "cartao"), bankIds = new Set(banks.map(a => a.id));
  out.balances = months.map(k => [k, m.Finance.balanceAt(txs.filter(t => bankIds.has(t.accountId)), banks, m.D.endOf(k)), m.Finance.balanceAt(txs, accounts, m.D.endOf(k), true)]);
  out.accountBalances = accounts.map(a => [a.id, m.Finance.accountBalance(txs, a, "2026-10-19")]);
  const cards = accounts.filter(a => a.type === "cartao");
  out.cards = cards.map(c => ({ id: c.id, used: m.CardMath.used(c, txs), bills: months.map(k => { const b = m.CardMath.bill(c, txs, k); return [k, b.total, b.paid, b.remaining, b.status, b.close, b.due, b.open, b.items.length]; }),
    billOf: ["2026-10-02", "2026-10-03", "2026-10-31", "2026-02-28", "2026-12-31"].map(d => m.CardMath.billOf(c, d)) }));
  out.dueBills = m.CardMath.dueBills(cards, txs, "2026-10", "2026-10-19").map(b => [b.key, b.remaining, b.late]);
  out.amounts = ["1.234,56", "-1234.56", "R$ 12,00 D", "(12,00)", "1.234", "12,5", "-0.99", "45", "1,234.50", "10,00-", "abc", "", "0,005"].map(a => m.parseAmountCents(a));
  out.dates = ["2026-10-05", "05/10/2026", "5/1/26", "20261005", "31/02/2026", "x"].map(d => m.parseDateAny(d));
  const OFX = "OFXHEADER:100\n<OFX><CREDITCARDMSGSRSV1><CCSTMTRS><BANKTRANLIST>\n<STMTTRN>\n<DTPOSTED>20261012\n<TRNAMT>-45.90\n<FITID>q1\n<MEMO>IFOOD *PIZZA\n</STMTTRN>\n<STMTTRN>\n<DTPOSTED>20261013\n<TRNAMT>-110,00\n<FITID>q2\n<MEMO>OPENAI *CHATGPT\n</STMTTRN>\n<STMTTRN>\n<DTPOSTED>20261015\n<TRNAMT>2171.00\n<FITID>q3\n<MEMO>PAGAMENTO RECEBIDO\n</STMTTRN>\n</BANKTRANLIST></CCSTMTRS></CREDITCARDMSGSRSV1></OFX>";
  out.ofx = m.parseOFX(OFX);
  const CSV = "Extrato\nAgência 1\n\nData;Lançamento;Valor (R$);Saldo (R$)\n01/10/2026;SALDO ANTERIOR;;1.000,00\n02/10/2026;PIX RECEBIDO CLIENTE;2.500,00;3.500,00\n05/10/2026;PAGAMENTO FATURA CARTAO;-2.172,00;1.328,00\n06/10/2026;CEMIG ENERGIA;-210,33;1.117,67\n06/10/2026;CEMIG ENERGIA;-210,33;907,34\n";
  const csv = m.parseCSV(CSV); out.csvMap = csv.map; out.csvHeaders = csv.headers;
  const ent = m.csvToEntries(csv, csv.map, true); out.csvEntries = ent;
  const nubank = m.parseCSV("date,title,amount\n2026-10-01,Netflix.Com,55.90\n2026-10-08,Pagamento recebido,-1500.00\n");
  out.nubank = [nubank.looksCard, nubank.map, m.csvToEntries(nubank, nubank.map, false)];
  const bank = banks[0], card = cards[0];
  out.importRowsBank = m.buildImportRows(ent.entries, bank, txs, accounts);
  out.importRowsCard = card ? m.buildImportRows(out.ofx.entries, card, txs, accounts) : null;
  const cat = m.makeCategorizer(txs);
  out.categorize = ["Uber *Trip", "Supermercado BH", "Mercado Livre", "Claude Pro", "Aluguel", "Pró-labore", "Rendimento CDB", "Coisa aleatória"].map(d => [d, cat(d, "expense"), cat(d, "income")]);
  const first = { id: "t1", type: "expense", description: "Aluguel", amountCents: 245000, category: "moradia", date: "2026-01-31", status: "paid", accountId: "a", createdAt: 1, updatedAt: 1 };
  out.series = m.buildSeries(first, 5, true, "2026-03-15").map(strip);
  out.installments = m.buildInstallments({ ...first, amountCents: 100000, date: "2026-10-15" }, 3).map(strip);
  const bk = m.validateBackup(JSON.parse(m.buildBackup(out.fixture.settings, txs)));
  out.backupMeta = { ...bk.meta, exportedAt: null }; out.backupCount = bk.data.txs.length;
  out.normalizeSettings = m.normalizeSettings({ accounts: [{ id: "x", name: "Nu", type: "cartao", closingDay: 5, dueDay: 12, limitCents: 500000, color: "c3" }] });
  out.money = [0, 1, 99, 123456, -500, 100000000].map(c => [m.Money.fmt(c), m.Money.plain(c), m.Money.compact(c)]);
  return JSON.parse(JSON.stringify(out));
};
