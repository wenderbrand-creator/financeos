import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_MODE } from "./config";

/**
 * Browser client. Uses only the public (anon/publishable) key; every table is protected by
 * Row Level Security, so the key alone grants nothing. PKCE flow: links in e-mails
 * (confirmation, password reset) carry a one-time code bound to this browser.
 */
export const supabase: SupabaseClient | null = STORAGE_MODE === "supabase"
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    })
  : null;
