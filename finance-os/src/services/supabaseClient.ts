import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_MODE } from "./config";

/** Browser client. Uses only the public anon key; Row Level Security protects each user's rows. */
export const supabase: SupabaseClient | null = STORAGE_MODE === "supabase"
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;
