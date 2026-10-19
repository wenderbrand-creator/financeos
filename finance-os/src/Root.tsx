import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { App } from "./App";
import { AuthScreen } from "./features/auth/AuthScreen";
import { supabase } from "./services/supabaseClient";
import { displayLogin } from "./services/auth";

/**
 * Supabase configured → login required, data in the cloud.
 * Not configured → local mode: no login, data in this browser (same as the original artifact fallback).
 */
export function Root() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }: any) => setSession(data.session ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!supabase) return <App />;
  if (session === undefined) return <div className="boot">Carregando Finance OS…</div>;
  if (!session) return <AuthScreen />;
  return <App key={session.user.id} userId={session.user.id} userLogin={displayLogin(session.user.email)} />;
}
