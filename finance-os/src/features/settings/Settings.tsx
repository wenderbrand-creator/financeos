import { reauthenticate } from "../../services/auth";
import { useState, useEffect, useRef, useMemo } from "react";
import { Icon } from "../../components/icons";
import { Amount } from "../../components/ui/Amount";
import { Modal } from "../../components/ui/Modal";
import { MoneyInput } from "../../components/ui/inputs";
import { validateBackup, buildBackup } from "../../domain/backup";
import { isCard } from "../../domain/cards";
import { ACCOUNT_TYPES } from "../../domain/constants";
import { D } from "../../domain/dates";
import { Finance } from "../../domain/finance";
import { uid } from "../../domain/ids";
import { AppearanceSection } from "./Appearance";
import { CategoriesSection } from "./Categories";
import { useApp } from "../../state/AppContext";
import { downloadText } from "../../services/download";
import { LS_KEY } from "../../storage/local";
import { normalizeSettings, normalizeTx, txBody, defaultSettings } from "../../domain/model";
import { SCHEMA_VERSION, APP_ID } from "../../domain/constants";

/** Data saved by the local (no-login) mode in this browser, offered for migration to the cloud. */
function readLocalBrowserData() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!raw || !Array.isArray(raw.txs) || !raw.txs.length) return null;
    const txs = raw.txs.map((t: any) => normalizeTx(t.id, t)).filter(Boolean);
    const backup = { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: null, settings: normalizeSettings(raw.settings), transactions: txs.map((t: any) => ({ id: t.id, ...txBody(t) })) };
    return validateBackup(backup);
  } catch { return null; }
}

export function AccountModal({ initial, onClose }: any) {
  const { data, actions } = useApp();
  const [f, setF] = useState({ name: initial?.name || "", type: initial?.type || "corrente", openingCents: initial?.openingCents || 0 });
  const [touched, setTouched] = useState(false);
  const err = !f.name.trim() ? "Informe um nome." : f.name.trim().length > 40 ? "Use até 40 caracteres." : null;
  const save = async () => {
    setTouched(true); if (err) return;
    const acc = { id: initial?.id || uid("acc"), name: f.name.trim(), type: f.type, openingCents: f.openingCents };
    const accounts = initial ? data.settings.accounts.map(a => a.id === acc.id ? acc : a) : [...data.settings.accounts, acc];
    if (await actions.saveSettings({ ...data.settings, accounts }, initial ? "Conta atualizada" : "Conta adicionada")) onClose();
  };
  return (
    <Modal title={initial ? "Editar conta" : "Nova conta"} subtitle="Contas organizam onde cada lançamento acontece." onClose={onClose}
      footer={<><div className="spacer" /><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <div className="field"><label htmlFor="acc-name">Nome</label>
        <input id="acc-name" className={"input" + (touched && err ? " err" : "")} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Conta corrente" />
        {touched && err && <span className="err-text">{err}</span>}</div>
      <div className="grid2">
        <div className="field"><label htmlFor="acc-type">Tipo</label>
          <select id="acc-type" className="select" value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>{Object.entries(ACCOUNT_TYPES).filter(([k]) => k !== "cartao").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="field"><label htmlFor="acc-open">Saldo inicial</label>
          <MoneyInput id="acc-open" value={f.openingCents} onChange={v => setF({ ...f, openingCents: v })} />
          <span className="hint">Saldo antes do primeiro lançamento.</span></div>
      </div>
    </Modal>
  );
}

export function ImportDialog({ parsed, onClose, title = "Restaurar backup" }: any) {
  const { data, actions, storeKind } = useApp();
  const [ack, setAck] = useState(false);
  const [progress, setProgress] = useState(null);
  const [check, setCheck] = useState(null);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const needPw = storeKind === "cloud";
  const run = async () => {
    if (needPw) {
      setPwErr(null);
      const err = await reauthenticate(pw);
      if (err) { setPwErr(err); setPw(""); return; }
    }
    setProgress(0);
    const ok = await actions.replaceAll(parsed.data, setProgress, null);
    if (!ok) { setProgress(null); return; }
    setCheck("…");
    try { setCheck(await actions.verifyData(parsed.data.txs)); } catch { setCheck({ ok: false, detail: "Não foi possível reler os dados para conferência." }); }
  };
  const m = parsed.meta;
  if (check) return (
    <Modal title={check === "…" ? "Conferindo os dados…" : check.ok ? "Dados conferidos" : "Conferência com diferenças"} subtitle={storeKind === "cloud" ? "Os dados foram relidos do servidor e comparados com o arquivo." : "Os dados salvos foram comparados com o arquivo."} onClose={onClose}
      footer={<><div className="spacer" /><button className="btn primary" onClick={onClose} disabled={check === "…"}>Concluir</button></>}>
      {check === "…" ? <div className="progress"><i style={{ width: "100%" }} /></div>
        : check.ok ? <div className="notice pos"><Icon name="checkCircle" size={18} /><div><b style={{ display: "block" }}>{check.count} lançamentos idênticos ao arquivo</b>Os totais por mês, por conta e por tipo batem em todos os {check.groups} grupos.</div></div>
        : <div className="notice neg"><Icon name="alert" size={18} /><div><b style={{ display: "block" }}>Encontrei diferenças</b>{check.detail || `Esperados ${check.expected}, encontrados ${check.count}. Grupos divergentes: ${check.diff.join(", ") || "—"}.`} Seu arquivo de backup continua intacto; você pode repetir a restauração.</div></div>}
    </Modal>
  );
  return (
    <Modal title={title} subtitle="O arquivo foi validado. Confira antes de substituir." onClose={() => progress === null && onClose()}
      footer={<><div className="spacer" /><button className="btn ghost" onClick={onClose} disabled={progress !== null}>Cancelar</button>
        <button className="btn danger" disabled={!ack || progress !== null || (needPw && !pw)} onClick={run}>{progress !== null ? `Restaurando… ${Math.round(progress * 100)}%` : "Substituir dados"}</button></>}>
      <dl className="kv">
        <dt>Lançamentos</dt><dd className="num">{m.count}</dd>
        <dt>Contas</dt><dd className="num">{m.accounts}</dd>
        <dt>Período</dt><dd>{m.count ? `${D.br(m.from)} a ${D.br(m.to)}` : "—"}</dd>
        <dt>Exportado em</dt><dd>{m.exportedAt ? new Date(m.exportedAt).toLocaleString("pt-BR") : "—"}</dd>
      </dl>
      <div className="notice warn"><Icon name="alert" size={18} /><div>Seus dados atuais ({data.txs.length} lançamentos e {data.settings.accounts.length} contas) serão substituídos pelo conteúdo do arquivo. Exporte um backup antes se quiser guardá-los.</div></div>
      {progress !== null && <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>}
      <label className="check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />Entendo que os dados atuais serão substituídos.</label>
      {needPw && <div className="field"><label htmlFor="restore-pw">Sua senha</label>
        <input id="restore-pw" type="password" className={"input" + (pwErr ? " err" : "")} value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
        {pwErr ? <span className="err-text">{pwErr}</span> : <span className="hint">Por segurança, confirme sua senha para substituir os dados.</span>}</div>}
    </Modal>
  );
}

export function ExportFallback({ json, onClose }: any) {
  const ta = useRef(null); const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(json); setCopied(true); } catch { ta.current.select(); } };
  return (
    <Modal wide title="Backup em JSON" subtitle="O download direto não está disponível nesta visualização. Copie o conteúdo e salve como arquivo .json." onClose={onClose}
      footer={<><div className="spacer" /><button className="btn ghost" onClick={onClose}>Fechar</button><button className="btn primary" onClick={copy}><Icon name="copy" size={16} />{copied ? "Copiado" : "Copiar"}</button></>}>
      <textarea ref={ta} className="input" readOnly value={json} onFocus={e => e.target.select()} aria-label="Conteúdo do backup" />
    </Modal>
  );
}

export function Settings() {
  const { realData, actions, storeKind, isDemo, saveState, userLogin, go } = useApp();
  const localData = useMemo(() => storeKind === "cloud" ? readLocalBrowserData() : null, [storeKind]);
  const [migrate, setMigrate] = useState(null);
  const [name, setName] = useState(realData.settings.profileName);
  const [accModal, setAccModal] = useState(null);
  const [importState, setImportState] = useState(null);
  const [exportJson, setExportJson] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => setName(realData.settings.profileName), [realData.settings.profileName]);
  const today = D.todayISO();
  const txCountByAcc = id => realData.txs.filter(t => t.accountId === id).length;

  const doExport = async () => {
    const json = buildBackup(realData.settings, realData.txs);
    if (downloadText(`finance-os-backup-${today}.json`, json)) actions.toast("Backup exportado"); else setExportJson(json);
  };
  const onFile = (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setImportState({ error: "Arquivo grande demais para um backup do Finance OS." }); return; }
    const r = new FileReader();
    r.onload = () => { try { setImportState(validateBackup(JSON.parse(String(r.result)))); } catch { setImportState({ error: "O arquivo não é um JSON válido." }); } };
    r.onerror = () => setImportState({ error: "Não foi possível ler o arquivo." });
    r.readAsText(file);
  };
  const delAcc = async (a) => {
    if (txCountByAcc(a.id)) return;
    if (await actions.confirm({ title: "Excluir conta", body: `A conta “${a.name}” será removida.`, confirmLabel: "Excluir" }))
      actions.saveSettings({ ...realData.settings, accounts: realData.settings.accounts.filter(x => x.id !== a.id) }, "Conta excluída");
  };
  const wipe = async () => {
    if (await actions.confirm({ title: "Apagar todos os dados", body: `Todos os ${realData.txs.length} lançamentos e as contas serão apagados. Esta ação não pode ser desfeita.`, confirmLabel: "Apagar tudo", requireText: "APAGAR", requirePassword: storeKind === "cloud" }))
      actions.replaceAll({ settings: { ...defaultSettings(), profileName: realData.settings.profileName }, txs: [] }, null, "Dados apagados");
  };
  const storeInfo = {
    cloud: { icon: "cloud", tone: "pos", title: "Nuvem privada", body: "Seus dados ficam salvos na nuvem, protegidos pelo seu login. Cada registro pertence só à sua conta: ninguém mais consegue ler ou alterar. Cada lançamento é gravado assim que você confirma." },
    local: { icon: "drive", tone: "warn", title: "Somente neste navegador", body: "Os dados ficam no armazenamento deste navegador. Eles não sincronizam com outros dispositivos e são perdidos se os dados do site forem limpos. Exporte backups com frequência." },
    memory: { icon: "alert", tone: "neg", title: "Sem persistência", body: "O navegador bloqueou o armazenamento local (janela anônima ou dados do site bloqueados). Os dados existem apenas enquanto esta aba estiver aberta. Exporte um backup antes de fechar." },
  }[storeKind] || { icon: "clock", tone: "", title: "Conectando…", body: "" };

  return (
    <div className="settings fadein">
      <nav className="settings-nav" aria-label="Seções">
        {storeKind === "cloud" && <a href="#conta">Conta</a>}<a href="#aparencia">Aparência</a><a href="#perfil">Perfil</a><a href="#contas">Contas financeiras</a><a href="#categorias">Categorias</a><a href="#dados">Dados e backup</a><a href="#demo">Demonstração</a>
      </nav>
      <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
        {isDemo && <div className="notice warn"><Icon name="flask" size={18} /><div>Você está no modo demonstração. As configurações abaixo se referem aos seus dados reais, que não aparecem nas outras telas enquanto a demonstração estiver ativa.</div></div>}
        <AppearanceSection />
        <section className="card sec" id="perfil">
          <div className="sec-row"><div><h4>Nome na saudação</h4><p>Aparece no topo do Início.</p></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input id="profile-name" className="input" style={{ maxWidth: 320 }} value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="Como quer ser chamado" />
              <button className="btn" disabled={name.trim() === realData.settings.profileName} onClick={() => actions.saveSettings({ ...realData.settings, profileName: name.trim() }, "Nome atualizado")}>Salvar</button>
            </div></div>
        </section>

        <section className="card sec" id="contas">
          <div className="sec-row"><div><h4>Contas financeiras</h4><p>Saldo realizado em {D.br(today)}. Contas com lançamentos não podem ser excluídas.</p>
            <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setAccModal({})}><Icon name="plus" size={14} />Nova conta</button></div>
            <div>{realData.settings.accounts.filter(a => !isCard(a)).map(a => {
              const n = txCountByAcc(a.id);
              return <div className="acc-row" key={a.id}>
                <div style={{ minWidth: 0 }}><b>{a.name}</b><span>{ACCOUNT_TYPES[a.type]} · {n} lançamento{n === 1 ? "" : "s"}</span></div>
                <div style={{ textAlign: "right" }}><Amount cents={Finance.accountBalance(realData.txs, a, today)} className="" />{a.type === "cartao" && <span style={{ display: "block" }}>{Finance.accountBalance(realData.txs, a, today) < 0 ? "fatura em aberto" : "sem saldo devedor"}</span>}</div>
                <div style={{ display: "flex", gap: 2 }}>
                  <button className="btn ghost icon sm" aria-label={`Editar ${a.name}`} onClick={() => setAccModal(a)}><Icon name="pencil" size={15} /></button>
                  <button className="btn ghost icon sm" aria-label={`Excluir ${a.name}`} disabled={n > 0 || realData.settings.accounts.filter(a => !isCard(a)).length < 2} title={n ? "Conta com lançamentos" : ""} onClick={() => delAcc(a)}><Icon name="trash" size={15} /></button>
                </div>
              </div>;
            })}
            {realData.settings.accounts.some(isCard) && <div className="acc-row"><div><b>Cartões de crédito</b><span>{realData.settings.accounts.filter(isCard).length} cartão(ões) · gerenciados na aba própria</span></div><span /><button className="btn sm" onClick={() => go("cartoes")}>Abrir</button></div>}
            </div></div>
        </section>

        <CategoriesSection />
        {storeKind === "cloud" && <section className="card sec" id="conta">
          <div className="sec-row"><div><h4>Sua conta</h4><p>Acesso com e-mail ou usuário e senha.</p></div>
            <div className="pref-line"><span style={{ fontSize: 13.5 }}>Conectado como <b>{userLogin || "—"}</b></span>
              <button className="btn" onClick={actions.signOut}>Sair da conta</button></div></div>
          {localData && localData.data && <div className="sec-row"><div><h4>Dados deste navegador</h4><p>Lançamentos salvos aqui antes do login, no modo local.</p></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 13.5 }}>{localData.meta.count} lançamentos e {localData.meta.accounts} contas encontrados neste navegador. Eles não foram apagados.</span>
              <button className="btn" onClick={() => setMigrate(localData)}><Icon name="upload" size={16} />Revisar e enviar para a nuvem</button></div></div>}
        </section>}
        <section className="card sec" id="dados">
          <div className="sec-row"><div><h4>Onde os dados ficam</h4><p>Verificado ao abrir o app.</p></div>
            <div className={"notice " + storeInfo.tone}><Icon name={storeInfo.icon} size={18} /><div><b style={{ display: "block", marginBottom: 2 }}>{storeInfo.title}</b>{storeInfo.body}
              {saveState.error && <div style={{ marginTop: 6, color: "var(--neg)" }}>Última falha: {saveState.error}</div>}</div></div></div>
          <div className="sec-row"><div><h4>Backup</h4><p>Arquivo JSON com contas e lançamentos ({realData.txs.length}). Dados da demonstração nunca entram no backup.</p></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={doExport}><Icon name="download" size={16} />Exportar backup</button>
                <button className="btn" onClick={() => fileRef.current.click()}><Icon name="upload" size={16} />Restaurar backup</button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
              </div>
              {importState && importState.error && <div className="notice neg"><Icon name="alert" size={18} /><div><b style={{ display: "block" }}>Backup não aceito</b>{importState.error} Nenhum dado foi alterado.</div></div>}
            </div></div>
          <div className="sec-row"><div><h4>Apagar todos os dados</h4><p>Remove lançamentos e contas. Pede confirmação por escrito.</p></div>
            <div><button className="btn danger-ghost" style={{ border: "1px solid var(--neg-soft)" }} disabled={!realData.txs.length && realData.settings.accounts.length <= 1} onClick={wipe}><Icon name="trash" size={16} />Apagar dados</button></div></div>
        </section>

        <section className="card sec" id="demo">
          <div className="sec-row"><div><h4>Modo demonstração</h4><p>Dados fictícios em memória, separados dos seus. Nada é salvo enquanto estiver ativo.</p></div>
            <div>{isDemo ? <button className="btn" onClick={actions.exitDemo}>Sair da demonstração</button> : <button className="btn" onClick={actions.enterDemo}><Icon name="flask" size={16} />Abrir demonstração</button>}</div></div>
        </section>
      </div>
      {accModal && <AccountModal initial={accModal.id ? accModal : null} onClose={() => setAccModal(null)} />}
      {importState && importState.data && <ImportDialog parsed={importState} onClose={() => setImportState(null)} />}
      {migrate && <ImportDialog parsed={migrate} title="Enviar dados deste navegador para a nuvem" onClose={() => setMigrate(null)} />}
      {exportJson && <ExportFallback json={exportJson} onClose={() => setExportJson(null)} />}
    </div>
  );
}
