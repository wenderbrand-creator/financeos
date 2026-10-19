import { supabase } from "./supabaseClient";
import { USERNAME_DOMAIN } from "./config";

/** "wender" → "wender@users.financeos.app"; e-mails pass through unchanged. */
export function loginToEmail(login: string): string {
  const v = login.trim().toLowerCase();
  if (v.includes("@")) return v;
  return `${v}@${USERNAME_DOMAIN}`;
}
export function displayLogin(email: string | undefined | null): string {
  if (!email) return "";
  return email.endsWith("@" + USERNAME_DOMAIN) ? email.slice(0, -(USERNAME_DOMAIN.length + 1)) : email;
}
export function validUsername(login: string): string | null {
  const v = login.trim();
  if (!v) return "Informe um usuário ou e-mail.";
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido.";
  return /^[a-zA-Z0-9._-]{3,32}$/.test(v) ? null : "Use de 3 a 32 letras, números, ponto, hífen ou sublinhado.";
}
function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Usuário ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already exists")) return "Este usuário já existe. Use a aba Entrar.";
  if (m.includes("password should be at least") || m.includes("weak")) return "A senha é fraca. Use pelo menos 6 caracteres.";
  if (m.includes("email not confirmed")) return "Conta criada, mas a confirmação de e-mail está ativa no Supabase. Desative “Confirm email” (veja o README) e tente de novo.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Novos cadastros estão desativados.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um minuto.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com o servidor. Verifique a internet e as variáveis do Supabase.";
  return msg;
}
export async function signIn(login: string, password: string): Promise<string | null> {
  if (!supabase) return "Supabase não configurado.";
  const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
  return error ? translate(error.message) : null;
}
export async function signUp(login: string, password: string): Promise<string | null> {
  if (!supabase) return "Supabase não configurado.";
  const { data, error } = await supabase.auth.signUp({ email: loginToEmail(login), password });
  if (error) return translate(error.message);
  if (!data.session) return translate("email not confirmed");
  return null;
}
export async function signOut(): Promise<void> { if (supabase) await supabase.auth.signOut(); }
