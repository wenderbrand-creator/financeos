import { useState, useMemo } from "react";
import { Icon } from "../../components/icons";
import { Modal } from "../../components/ui/Modal";
import { Seg } from "../../components/ui/inputs";
import { CAT_COLORS } from "../../domain/categories";
import { uid } from "../../domain/ids";
import { useApp } from "../../state/AppContext";

export function CategoryModal({ type, initial, existing, onSave, onClose }: any) {
  const [label, setLabel] = useState(initial?.label || "");
  const [color, setColor] = useState(initial?.color || CAT_COLORS[existing.length % CAT_COLORS.length]);
  const [touched, setTouched] = useState(false);
  const clean = label.trim();
  const dup = existing.some(c => c.id !== initial?.id && c.label.trim().toLowerCase() === clean.toLowerCase());
  const err = !clean ? "Informe um nome." : clean.length > 30 ? "Use até 30 caracteres." : dup ? "Já existe uma categoria com esse nome." : null;
  const save = async () => { setTouched(true); if (err) return; if (await onSave({ id: initial?.id || uid("cat"), label: clean, color, ...(initial?.archived ? { archived: true } : {}) })) onClose(); };
  return (
    <Modal title={initial ? "Editar categoria" : `Nova categoria de ${type === "income" ? "receita" : "despesa"}`} subtitle="Nome e cor aparecem em gráficos, tabelas e no formulário." onClose={onClose}
      footer={<><div className="spacer" /><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <div className="field"><label htmlFor="cat-name">Nome</label>
        <input id="cat-name" className={"input" + (touched && err ? " err" : "")} value={label} maxLength={40} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") save(); }} placeholder={type === "income" ? "Ex.: Aluguel recebido" : "Ex.: Pets"} />
        {touched && err && <span className="err-text">{err}</span>}</div>
      <div className="field"><label>Cor</label>
        <div className="swatches">{CAT_COLORS.map(c => <button key={c} type="button" className={"sw-btn" + (color === c ? " on" : "")} style={{ "--sw": `var(--${c})` }} aria-label={`Cor ${c.slice(1)}`} aria-pressed={color === c} onClick={() => setColor(c)}>
          <Icon name="check" size={14} sw={2.8} style={{ color: "#fff" }} /></button>)}</div>
        <span className="hint">As cores se ajustam sozinhas aos temas claro e escuro.</span></div>
      <div className="preview-row" aria-hidden="true" style={{ marginTop: 0 }}><span className="pill"><span className="d" style={{ background: `var(--${color})` }} />{clean || "Nova categoria"}</span><span className="hint">Pré-visualização</span></div>
    </Modal>
  );
}

export function CategoriesSection() {
  const { realData, actions } = useApp();
  const [type, setType] = useState("expense");
  const [modal, setModal] = useState(null);
  const cats = realData.settings.categories[type];
  const counts = useMemo(() => { const m = {}; for (const t of realData.txs) m[t.category] = (m[t.category] || 0) + 1; return m; }, [realData.txs]);
  const activeCount = cats.filter(c => !c.archived).length;
  const save = (next, msg) => actions.saveSettings({ ...realData.settings, categories: { ...realData.settings.categories, [type]: next } }, msg);
  const upsert = (cat) => save(cats.some(c => c.id === cat.id) ? cats.map(c => c.id === cat.id ? cat : c) : [...cats, cat], cats.some(c => c.id === cat.id) ? "Categoria atualizada" : "Categoria criada");
  const toggleArchive = (cat) => { const { archived, ...rest } = cat; save(cats.map(c => c.id === cat.id ? (archived ? rest : { ...rest, archived: true }) : c), archived ? "Categoria reativada" : "Categoria arquivada"); };
  const remove = async (cat) => {
    if (await actions.confirm({ title: "Excluir categoria", body: `A categoria “${cat.label}” será removida. Ela não tem lançamentos.`, confirmLabel: "Excluir" }))
      save(cats.filter(c => c.id !== cat.id), "Categoria excluída");
  };
  return (
    <section className="card sec" id="categorias">
      <div className="sec-row"><div><h4>Categorias</h4><p>Arquivar esconde a categoria de novos lançamentos sem afetar o histórico. Só categorias sem lançamentos podem ser excluídas.</p>
        <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setModal({})}><Icon name="plus" size={14} />Nova categoria</button></div>
        <div>
          <div style={{ marginBottom: 12 }}><Seg value={type} onChange={setType} options={[{ value: "expense", label: "Despesas", count: realData.settings.categories.expense.length }, { value: "income", label: "Receitas", count: realData.settings.categories.income.length }]} /></div>
          <div className="cat-admin">{cats.map(c => { const n = counts[c.id] || 0; return (
            <div className={"cat-admin-row" + (c.archived ? " archived" : "")} key={c.id}>
              <span className="d" style={{ background: `var(--${c.color})` }} />
              <div style={{ minWidth: 0 }}><b>{c.label}</b><span>{n} lançamento{n === 1 ? "" : "s"}{c.archived ? " · arquivada" : ""}</span></div>
              <div className="acts">
                <button className="btn ghost icon sm" aria-label={`Editar ${c.label}`} onClick={() => setModal(c)}><Icon name="pencil" size={15} /></button>
                <button className="btn ghost icon sm" aria-label={c.archived ? `Reativar ${c.label}` : `Arquivar ${c.label}`} title={c.archived ? "Reativar" : "Arquivar"} disabled={!c.archived && activeCount < 2} onClick={() => toggleArchive(c)}><Icon name={c.archived ? "eye" : "eyeOff"} size={15} /></button>
                <button className="btn ghost icon sm" aria-label={`Excluir ${c.label}`} title={n ? "Categoria em uso: arquive em vez de excluir" : "Excluir"} disabled={n > 0 || (!c.archived && activeCount < 2)} onClick={() => remove(c)}><Icon name="trash" size={15} /></button>
              </div>
            </div>); })}</div>
        </div></div>
      {modal && <CategoryModal type={type} initial={modal.id ? modal : null} existing={cats} onSave={upsert} onClose={() => setModal(null)} />}
    </section>
  );
}
