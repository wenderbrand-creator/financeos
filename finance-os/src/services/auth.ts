import { supabase } from "./supabaseClient";
import { USERNAME_DOMAIN } from "./config";

/**
 * Authentication helpers (Supabase Auth, e-mail + password).
 * - New accounts require a real e-mail (verifiable, recoverable).
 * - Legacy accounts created with a plain username keep working at sign-in.
 * - Messages never reveal whether an e-mail is registered (no account enumeration).
 */

/** "maria" → "maria@users.financeos.app" (legacy usernames); e-mails pass through. */
export function loginToEmail(login: string): string {
  const v = login.trim().toLowerCase();
  if (v.includes("@")) return v;
  return `${v}@${USERNAME_DOMAIN}`;
}
export function displayLogin(email: string | undefined | null): string {
  if (!email) return "";
  return email.endsWith("@" + USERNAME_DOMAIN) ? email.slice(0, -(USERNAME_DOMAIN.length + 1)) : email;
}
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export function validEmail(v: string): string | null {
  const s = v.trim();
  if (!s) return "Informe seu e-mail.";
  return EMAIL_RE.test(s) && s.length <= 254 ? null : "E-mail inválido.";
}
/** Sign-in field: e-mail, or a legacy username. */
export function validLogin(login: string): string | null {
  const v = login.trim();
  if (!v) return "Informe seu e-mail.";
  if (v.includes("@")) return validEmail(v);
  return /^[a-zA-Z0-9._-]{3,32}$/.test(v) ? null : "E-mail inválido.";
}
/** Kept for compatibility with older imports. */
export const validUsername = validLogin;

const COMMON = new Set(["12345678", "123456789", "1234567890", "password", "senha123", "senha1234", "qwerty123", "abc12345", "11111111", "00000000", "financeos", "12341234", "iloveyou1"]);
/** Password policy for new passwords: 8–72 chars, letters and numbers, not a common one, not the e-mail. */
export function passwordProblem(pw: string, login = ""): string | null {
  if (pw.length < 8) return "Use pelo menos 8 caracteres.";
  if (pw.length > 72) return "Use no máximo 72 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(pw) || !/\d/.test(pw)) return "Misture letras e números.";
  const low = pw.toLowerCase();
  if (COMMON.has(low)) return "Essa senha é muito comum. Escolha outra.";
  const user = login.trim().toLowerCase().split("@")[0];
  if (user && user.length >= 3 && low.includes(user)) return "A senha não pode conter o seu e-mail.";
  return null;
}

/** Maps Supabase errors to neutral Portuguese messages. Unknown errors never show raw server text. */
function translate(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Procure a mensagem que enviamos (veja também o spam).";
  if (m.includes("password should be") || m.includes("weak") || m.includes("pwned") || m.includes("leaked")) return "Essa senha não é aceita. Use uma senha mais forte, com letras e números.";
  if (m.includes("same password") || m.includes("different from the old")) return "A nova senha precisa ser diferente da atual.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Novos cadastros estão desativados no momento.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "Este link expirou ou já foi usado. Peça um novo.";
  console.warn("[Finance OS] auth:", msg);
  return "Não foi possível concluir agora. Tente de novo em instantes.";
}
const redirectTo = () => (typeof window !== "undefined" ? window.location.origin + "/" : undefined);

export async function signIn(login: string, password: string): Promise<string | null> {
  if (!supabase) return "Serviço indisponível.";
  const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
  return error ? translate(error.message) : null;
}

/**
 * Creates an account. Returns:
 *  - { ok: "session" }  signed in right away (e-mail confirmation disabled in the project)
 *  - { ok: "confirm" }  check-your-inbox; also returned for an e-mail that already exists,
 *                       so the screen never confirms which addresses are registered
 *  - { error }
 */
export async function signUp(email: string, password: string): Promise<{ ok?: "session" | "confirm"; error?: string }> {
  if (!supabase) return { error: "Serviço indisponível." };
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: redirectTo() } });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("already registered") || m.includes("already exists")) return { ok: "confirm" };
    return { error: translate(error.message) };
  }
  return { ok: data.session ? "session" : "confirm" };
}

/** Always reports success, whether or not the e-mail exists (no enumeration). */
export async function requestPasswordReset(email: string): Promise<string | null> {
  if (!supabase) return "Serviço indisponível.";
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: redirectTo() });
  if (error && /rate limit|too many|security purposes/i.test(error.message)) return translate(error.message);
  return null;
}
export async function updatePassword(password: string): Promise<string | null> {
  if (!supabase) return "Serviço indisponível.";
  const { error } = await supabase.auth.updateUser({ password });
  return error ? translate(error.message) : null;
}
/** Re-checks the signed-in user's password before destructive actions. */
export async function reauthenticate(password: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return "Sessão expirada. Entre novamente.";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? (error.message.toLowerCase().includes("invalid login") ? "Senha incorreta." : translate(error.message)) : null;
}
/** Ends the session on every device ("global" revokes all refresh tokens). */
export async function signOut(scope: "global" | "local" = "global"): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope });
  if (error) await supabase.auth.signOut({ scope: "local" });
}
