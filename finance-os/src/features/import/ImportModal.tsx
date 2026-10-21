import { useState, useMemo, useRef } from "react";
import { Icon } from "../../components/icons";
import { Amount } from "../../components/ui/Amount";
import { Modal } from "../../components/ui/Modal";
import { Seg } from "../../components/ui/inputs";
import { CAT_INDEX, CATS, catOf } from "../../domain/categories";
import { D } from "../../domain/dates";
import { uid } from "../../domain/ids";
import { Money } from "../../domain/money";
import { buildImportRows, rowsToTransactions } from "../../import/categorizer";
import { MAX_IMPORT, decodeFile, parseOFX, parseCSV, csvToEntries } from "../../import/parsers";
import { parsePdfLines, extractPdfLines } from "../../import/pdf";
import { CardMath } from "../../domain/cards";
import { useApp } from "../../state/AppContext";

/* ---------- the modal ---------- */
export const LS_IMPORT = "finance-os:import";
export function ImportModal({ onClose, cardId }: any) {
  const { data, actions, isDemo, go, setMonth } = useApp();
  const accounts = data.settings.accounts;
  const remembered = (() => { try { return JSON.parse(localStorage.getItem(LS_IMPORT) || "{}"); } catch { return {}; } })();
  const [step, setStep] = useState("file");
  // opened from the Cards page: the destination is that card, whatever the file looks like
  const fixedCard = cardId ? accounts.find(a => a.id === cardId && a.type === "cartao") : null;
  const [accountId, setAccountId] = useState(() => fixedCard ? fixedCard.id : accounts.some(a => a.id === remembered.bank) ? remembered.bank : accounts[0]?.id);
  const [file, setFile] = useState(null);        // { name, parsed }
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const [map, setMap] = useState(null);
  const [positiveIncome, setPositiveIncome] = useState(true);
  const [overrides, setOverrides] = useState({});
  const [filter, setFilter] = useState("all");
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [busyReading, setBusyReading] = useState(false);
  const [rerouted, setRerouted] = useState(false);
  // after changing one row's category: offer the same for look-alike rows, and to remember it for next imports
  const [similar, setSimilar] = useState<any>(null);
  const [learn, setLearn] = useState<Record<string, { type: string; match: string; category: string }>>({});
  const inputRef = useRef(null);
  const account = accounts.find(a => a.id === accountId) || accounts[0];
  const cards = accounts.filter(a => a.type === "cartao");

  const remember = (patch) => { try { localStorage.setItem(LS_IMPORT, JSON.stringify({ ...remembered, ...patch })); } catch { } };
  const handleFile = async (f) => {
    setError(null); setRerouted(false);
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setError("Arquivo grande demais (máximo 15 MB)."); return; }
    try {
      const buf = await f.arrayBuffer();
      const head = new Uint8Array(buf.slice(0, 5));
      if (/\.pdf$/i.test(f.name) || String.fromCharCode(...head) === "%PDF-") return await handlePdf(f, buf);
      const text = decodeFile(buf);
      const isOfx = /\.(ofx|qfx)$/i.test(f.name) || /<OFX>|OFXHEADER/i.test(text.slice(0, 2000));
      const parsed = isOfx ? parseOFX(text) : parseCSV(text);
      if (parsed.error) { setError(parsed.error); return; }
      if (isOfx && !parsed.entries.length) { setError("O arquivo OFX não tem lançamentos no período exportado."); return; }
      const kind = parsed.format === "ofx" ? parsed.kind : parsed.looksCard ? "card" : "bank";
      // pick the account that matches what the file is. From a card, only an OFX that declares itself a bank
      // statement is moved to the account (CSV cannot tell a bill from a statement reliably)
      const reroute = !!fixedCard && parsed.format === "ofx" && kind === "bank" && accounts.some(a => a.type !== "cartao");
      setRerouted(reroute);
      const pick = fixedCard && !reroute ? fixedCard : kind === "card"
        ? (cards.find(a => a.id === remembered.card) || cards.find(a => a.id === accountId) || cards[0])
        : (accounts.find(a => a.id === remembered.bank && a.type !== "cartao") || (account && account.type !== "cartao" ? account : accounts.find(a => a.type !== "cartao")));
      if (pick) setAccountId(pick.id);
      if (parsed.format === "csv") { setMap(parsed.map); setPositiveIncome(!(kind === "card" || (pick || account).type === "cartao")); }
      setOverrides({}); setFilter("all");
      setFile({ name: f.name, parsed, kind });
      setStep("review");
    } catch { setError("Não foi possível ler este arquivo. Use o PDF, OFX ou CSV baixado do app do banco."); }
  };

  // PDF: read the text in the browser, then parse with the sign rules of the destination (bill or statement)
  const handlePdf = async (f, buf) => {
    setBusyReading(true);
    try {
      const lines = await extractPdfLines(buf);
      const probe = parsePdfLines(lines);
      if (!probe.entries.length) {
        setError(lines.length < 3
          ? "Este PDF não tem texto para ler: parece uma imagem ou digitalização. Baixe o PDF direto do app do banco, ou exporte em OFX/CSV."
          : "Não encontrei lançamentos neste PDF. Confira se é o extrato da conta ou a fatura do cartão, baixados do app do banco.");
        return;
      }
      const kind = probe.kind;
      // opened from a card but the file is the account statement: send it to the account and say so
      setRerouted(!!fixedCard && kind === "bank" && accounts.some(a => a.type !== "cartao"));
      const pick = fixedCard && kind === "card" ? fixedCard : kind === "card"
        ? (cards.find(a => a.id === remembered.card) || cards.find(a => a.id === accountId) || cards[0])
        : (accounts.find(a => a.id === remembered.bank && a.type !== "cartao") || (account && account.type !== "cartao" ? account : accounts.find(a => a.type !== "cartao")));
      if (pick) setAccountId(pick.id);
      setOverrides({}); setFilter("all"); setMap(null);
      setFile({ name: f.name, parsed: { format: "pdf", lines, dueDate: probe.dueDate }, kind });
      setStep("review");
    } catch (e: any) {
      setError(e?.name === "PasswordException" ? "Este PDF está protegido por senha. Abra no app do banco e baixe uma versão sem senha, ou exporte em OFX/CSV."
        : e?.code === "too_many_pages" ? "PDF muito grande (mais de 60 páginas). Exporte um período menor."
        : "Não foi possível ler este PDF. Tente baixar de novo no app do banco, ou use OFX/CSV.");
    } finally { setBusyReading(false); }
  };

  const parsedEntries = useMemo(() => {
    if (!file) return { entries: [], bad: 0, balance: 0 };
    if (file.parsed.format === "pdf") {
      const isCard = account?.type === "cartao";
      // what is income or expense comes from the DOCUMENT (a statement's "−" is money out; a bill's "−" is a credit),
      // never from where it is being imported to
      const r = parsePdfLines(file.parsed.lines, { card: file.kind === "card" });
      let entries = r.entries;
      // card bill with a due date: every line belongs to THAT bill (installments keep the original purchase date in the PDF)
      if (isCard && file.kind === "card" && r.dueDate) {
        const w = CardMath.dates(account, r.dueDate.slice(0, 7));
        const last = (() => { const [y, m, d] = w.close.split("-").map(Number); const t = new Date(y, m - 1, d - 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; })();
        entries = entries.map(e => {
          const date = e.date < w.open ? w.open : e.date > last ? last : e.date;
          return date === e.date ? e : { ...e, date, description: e.cents < 0 ? `${e.description} · compra ${D.br(e.date).slice(0, 5)}` : e.description };
        });
      }
      return { entries, bad: r.bad, balance: r.balance };
    }
    if (file.parsed.format === "ofx") return { entries: file.parsed.entries, bad: file.parsed.bad, balance: 0 };
    if (!map || map.date < 0 || (map.amount < 0 && map.credit < 0 && map.debit < 0)) return { entries: [], bad: 0, balance: 0, unmapped: true };
    return csvToEntries(file.parsed, map, positiveIncome);
  }, [file, map, positiveIncome]);
  const rules = data.settings.rules || [];
  const baseRows = useMemo(() => account ? buildImportRows(parsedEntries.entries, account, data.txs, accounts, rules) : [], [parsedEntries, account, data.txs, accounts, rules]);
  const rows = useMemo(() => baseRows.map(r => overrides[r.key] ? { ...r, ...overrides[r.key] } : r), [baseRows, overrides]);
  const changeCat = (r, id) => {
    patch([r.key], { category: id, unsure: false, learned: false, rule: false });
    const keys = rows.filter(x => x.key !== r.key && x.nd && x.nd === r.nd && x.type === r.type && x.action === "normal" && !x.dup && x.category !== id).map(x => x.key);
    setSimilar(r.nd && r.nd.length >= 3 ? { nd: r.nd, type: r.type, category: id, label: r.description, keys } : null);
  };
  const applySimilar = (remember: boolean) => {
    if (!similar) return;
    if (similar.keys.length) patch(similar.keys, { category: similar.category, unsure: false, learned: false });
    if (remember) setLearn(l => ({ ...l, [similar.type + "|" + similar.nd]: { type: similar.type, match: similar.nd, category: similar.category } }));
    setSimilar(null);
  };
  const patch = (keys, p) => setOverrides(o => { const n = { ...o }; for (const k of keys) n[k] = { ...(n[k] || {}), ...p }; return n; });

  const counts = { all: rows.length, dup: rows.filter(r => r.dup).length, bill: rows.filter(r => r.bill).length, unsure: rows.filter(r => r.unsure && r.include && r.action === "normal").length };
  const visible = rows.filter(r => filter === "all" || (filter === "dup" && r.dup) || (filter === "bill" && r.bill) || (filter === "unsure" && r.unsure && r.action === "normal"));
  const chosen = rows.filter(r => r.include && r.action !== "skip");
  const totals = chosen.reduce((s, r) => { if (r.action.startsWith("transfer:")) s.tr += r.amountCents; else if (r.type === "income") s.inc += r.amountCents; else s.exp += r.amountCents; return s; }, { inc: 0, exp: 0, tr: 0 });
  const allVisibleOn = visible.length > 0 && visible.every(r => r.include);
  const dates = rows.map(r => r.date).sort();
  const [bulkCat, setBulkCat] = useState("");

  const createCard = async () => {
    const acc = { id: uid("acc"), name: "Cartão de crédito", type: "cartao", openingCents: 0 };
    if (await actions.saveSettings({ ...data.settings, accounts: [...accounts, acc] }, "Conta “Cartão de crédito” criada")) { setAccountId(acc.id); if (file && file.parsed.format === "csv") setPositiveIncome(false); }
  };
  const doImport = async () => {
    const list = rowsToTransactions(rows, account.id);
    if (!list.length) return;
    setStep("saving"); setProgress(0);
    const ok = await actions.importTxs(list, (p) => setProgress(p));
    if (!ok) { setStep("review"); setProgress(null); return; }
    remember(account.type === "cartao" ? { card: account.id } : { bank: account.id });
    const learned = Object.values(learn);
    if (learned.length) {
      const keep = rules.filter(r => !learned.some(l => l.type === r.type && l.match === r.match));
      await actions.saveSettings({ ...data.settings, rules: [...keep, ...learned.map(l => ({ id: uid("r"), ...l }))] }, `${learned.length} regra${learned.length === 1 ? "" : "s"} de categoria salva${learned.length === 1 ? "" : "s"}`);
      setLearn({});
    }
    const moved = chosen.filter(r => r.action.startsWith("transfer:")).length;
    setResult({ count: chosen.length - moved, transfers: moved, from: dates[0], to: dates[dates.length - 1], inc: totals.inc, exp: totals.exp, ids: list.map(t => t.id), lastMonth: D.monthOf(dates[dates.length - 1]) });
    setStep("done");
  };

  const stepIdx = { file: 0, review: 1, saving: 1, done: 2 }[step];
  const Steps = () => <ol className="imp-steps">{["Arquivo", "Revisar", "Pronto"].map((l, i) =>
    <li key={l} className={i < stepIdx ? "done" : i === stepIdx ? "on" : ""}><span>{i < stepIdx ? <Icon name="check" size={12} sw={2.8} /> : i + 1}</span>{l}</li>)}</ol>;

  const accountSelect = (
    <select id="imp-account" className="select" value={accountId} onChange={e => { setAccountId(e.target.value); setOverrides({}); const a = accounts.find(x => x.id === e.target.value); if (file && file.parsed.format === "csv" && a) setPositiveIncome(a.type !== "cartao"); }}>
      <optgroup label="Contas">{accounts.filter(a => a.type !== "cartao").map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
      {cards.length > 0 && <optgroup label="Cartões de crédito">{cards.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>}
    </select>
  );
  const actionOptions = (r) => {
    const others = accounts.filter(a => a.id !== account.id);
    return <>
      <option value="normal">{r.type === "income" ? "Lançar como receita" : "Lançar como despesa"}</option>
      {others.map(a => <option key={a.id} value={"transfer:" + a.id}>Transferência {r.type === "expense" ? "para" : "de"} {a.name}</option>)}
      <option value="skip">Ignorar</option>
    </>;
  };

  let body, footer;
  if (step === "file") {
    body = <>
      <Steps />
      <label className={"dropzone" + (drag ? " drag" : "")} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
        <input ref={inputRef} type="file" accept=".ofx,.qfx,.csv,.txt,.pdf,text/csv,application/pdf" hidden onChange={e => { handleFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
        <div className="dz-ico"><Icon name="upload" size={22} /></div>
        <b>{fixedCard ? "Arraste a fatura do cartão aqui" : "Arraste o arquivo do banco aqui"}</b>
        <span>ou <u>escolha no computador</u> · {busyReading ? "Lendo o PDF…" : fixedCard ? "PDF, OFX ou CSV da fatura, baixado do app do banco" : "PDF, OFX ou CSV · extrato da conta ou fatura do cartão"}</span>
      </label>
      {error && <div className="notice neg"><Icon name="alert" size={18} /><div>{error}</div></div>}
      <div className="imp-facts">
        <div><Icon name="search" size={16} /><span><b>Detecta sozinho</b> se é extrato ou fatura, o que é entrada e o que é saída.</span></div>
        <div><Icon name="sliders" size={16} /><span><b>Você revisa antes</b>: nada é gravado até confirmar.</span></div>
        <div><Icon name="repeat" size={16} /><span><b>Sem duplicar</b>: reimportar o mesmo período não repete lançamentos.</span></div>
      </div>
      <button type="button" className="link-btn" style={{ alignSelf: "flex-start" }} onClick={() => setShowHelp(v => !v)}>{showHelp ? "Ocultar ajuda" : "Como exportar do meu banco?"}</button>
      {showHelp && <div className="prose imp-help" style={{ padding: 0 }}>
        <p>No app ou internet banking, abra o <b>extrato</b> da conta ou a <b>fatura</b> do cartão e procure por <b>Exportar</b>, <b>Salvar como</b> ou <b>Baixar</b>. O <b>PDF</b> baixado do app funciona na maioria dos bancos. Se houver <b>OFX</b> (às vezes chamado de “Money” ou “Quicken”) ou <b>CSV</b>, eles são ainda mais precisos.</p>
        <p style={{ marginTop: 8 }}>O PDF é lido aqui no seu aparelho e não é enviado a nenhum servidor. PDF escaneado ou foto de tela ainda não são lidos.</p>
      </div>}
    </>;
    footer = <><div className="spacer" /><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={() => inputRef.current && inputRef.current.click()}><Icon name="upload" size={16} />Escolher arquivo</button></>;
  } else if (step === "review" || step === "saving") {
    const isCSV = file.parsed.format === "csv";
    const kindMismatch = (file.kind === "card") !== (account.type === "cartao");
    body = <>
      <Steps />
      <div className="imp-head">
        <div className="imp-file"><Icon name={file.kind === "card" ? "wallet" : "landmark"} size={18} />
          <div style={{ minWidth: 0 }}><b>{file.name}</b><span>{file.kind === "card" ? "Fatura de cartão" : "Extrato bancário"} · {file.parsed.format.toUpperCase()}{file.parsed.bank ? ` · ${file.parsed.bank}` : ""}{rows.length ? ` · ${D.br(dates[0])} a ${D.br(dates[dates.length - 1])}` : ""}</span></div>
          <button className="btn ghost sm" onClick={() => { setStep("file"); setFile(null); }} disabled={step === "saving"}>Trocar arquivo</button>
        </div>
        <div className="field" style={{ minWidth: 220 }}><label htmlFor="imp-account">Importar para</label>{accountSelect}</div>
      </div>
      {file.kind === "card" && !cards.length && <div className="notice warn"><Icon name="wallet" size={18} /><div style={{ flex: 1 }}>Este arquivo parece uma fatura de cartão. Crie uma conta de cartão para separar os gastos do cartão do saldo da conta corrente.
        <div style={{ marginTop: 8 }}><button className="btn sm" onClick={createCard} disabled={isDemo}><Icon name="plus" size={14} />Criar conta “Cartão de crédito”</button></div></div></div>}
      {rerouted && account.type !== "cartao" && <div className="notice warn"><Icon name="info" size={18} /><div><b>Este PDF é o extrato da conta, não a fatura do cartão.</b> Por isso ele vai para “{account.name}”: as saídas entram como despesas e as entradas como receitas. Para lançar as compras do cartão, use o PDF da <b>fatura</b>, que fica na área do cartão no app do banco.</div></div>}
      {kindMismatch && (file.kind !== "card" || cards.length > 0) && <div className="notice"><Icon name="info" size={18} /><div>O arquivo parece {file.kind === "card" ? "uma fatura de cartão" : "um extrato de conta"}, mas a conta escolhida é {account.type === "cartao" ? "um cartão" : "uma conta comum"}. Confira o destino acima.
        {(() => { const alt = file.kind === "card" ? cards[0] : accounts.find(a => a.type !== "cartao"); return alt && alt.id !== account.id ? <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => { setAccountId(alt.id); setOverrides({}); if (file.parsed.format === "csv") setPositiveIncome(alt.type !== "cartao"); }}>Importar em “{alt.name}”</button></div> : null; })()}</div></div>}
      {isCSV && map && <div className="imp-map">
        <span className="eyebrow">Colunas</span>
        {[["date", "Data"], ["desc", "Descrição"], ...(map.amount >= 0 || (map.credit < 0 && map.debit < 0) ? [["amount", "Valor"]] : [["credit", "Entradas"], ["debit", "Saídas"]])].map(([k, l]) =>
          <label key={k} className="imp-map-f"><span>{l}</span><select className="select" value={map[k]} onChange={e => { const v = +e.target.value; setMap(m => k === "amount" ? { ...m, amount: v, credit: -1, debit: -1 } : { ...m, [k]: v }); setOverrides({}); }}>
            <option value={-1}>—</option>{file.parsed.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label>)}
        {map.amount >= 0 && <div className="imp-map-f"><span>Valores positivos são</span><Seg value={positiveIncome ? "in" : "out"} onChange={v => { setPositiveIncome(v === "in"); setOverrides({}); }} options={[{ value: "in", label: "Entradas" }, { value: "out", label: "Gastos" }]} /></div>}
      </div>}
      {parsedEntries.unmapped ? <div className="notice warn"><Icon name="alert" size={18} /><div>Escolha as colunas de data e de valor para ver os lançamentos.</div></div> : !rows.length ? <div className="notice warn"><Icon name="alert" size={18} /><div>Nenhum lançamento válido encontrado com essas colunas.</div></div> : <>
        <div className="imp-toolbar">
          <Seg value={filter} onChange={setFilter} options={[{ value: "all", label: "Todos", count: counts.all }, ...(counts.unsure ? [{ value: "unsure", label: "Sem categoria certa", count: counts.unsure }] : []), ...(counts.dup ? [{ value: "dup", label: "Já existem", count: counts.dup }] : []), ...(counts.bill ? [{ value: "bill", label: "Pagamento de fatura", count: counts.bill }] : [])]} />
          <div className="grow" />
          <select className="select" aria-label="Categoria para os selecionados" value={bulkCat} onChange={e => {
            const id = e.target.value; setBulkCat(""); if (!id) return;
            const tp = CAT_INDEX[id].type, keys = visible.filter(r => r.include && r.type === tp && r.action === "normal").map(r => r.key);
            patch(keys, { category: id, unsure: false }); actions.toast(`${keys.length} lançamento${keys.length === 1 ? "" : "s"} em ${CAT_INDEX[id].label}`);
          }} style={{ width: 230, height: 34, fontSize: 13 }}>
            <option value="">Categoria para selecionados…</option>
            <optgroup label="Despesas">{CATS.expense.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
            <optgroup label="Receitas">{CATS.income.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
          </select>
        </div>
        {similar && <div className="notice imp-similar" role="status"><Icon name="sliders" size={18} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {similar.keys.length ? <><b>Mais {similar.keys.length} parecido{similar.keys.length === 1 ? "" : "s"}</b> com “{similar.label}”. Usar {CAT_INDEX[similar.category]?.label} também?</>
              : <>Usar <b>{CAT_INDEX[similar.category]?.label}</b> sempre que aparecer “{similar.label}”?</>}
            <div className="imp-similar-acts">
              {similar.keys.length > 0 && <button type="button" className="btn sm" onClick={() => applySimilar(false)}>Aplicar aos {similar.keys.length}</button>}
              <button type="button" className="btn sm primary" onClick={() => applySimilar(true)}>{similar.keys.length ? "Aplicar e lembrar" : "Lembrar nas próximas"}</button>
              <button type="button" className="btn ghost sm" onClick={() => setSimilar(null)}>Agora não</button>
            </div>
          </div></div>}
        {Object.keys(learn).length > 0 && <p className="imp-learn-note"><Icon name="checkCircle" size={13} sw={2} />{Object.keys(learn).length} regra{Object.keys(learn).length === 1 ? "" : "s"} será{Object.keys(learn).length === 1 ? "" : "ão"} salva{Object.keys(learn).length === 1 ? "" : "s"} ao importar. Você pode editar em Configurações.</p>}
        <div className="imp-table">
          <table className="tbl resp imp-tbl">
            <thead><tr>
              <th style={{ width: 36 }}><input type="checkbox" aria-label="Selecionar todos" checked={allVisibleOn} onChange={e => patch(visible.map(r => r.key), { include: e.target.checked })} /></th>
              <th>Data</th><th>Descrição</th><th>Categoria</th><th className="r">Valor</th>
            </tr></thead>
            <tbody>{visible.map((r, i) => {
              const off = !r.include || r.action === "skip";
              return <tr key={r.key} className={off ? "off" : ""} style={{ animationDelay: `${Math.min(i, 14) * 18}ms` }}>
                <td className="c-chk"><input type="checkbox" aria-label={`Incluir ${r.description}`} checked={r.include} onChange={e => patch([r.key], { include: e.target.checked })} /></td>
                <td className="date c-date">{D.brShort(r.date)}</td>
                <td className="desc c-desc"><b title={r.description}>{r.description}</b>
                  <span className="imp-tags">
                    {r.dup && <span className="pill warn">Já existe</span>}
                    {r.bill && <span className="pill accent">Pagamento de fatura</span>}
                    {r.status === "pending" && <span className="pill">Futuro · pendente</span>}
                    {r.rule && r.action === "normal" && !r.dup && <span className="learned" title="Categoria definida por uma regra sua"><Icon name="checkCircle" size={11} sw={2} />pela sua regra</span>}
                    {r.learned && r.action === "normal" && !r.dup && <span className="learned" title="Mesma categoria que você usou antes para essa descrição"><Icon name="checkCircle" size={11} sw={2} />do seu histórico</span>}
                  </span></td>
                <td className="act c-cat">{r.bill || r.action !== "normal"
                  ? <select className="select sm-sel" value={r.action} aria-label="Ação" onChange={e => patch([r.key], { action: e.target.value })}>{actionOptions(r)}</select>
                  : <div className="cat-cell"><span className="d" style={{ background: catOf(r.category).color }} />
                    <select className={"select sm-sel" + (r.unsure ? " unsure" : "")} value={r.category} aria-label="Categoria" onChange={e => changeCat(r, e.target.value)}>
                      {CATS[r.type].filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select></div>}</td>
                <td className="r amt c-amt" style={{ color: r.type === "income" ? "var(--pos)" : "var(--text)" }}><Amount cents={r.amountCents} sign={r.type === "income" ? "+" : "-"} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {(parsedEntries.bad > 0 || parsedEntries.balance > 0 || parsedEntries.entries.length > MAX_IMPORT) && <span className="hint">
          {parsedEntries.balance > 0 && `${parsedEntries.balance} linha${parsedEntries.balance === 1 ? "" : "s"} de saldo ignorada${parsedEntries.balance === 1 ? "" : "s"}. `}
          {parsedEntries.bad > 0 && `${parsedEntries.bad} linha${parsedEntries.bad === 1 ? "" : "s"} sem data ou valor válidos ignorada${parsedEntries.bad === 1 ? "" : "s"}. `}
          {parsedEntries.entries.length > MAX_IMPORT && `Mostrando os primeiros ${MAX_IMPORT} lançamentos; importe períodos menores.`}</span>}
        {counts.bill > 0 && <div className="notice"><Icon name="info" size={18} /><div>{account.type === "cartao"
          ? "Créditos de pagamento da fatura ficam ignorados: o pagamento entra quando você importa o extrato da conta como transferência. Assim cada compra conta uma vez só."
          : cards.length ? "Pagamentos de fatura entram como transferência para o cartão, sem contar como despesa: as compras já são contadas quando você importa a fatura." : "Se você também for importar a fatura do cartão, crie uma conta de cartão e marque o pagamento como transferência. Assim as compras não contam duas vezes."}</div></div>}
      </>}
      {step === "saving" && <div className="progress"><i style={{ width: `${(progress || 0) * 100}%` }} /></div>}
    </>;
    footer = <>
      <div className="imp-sum">
        <span><b className="num">{chosen.length}</b> de {rows.length} selecionados</span>
        {totals.inc > 0 && <span className="pos-t"><Amount cents={totals.inc} sign="+" /></span>}
        {totals.exp > 0 && <span><Amount cents={totals.exp} sign="-" /></span>}
        {totals.tr > 0 && <span className="muted">transf. <Amount cents={totals.tr} /></span>}
      </div>
      <div className="spacer" />
      <button className="btn ghost" onClick={onClose} disabled={step === "saving"}>Cancelar</button>
      <button className="btn primary" onClick={doImport} disabled={!chosen.length || step === "saving"}>{step === "saving" ? `Importando… ${Math.round((progress || 0) * 100)}%` : `Importar ${chosen.length} lançamento${chosen.length === 1 ? "" : "s"}`}</button>
    </>;
  } else {
    body = <>
      <Steps />
      <div className="imp-done">
        <div className="imp-done-ico"><Icon name="check" size={28} sw={2.4} /></div>
        <h3>{result.count + result.transfers} lançamento{result.count + result.transfers === 1 ? "" : "s"} importado{result.count + result.transfers === 1 ? "" : "s"}</h3>
        <p>Em {account.name}, de {D.br(result.from)} a {D.br(result.to)}.{result.transfers ? ` ${result.transfers} pagamento${result.transfers === 1 ? "" : "s"} de fatura entr${result.transfers === 1 ? "ou" : "aram"} como transferência.` : ""}</p>
        <div className="imp-done-figs">
          <div><span>Entradas</span><Amount cents={result.inc} /></div>
          <div><span>Saídas</span><Amount cents={result.exp} /></div>
        </div>
      </div>
    </>;
    footer = <>
      <button className="btn danger-ghost" onClick={async () => { if (await actions.undoImport(result.ids)) onClose(); }}><Icon name="repeat" size={15} />Desfazer importação</button>
      <div className="spacer" />
      <button className="btn" onClick={() => { setStep("file"); setFile(null); setResult(null); }}>Importar outro arquivo</button>
      {account.type === "cartao"
        ? <button className="btn primary" onClick={() => { const key = file?.parsed?.dueDate ? file.parsed.dueDate.slice(0, 7) : CardMath.billOf(account, result.to); actions.goCards(key, account.id); onClose(); }}>Ver a fatura no cartão</button>
        : <button className="btn primary" onClick={() => { setMonth(result.lastMonth); go("orcamento"); onClose(); }}>Ver em Lançamentos</button>}
    </>;
  }
  const asBill = fixedCard && !(rerouted && account?.type !== "cartao");
  const title = asBill ? `Importar fatura · ${fixedCard.name}` : rerouted ? "Importar extrato da conta" : "Importar extrato ou fatura";
  const subtitle = isDemo ? "Modo demonstração: a importação entra só nos dados fictícios."
    : asBill ? "Traga as compras da fatura exportada pelo app do banco. Cada compra cai na fatura certa pela data." : "Traga os lançamentos do app do banco ou do cartão de crédito.";
  return <Modal xl title={title} subtitle={subtitle} onClose={onClose} footer={footer}>{body}</Modal>;
}
