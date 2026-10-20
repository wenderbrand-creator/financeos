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

/**
 * Shown when the server configuration (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) did not reach the build.
 * End users see a neutral message; the technical detail goes to the browser console for the admin.
 */
function SetupNeeded() {
  useEffect(() => {
    const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"].filter(k => !(import.meta.env as any)[k]?.trim());
    console.error("[Finance OS] Configuração ausente no build:", missing.join(", "), "— cadastre na Vercel e faça Redeploy.");
  }, []);
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand"><BrandMark /><div className="brand-name">Finance <span>OS</span></div></div>
        <div>
          <h1 className="auth-title">Voltamos em instantes</h1>
          <p className="auth-sub">Não foi possível conectar ao servidor agora. Seus dados estão seguros. Tente novamente em alguns minutos.</p>
        </div>
        <button type="button" className="btn primary auth-btn" onClick={() => window.location.reload()}><Icon name="repeat" size={16} />Tentar novamente</button>
      </div>
    </div>
  );
}
