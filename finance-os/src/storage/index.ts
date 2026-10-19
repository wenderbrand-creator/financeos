import { supabase } from "../services/supabaseClient";
import { createSupabaseStore } from "./supabase";
import { createLocalStore, createMemoryStore, localAvailable } from "./local";
import { defaultSettings } from "../domain/model";

/** Picks the data store: Supabase when signed in, otherwise this browser (or memory as a last resort). */
export async function pickStore(userId?: string | null): Promise<any> {
  if (supabase && userId) return createSupabaseStore(supabase, userId);
  if (localAvailable()) return createLocalStore();
  return createMemoryStore({ settings: defaultSettings(), txs: [] }, "memory");
}
