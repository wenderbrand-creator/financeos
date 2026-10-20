import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { App } from "./App";
import { AuthScreen, ResetPasswordScreen } from "./features/auth/AuthScreen";
import { supabase } from "./services/supabaseClient";
import { displayLogin, signOut } from "./services/auth";
import { IDLE_MINUTES } from "./services/config";
import { BrandMark, Icon } from "./components/icons";

/**
 * Supabase configured → login required, data in the cloud.
 * Supabase NOT configured → shows a neutral screen (the app never opens without login by accident).
 * Local mode (no login, data in this browser) only when VITE_STORAGE_MODE=local is set on purpose.
 */
export function Root() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [recovering, setRecovering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      setSession(s ?? null);
    });
    // remove one-time auth codes from the address bar once the e-mail link was processed
    if (/[?&](code|error_description)=|access_token=/.test(window.location.search + window.location.hash)) {
      setTimeout(() => window.history.replaceState(null, "", window.location.pathname), 1500);
    }
    return () => data.subscription.unsubscribe();
  }, []);
  useIdleSignOut(!!session && !recovering, () => setNotice("Sua sessão foi encerrada após um período sem uso. Entre novamente para continuar."));

  if (!supabase) {
    if ((import.meta.env.VITE_STORAGE_MODE as string) === "local") return <App />;
    return <SetupNeeded />;
  }
  if (session === undefined) return <div className="boot">Carregando Finance OS…</div>;
  if (session && recovering) return <ResetPasswordScreen onDone={() => setRecovering(false)} />;
  if (!session) return <AuthScreen notice={notice} />;
  return <App key={session.user.id} userId={session.user.id} userLogin={displayLogin(session.user.email)} />;
}

/** Signs out after IDLE_MINUTES without interaction (0 disables). Activity is shared across tabs. */
function useIdleSignOut(active: boolean, onExpire: () => void) {
  const timer = useRef<any>(0);
  useEffect(() => {
    if (!active || !IDLE_MINUTES) return;
    const KEY = "finance-os:last-activity", limit = IDLE_MINUTES * 60_000;
    const touch = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { } };
    const check = async () => {
      let last = Date.now();
      try { last = Number(localStorage.getItem(KEY)) || Date.now(); } catch { }
      if (Date.now() - last >= limit) { clearInterval(timer.current); await signOut("local"); onExpire(); }
    };
    let lastTouch = 0;
    const onAct = () => { const n = Date.now(); if (n - lastTouch > 15_000) { lastTouch = n; touch(); } };
    touch();
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"];
    evs.forEach(e => window.addEventListener(e, onAct, { passive: true }));
    timer.current = setInterval(check, 30_000);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(timer.current); evs.forEach(e => window.removeEventListener(e, onAct)); document.removeEventListener("visibilitychange", onVis); };
  }, [active]);
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
