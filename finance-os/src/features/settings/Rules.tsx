import { useState } from "react";
import { Icon } from "../../components/icons";
import { CATS, CAT_INDEX } from "../../domain/categories";
import { uid } from "../../domain/ids";
import { useApp } from "../../state/AppContext";

/** "When the description contains X, use category Y". Applied to imports and to the new-entry form. */
export function RulesSection() {
  const { realData, actions } = useApp();
  const rules = realData.settings.rules || [];
  const [match, setMatch] = useState("");
  const [cat, setCat] = useState("");
  const [touched, setTouched] = useState(false);
  const clean = match.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const type = CAT_INDEX[cat]?.type;
  const err = clean.length < 2 ? "Digite pelo menos 2 letras." : !type ? "Escolha a categoria." : rules.some(r => r.type === type && r.match === clean) ? "Essa regra já existe." : null;
  const save = (list, msg) => actions.saveSettings({ ...realData.settings, rules: list }, msg);
  const add = async () => {
    setTouched(true); if (err) return;
    if (await save([...rules, { id: uid("r"), type, match: clean, category: cat }], "Regra criada")) { setMatch(""); setCat(""); setTouched(false); }
  };
  const label = (id) => CAT_INDEX[id]?.label || "Categoria removida";
  return (
    <section className="card sec" id="regras">
      <div className="sec-row"><div><h4>Regras de categoria</h4><p>Quando a descrição tiver o texto, o lançamento já vem com a categoria certa, na importação e no novo lançamento. Também dá para criar uma regra ao corrigir a categoria durante a importação.</p></div>
        <div>
          <div className="rule-form">
            <input className={"input" + (touched && clean.length < 2 ? " err" : "")} aria-label="Texto da descrição" placeholder="Ex.: livepix, mycon, uber" value={match} maxLength={40} onChange={e => setMatch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
            <select className={"select" + (touched && !type ? " err" : "")} aria-label="Categoria" value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">Categoria…</option>
              <optgroup label="Despesas">{CATS.expense.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
              <optgroup label="Receitas">{CATS.income.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>
            </select>
            <button type="button" className="btn" onClick={add}><Icon name="plus" size={15} />Criar regra</button>
          </div>
          {touched && err && <span className="err-text">{err}</span>}
          {rules.length ? <div style={{ marginTop: 14 }}>{rules.map(r => <div className="acc-row" key={r.id}>
            <div style={{ minWidth: 0 }}><b>Contém “{r.match}”</b><span>{r.type === "income" ? "Receita" : "Despesa"} · vai para {label(r.category)}</span></div>
            <span />
            <button className="btn ghost icon sm" aria-label={`Excluir regra ${r.match}`} onClick={() => save(rules.filter(x => x.id !== r.id), "Regra excluída")}><Icon name="trash" size={15} /></button>
          </div>)}</div>
            : <p className="hint" style={{ marginTop: 12 }}>Nenhuma regra ainda.</p>}
        </div></div>
    </section>
  );
}
