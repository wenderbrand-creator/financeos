import { useState } from "react";
import { BrandMark, Icon } from "../../components/icons";
import { ALLOW_SIGNUP } from "../../services/config";
import { signIn, signUp, validLogin, validEmail, passwordProblem, requestPasswordReset } from "../../services/auth";

type Mode = "in" | "up" | "forgot" | "sent-confirm" | "sent-reset";

/**
 * Sign in / create account / forgot password. Left: product pitch. Right: the form.
 * Messages never tell whether an e-mail is registered (no account enumeration).
 */
export function AuthScreen({ notice }: { notice?: string | null }) {
  const [mode, setMode] = useState<Mode>("in");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [info, setInfo] = useState<string | null>(notice || null);

  const loginErr = mode === "in" ? validLogin(login) : validEmail(login);
  const passErr = mode === "in" ? (password ? null : "Informe sua senha.") : mode === "up" ? passwordProblem(password, login) : null;
  const confErr = mode === "up" && confirm !== password ? "As senhas não conferem." : null;

  const switchMode = (m: Mode) => { setMode(m); setError(null); setTouched(false); setConfirm(""); setInfo(null); if (m !== "in") setPassword(""); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setError(null);
    if (busy) return;
    if (mode === "forgot") {
      if (loginErr) return;
      setBusy(true); const err = await requestPasswordReset(login); setBusy(false);
      if (err) setError(err); else setMode("sent-reset");
      return;
    }
    if (loginErr || passErr || confErr) return;
    setBusy(true);
    if (mode === "in") {
      const err = await signIn(login, password);
      setBusy(false); if (err) { setError(err); setPassword(""); }
    } else {
      const r = await signUp(login, password);
      setBusy(false);
      if (r.error) setError(r.error); else if (r.ok === "confirm") setMode("sent-confirm");
    }
  };

  const sent = mode === "sent-confirm" || mode === "sent-reset";
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
            <li><Icon name="check" size={16} sw={2.2} /><span><b>Extrato do banco em segundos.</b> Importe o PDF, OFX ou CSV do banco, com categorias sugeridas e sem lançamento repetido.</span></li>
            <li><Icon name="check" size={16} sw={2.2} /><span><b>Só você vê seus números.</b> Acesso com e-mail e senha, e cada conta enxerga apenas os próprios dados.</span></li>
          </ul>
        </div>
        <p className="auth-pitch-foot">Funciona no computador e no celular, direto no navegador.</p>
      </section>

      <main className="auth-main">
        {sent ? <div className="auth-form" role="status">
          <div className="auth-brand auth-brand-sm"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
          <div className="auth-sent-ico"><Icon name="checkCircle" size={26} sw={1.8} /></div>
          <div>
            <h2 className="auth-title">Confira seu e-mail</h2>
            <p className="auth-sub">{mode === "sent-confirm"
              ? <>Se <b>{login.trim()}</b> puder ser usado, enviamos um link para confirmar a conta. Abra o link neste mesmo navegador para entrar.</>
              : <>Se existir uma conta com <b>{login.trim()}</b>, enviamos um link para criar uma nova senha. Abra o link neste mesmo navegador.</>}</p>
          </div>
          <p className="hint">Não chegou em alguns minutos? Veja a caixa de spam ou tente de novo.</p>
          <button type="button" className="btn primary auth-btn" onClick={() => switchMode("in")}>Voltar para o login</button>
        </div> :
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-brand auth-brand-sm"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
          <div>
            <h2 className="auth-title">{mode === "in" ? "Entrar na sua conta" : mode === "up" ? "Crie sua conta" : "Recuperar acesso"}</h2>
            <p className="auth-sub">{mode === "in" ? "Que bom te ver de novo. Seus números estão onde você deixou." : mode === "up" ? "Leva menos de um minuto. Depois é só lançar o primeiro gasto." : "Informe seu e-mail e enviaremos um link para criar uma nova senha."}</p>
          </div>
          {info && <div className="notice" role="status"><Icon name="info" size={18} /><div>{info}</div></div>}

          <div className="field">
            <label htmlFor="auth-login">E-mail</label>
            <input id="auth-login" type={mode === "in" ? "text" : "email"} inputMode="email" className={"input" + (touched && loginErr ? " err" : "")}
              autoComplete={mode === "up" ? "email" : "username"} autoCapitalize="none" spellCheck={false} maxLength={254}
              value={login} onChange={e => setLogin(e.target.value)} placeholder="voce@email.com" autoFocus />
            {touched && loginErr && <span className="err-text">{loginErr}</span>}
          </div>
          {mode !== "forgot" && <div className="field">
            <div className="auth-label-row"><label htmlFor="auth-pass">Senha</label>
              {mode === "in" && <button type="button" className="link-btn" onClick={() => switchMode("forgot")}>Esqueci minha senha</button>}</div>
            <div className="pass-wrap">
              <input id="auth-pass" type={show ? "text" : "password"} className={"input" + (touched && passErr ? " err" : "")} autoComplete={mode === "in" ? "current-password" : "new-password"}
                maxLength={72} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "up" ? "mínimo de 8, com letras e números" : ""} />
              <button type="button" className="btn ghost icon sm" onClick={() => setShow(s => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}><Icon name={show ? "eyeOff" : "eye"} size={16} /></button>
            </div>
            {touched && passErr && <span className="err-text">{passErr}</span>}
          </div>}
          {mode === "up" && <div className="field auth-reveal">
            <label htmlFor="auth-conf">Confirmar senha</label>
            <input id="auth-conf" type={show ? "text" : "password"} className={"input" + (touched && confErr ? " err" : "")} autoComplete="new-password" maxLength={72} value={confirm} onChange={e => setConfirm(e.target.value)} />
            {touched && confErr && <span className="err-text">{confErr}</span>}
          </div>}

          {error && <div className="notice neg" role="alert"><Icon name="alert" size={18} /><div>{error}</div></div>}

          <button type="submit" className="btn primary auth-btn" disabled={busy}>
            {busy ? "Aguarde…" : mode === "in" ? "Entrar" : mode === "up" ? "Criar conta e começar" : "Enviar link"}
            {!busy && <Icon name="right" size={16} sw={2} />}
          </button>

          {mode === "forgot" ? <p className="auth-switch"><button type="button" className="link-btn" onClick={() => switchMode("in")}>Voltar para o login</button></p>
            : ALLOW_SIGNUP && <p className="auth-switch">
            {mode === "in" ? <>Ainda não tem conta? <button type="button" className="link-btn" onClick={() => switchMode("up")}>Criar conta</button></>
              : <>Já tem conta? <button type="button" className="link-btn" onClick={() => switchMode("in")}>Entrar</button></>}
          </p>}
        </form>}
      </main>
    </div>
  );
}

/** Shown after opening a password-reset link: choose the new password. */
export function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passErr = passwordProblem(password);
  const confErr = confirm !== password ? "As senhas não conferem." : null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setError(null);
    if (passErr || confErr || busy) return;
    setBusy(true);
    const { updatePassword } = await import("../../services/auth");
    const err = await updatePassword(password);
    setBusy(false);
    if (err) setError(err); else onDone();
  };
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-brand"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
        <div><h1 className="auth-title">Crie uma nova senha</h1><p className="auth-sub">Use pelo menos 8 caracteres, misturando letras e números.</p></div>
        <div className="field"><label htmlFor="rp-pass">Nova senha</label>
          <div className="pass-wrap">
            <input id="rp-pass" type={show ? "text" : "password"} className={"input" + (touched && passErr ? " err" : "")} autoComplete="new-password" maxLength={72} value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            <button type="button" className="btn ghost icon sm" onClick={() => setShow(s => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}><Icon name={show ? "eyeOff" : "eye"} size={16} /></button>
          </div>
          {touched && passErr && <span className="err-text">{passErr}</span>}</div>
        <div className="field"><label htmlFor="rp-conf">Confirmar nova senha</label>
          <input id="rp-conf" type={show ? "text" : "password"} className={"input" + (touched && confErr ? " err" : "")} autoComplete="new-password" maxLength={72} value={confirm} onChange={e => setConfirm(e.target.value)} />
          {touched && confErr && <span className="err-text">{confErr}</span>}</div>
        {error && <div className="notice neg" role="alert"><Icon name="alert" size={18} /><div>{error}</div></div>}
        <button type="submit" className="btn primary auth-btn" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
      </form>
    </div>
  );
}
