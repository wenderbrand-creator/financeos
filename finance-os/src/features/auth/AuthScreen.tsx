import { useState } from "react";
import { BrandMark, Icon } from "../../components/icons";
import { ALLOW_SIGNUP } from "../../services/config";
import { signIn, signUp, validUsername } from "../../services/auth";

/** Sign in / create account (username or e-mail + password). Left: product pitch. Right: the form. */
export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const loginErr = validUsername(login);
  const passErr = password.length < 6 ? "Use pelo menos 6 caracteres." : null;
  const confErr = mode === "up" && confirm !== password ? "As senhas não conferem." : null;

  const switchMode = (m: "in" | "up") => { setMode(m); setError(null); setTouched(false); setConfirm(""); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setError(null);
    if (loginErr || passErr || confErr || busy) return;
    setBusy(true);
    const err = mode === "in" ? await signIn(login, password) : await signUp(login, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="auth">
      <section className="auth-pitch" aria-label="Sobre o Finance OS">
        <div className="auth-brand"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
        <div className="auth-pitch-body">
          <h1 className="auth-headline">Seu dinheiro, finalmente em ordem.</h1>
          <p className="auth-lead">Contas, cartões, faturas e parcelas no mesmo painel. Veja quanto pode gastar hoje e quanto vai pagar no mês que vem.</p>

          <div className="auth-glimpse" aria-hidden="true">
            <div className="ag-card">
              <div className="ag-row"><span className="ag-name">Cartão principal</span><span className="cc-chip" /></div>
              <div className="ag-bill"><span>Fatura de novembro</span><b>R$ 1.284,90</b></div>
              <div className="ag-limit"><i style={{ width: "38%" }} /></div>
              <div className="ag-row ag-meta"><span>Disponível R$ 3.715,10</span><span>vence 10</span></div>
            </div>
            <ul className="ag-list">
              <li><span className="ag-dot" style={{ background: "var(--c3)" }} /><span>Mercado</span><b>R$ 312,40</b></li>
              <li><span className="ag-dot" style={{ background: "var(--c4)" }} /><span>Notebook <em>3/10</em></span><b>R$ 300,00</b></li>
              <li><span className="ag-dot" style={{ background: "var(--c6)" }} /><span>Streaming <em>mensal</em></span><b>R$ 39,90</b></li>
            </ul>
            <span className="ag-caption">Prévia com valores de exemplo</span>
          </div>

          <ul className="auth-points">
            <li><Icon name="check" size={16} sw={2.2} /><span><b>Cada compra na fatura certa.</b> Fechamento, vencimento, parcelas e assinaturas de cada cartão, separados.</span></li>
            <li><Icon name="check" size={16} sw={2.2} /><span><b>Extrato do banco em segundos.</b> Importe OFX ou CSV, com categorias sugeridas e sem lançamento repetido.</span></li>
            <li><Icon name="check" size={16} sw={2.2} /><span><b>Só você vê seus números.</b> Acesso com usuário e senha, e cada conta enxerga apenas os próprios dados.</span></li>
          </ul>
        </div>
        <p className="auth-pitch-foot">Funciona no computador e no celular, direto no navegador.</p>
      </section>

      <main className="auth-main">
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-brand auth-brand-sm"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
          <div>
            <h2 className="auth-title">{mode === "in" ? "Entrar na sua conta" : "Crie sua conta"}</h2>
            <p className="auth-sub">{mode === "in" ? "Que bom te ver de novo. Seus números estão onde você deixou." : "Leva menos de um minuto. Depois é só lançar o primeiro gasto."}</p>
          </div>

          <div className="field">
            <label htmlFor="auth-login">Usuário ou e-mail</label>
            <input id="auth-login" className={"input" + (touched && loginErr ? " err" : "")} autoComplete="username" autoCapitalize="none" spellCheck={false}
              value={login} onChange={e => setLogin(e.target.value)} placeholder="seu usuário" autoFocus />
            {touched && loginErr && <span className="err-text">{loginErr}</span>}
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Senha</label>
            <div className="pass-wrap">
              <input id="auth-pass" type={show ? "text" : "password"} className={"input" + (touched && passErr ? " err" : "")} autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "up" ? "mínimo de 6 caracteres" : ""} />
              <button type="button" className="btn ghost icon sm" onClick={() => setShow(s => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}><Icon name={show ? "eyeOff" : "eye"} size={16} /></button>
            </div>
            {touched && passErr && <span className="err-text">{passErr}</span>}
          </div>
          {mode === "up" && <div className="field auth-reveal">
            <label htmlFor="auth-conf">Confirmar senha</label>
            <input id="auth-conf" type={show ? "text" : "password"} className={"input" + (touched && confErr ? " err" : "")} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            {touched && confErr && <span className="err-text">{confErr}</span>}
          </div>}

          {error && <div className="notice neg" role="alert"><Icon name="alert" size={18} /><div>{error}</div></div>}

          <button type="submit" className="btn primary auth-btn" disabled={busy}>
            {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta e começar"}
            {!busy && <Icon name="right" size={16} sw={2} />}
          </button>

          {ALLOW_SIGNUP && <p className="auth-switch">
            {mode === "in" ? <>Ainda não tem conta? <button type="button" className="link-btn" onClick={() => switchMode("up")}>Criar conta</button></>
              : <>Já tem conta? <button type="button" className="link-btn" onClick={() => switchMode("in")}>Entrar</button></>}
          </p>}
          {mode === "up" && <p className="hint auth-note">Guarde sua senha em um lugar seguro. Ela não é enviada por e-mail.</p>}
        </form>
      </main>
    </div>
  );
}
