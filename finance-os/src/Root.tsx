import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { App } from "./App";
import { AuthScreen } from "./features/auth/AuthScreen";
import { supabase } from "./services/supabaseClient";
import { displayLogin } from "./services/auth";
import { BrandMark, Icon } from "./components/icons";

/**
 * Supabase configured → login required, data in the cloud.
 * Supabase NOT configured → shows a setup screen (the app never opens without login by accident).
 * Local mode (no login, data in this browser) only when VITE_STORAGE_MODE=local is set on purpose.
 */
export function Root() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supabase) {
    if ((import.meta.env.VITE_STORAGE_MODE as string) === "local") return <App />;
    return <SetupNeeded />;
  }
  if (session === undefined) return <div className="boot">Carregando Finance OS…</div>;
  if (!session) return <AuthScreen />;
  return <App key={session.user.id} userId={session.user.id} userLogin={displayLogin(session.user.email)} />;
}

/** Shown when the Supabase environment variables did not reach the build. */
function SetupNeeded() {
  const hasUrl = !!(import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const hasKey = !!(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  const Row = ({ ok, name }: { ok: boolean; name: string }) => (
    <div className="pref-line" style={{ fontSize: 13.5 }}>
      <code className="mono">{name}</code>
      <span className={"pill " + (ok ? "pos" : "neg")}><Icon name={ok ? "check" : "alert"} size={12} sw={2} />{ok ? "encontrada" : "ausente"}</span>
    </div>
  );
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
        <div>
          <h1 className="auth-title">Falta conectar o Supabase</h1>
          <p className="auth-sub">O login fica disponível assim que as variáveis do Supabase chegam ao build. Seus dados não foram tocados.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row ok={hasUrl} name="VITE_SUPABASE_URL" />
          <Row ok={hasKey} name="VITE_SUPABASE_ANON_KEY" />
        </div>
        <div className="notice"><Icon name="info" size={18} /><div>
          Na Vercel: <b>Settings → Environment Variables</b>, cadastre as duas variáveis (marque Production e Preview) e depois faça <b>Deployments → Redeploy</b>. Variáveis criadas depois do deploy só valem após um novo deploy.
        </div></div>
      </div>
    </div>
  );
}
