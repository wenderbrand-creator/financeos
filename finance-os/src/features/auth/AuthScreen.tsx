import { useState } from "react";
import { BrandMark, Icon } from "../../components/icons";
import { Seg } from "../../components/ui/inputs";
import { ALLOW_SIGNUP } from "../../services/config";
import { signIn, signUp, validUsername } from "../../services/auth";

/** Login / account creation with username (or e-mail) and password. No social providers. */
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setError(null);
    if (loginErr || passErr || confErr || busy) return;
    setBusy(true);
    const err = mode === "in" ? await signIn(login, password) : await signUp(login, password);
    setBusy(false);
    if (err) setError(err);
  };
  return (
    <div className="auth-wrap">
      <form className="auth-card stagger" onSubmit={submit} noValidate>
        <div className="auth-brand"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
        <div>
          <h1 className="auth-title">{mode === "in" ? "Entrar" : "Criar sua conta"}</h1>
          <p className="auth-sub">{mode === "in" ? "Acesse suas finanças com seu usuário e senha." : "Escolha um usuário e uma senha. Seus dados ficam visíveis só para você."}</p>
        </div>
        {ALLOW_SIGNUP && <Seg value={mode} onChange={(v: any) => { setMode(v); setError(null); setTouched(false); }} options={[{ value: "in", label: "Entrar" }, { value: "up", label: "Criar conta" }]} />}
        <div className="field">
          <label htmlFor="auth-login">Usuário ou e-mail</label>
          <input id="auth-login" className={"input" + (touched && loginErr ? " err" : "")} autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={login} onChange={e => setLogin(e.target.value)} placeholder="ex.: wender" autoFocus />
          {touched && loginErr && <span className="err-text">{loginErr}</span>}
        </div>
        <div className="field">
          <label htmlFor="auth-pass">Senha</label>
          <div className="pass-wrap">
            <input id="auth-pass" type={show ? "text" : "password"} className={"input" + (touched && passErr ? " err" : "")} autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="btn ghost icon sm" onClick={() => setShow(s => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}><Icon name={show ? "eyeOff" : "eye"} size={16} /></button>
          </div>
          {touched && passErr && <span className="err-text">{passErr}</span>}
        </div>
        {mode === "up" && <div className="field">
          <label htmlFor="auth-conf">Confirmar senha</label>
          <input id="auth-conf" type={show ? "text" : "password"} className={"input" + (touched && confErr ? " err" : "")} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          {touched && confErr && <span className="err-text">{confErr}</span>}
        </div>}
        {error && <div className="notice neg"><Icon name="alert" size={18} /><div>{error}</div></div>}
        <button type="submit" className="btn primary auth-btn" disabled={busy}>{busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta e entrar"}</button>
        <p className="hint" style={{ textAlign: "center" }}>Sem login social. Guarde sua senha: ela não é enviada por e-mail.</p>
      </form>
    </div>
  );
}
