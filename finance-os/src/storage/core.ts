/* =====================================================================
   5. STORAGE ADAPTERS — cloud (private per-user db) → browser → memory
   ===================================================================== */
export function createEmitter(): { on(fn: (v: any) => void): () => void; emit(v: any): void } {
  const ls = new Set<(v: any) => void>();
  return { on(fn) { ls.add(fn); return () => { ls.delete(fn); }; }, emit(v) { ls.forEach(fn => fn(v)); } };
}
export async function withRetry(fn) {
  try { return await fn(); }
  catch (e) {
    if (e && e.code === "unavailable") { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); return await fn(); }
    if (e && e.code === "resource_exhausted") {
      for (let i = 1; i <= 3; i++) { await new Promise(r => setTimeout(r, 1200 * i)); try { return await fn(); } catch (e2) { if (!e2 || e2.code !== "resource_exhausted" || i === 3) throw e2; } }
    }
    throw e;
  }
}
export function errMessage(e) {
  const c = e && e.code;
  if (c === "quota_exceeded") return "Limite de armazenamento atingido. Exporte um backup e remova registros antigos.";
  if (c === "resource_exhausted") return "Muitas gravações em sequência. Aguarde alguns segundos e tente de novo.";
  if (c === "invalid_argument") return "O servidor recusou a gravação. Saia da conta e entre de novo.";
  if (c === "revoked") return "O acesso ao armazenamento foi encerrado. Recarregue a página.";
  return "Não foi possível salvar. Verifique a conexão e tente de novo.";
}
