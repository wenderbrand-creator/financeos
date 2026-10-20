/** Runtime configuration from Vite env vars (public values only — never put secrets here). */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";
/** "supabase" uses the cloud + login; "local" keeps data in this browser only (no login). */
export const STORAGE_MODE: "supabase" | "local" =
  (import.meta.env.VITE_STORAGE_MODE as string) === "local" || !SUPABASE_URL || !SUPABASE_ANON_KEY ? "local" : "supabase";
/** Whether the "Criar conta" tab is shown. Turn off after creating your user. */
export const ALLOW_SIGNUP = (import.meta.env.VITE_ALLOW_SIGNUP as string | undefined) !== "false";
/** Usernames without "@" become <username>@<domain> internally for Supabase Auth. */
export const USERNAME_DOMAIN = (import.meta.env.VITE_USERNAME_DOMAIN as string | undefined)?.trim() || "users.financeos.app";
/** Minutes without interaction before the session is closed automatically (0 = never). */
export const IDLE_MINUTES = (() => { const v = Number(import.meta.env.VITE_IDLE_MINUTES ?? 30); return Number.isFinite(v) && v >= 0 ? v : 30; })();
