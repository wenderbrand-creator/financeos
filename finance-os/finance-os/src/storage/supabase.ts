import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { createEmitter } from "./core";
import { defaultSettings, normalizeSettings, normalizeTx } from "../domain/model";
import { SCHEMA_VERSION } from "../domain/constants";

/**
 * Cloud store on Supabase (Postgres). Same contract as the local store:
 * subscribe · saveTx · saveMany · deleteTx · deleteMany · saveSettings · replaceAll · reload.
 * Every row carries user_id; Row Level Security restricts access to auth.uid().
 */
const TX = "transactions", ST = "user_settings", PAGE = 1000, BATCH = 400;

function toRow(t: any, userId: string) {
  return {
    user_id: userId, id: t.id, type: t.type, description: t.description, amount_cents: t.amountCents,
    category: t.category, date: t.date, status: t.status, account_id: t.accountId,
    series_id: t.seriesId ?? null, series_index: t.seriesIndex ?? null, series_total: t.seriesTotal ?? null,
    import_id: t.importId ?? null, transfer_id: t.transferId ?? null, bill_month: t.billMonth ?? null,
    created_ms: t.createdAt || 0, updated_ms: t.updatedAt || 0,
  };
}
function fromRow(r: any) {
  return normalizeTx(r.id, {
    description: r.description, amountCents: Number(r.amount_cents), type: r.type, category: r.category, date: r.date,
    status: r.status, accountId: r.account_id, createdAt: Number(r.created_ms) || 0, updatedAt: Number(r.updated_ms) || 0,
    seriesId: r.series_id ?? undefined, seriesIndex: r.series_index ?? undefined, seriesTotal: r.series_total ?? undefined,
    importId: r.import_id ?? undefined, transferId: r.transfer_id ?? undefined, billMonth: r.bill_month ?? undefined,
  });
}
function fail(error: any): never {
  const msg = String(error?.message || "");
  const code = error?.code === "42501" || /row-level security|permission/i.test(msg) ? "invalid_argument"
    : /fetch|network|timeout/i.test(msg) ? "unavailable"
    : error?.code === "54000" || /too large|payload/i.test(msg) ? "quota_exceeded" : "unavailable";
  throw Object.assign(new Error(msg || "Erro no Supabase"), { code });
}
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export function createSupabaseStore(sb: SupabaseClient, userId: string) {
  const em = createEmitter();
  let st: any = { settings: defaultSettings(), hasSettings: false, txs: [], ready: false, error: null };
  let channel: RealtimeChannel | null = null, started = false;
  const push = (patch: any) => { st = { ...st, ...patch }; em.emit(st); };
  const upsertLocal = (list: any[]) => { const by = new Map(st.txs.map((t: any) => [t.id, t])); for (const t of list) by.set(t.id, t); push({ txs: [...by.values()] }); };
  const removeLocal = (ids: string[]) => { const del = new Set(ids); push({ txs: st.txs.filter((t: any) => !del.has(t.id)) }); };

  async function fetchAll() {
    const s = await sb.from(ST).select("settings").eq("user_id", userId).maybeSingle();
    if (s.error) fail(s.error);
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
      const r = await sb.from(TX).select("*").eq("user_id", userId).order("id").range(from, from + PAGE - 1);
      if (r.error) fail(r.error);
      rows.push(...(r.data || []));
      if (!r.data || r.data.length < PAGE) break;
    }
    return { settings: s.data ? normalizeSettings(s.data.settings) : defaultSettings(), hasSettings: !!s.data, txs: rows.map(fromRow).filter(Boolean) };
  }
  async function start() {
    try { push({ ...(await fetchAll()), ready: true, error: null }); }
    catch (e) { push({ ready: true, error: e }); }
    // live updates from other devices (needs Realtime enabled on the tables; harmless otherwise)
    channel = sb.channel("fos-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: TX, filter: `user_id=eq.${userId}` }, (p: any) => {
        if (p.eventType === "DELETE") { if (p.old?.id) removeLocal([p.old.id]); }
        else { const t = fromRow(p.new); if (t) upsertLocal([t]); }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: ST, filter: `user_id=eq.${userId}` }, (p: any) => {
        if (p.new?.settings) push({ settings: normalizeSettings(p.new.settings), hasSettings: true });
      })
      .subscribe();
  }

  const store = {
    kind: "cloud" as const,
    subscribe(fn: (s: any) => void) {
      const off = em.on(fn);
      if (!started) { started = true; start(); }
      fn(st);
      return () => { off(); };
    },
    get state() { return st; },
    async ensureSettings() { if (!st.hasSettings) await store.saveSettings(st.settings); },
    async saveTx(t: any) { await store.saveMany([t]); },
    async saveMany(list: any[], onProgress?: (p: number) => void) {
      await store.ensureSettings();
      let done = 0;
      for (let part of chunk(list, BATCH)) {
        let { error } = await sb.from(TX).upsert(part.map(t => toRow(t, userId)), { onConflict: "user_id,id" });
        if (error && error.code === "23505" && /import_uniq/.test(error.message || "")) {
          // some statement lines are already on the server (an earlier attempt went through, or another device):
          // keep the server copy, show it locally, and save only the lines that are really new
          const ids = part.map(t => t.importId).filter(Boolean);
          const have = await sb.from(TX).select("*").eq("user_id", userId).in("import_id", ids);
          if (have.error) fail(have.error);
          const server = (have.data || []).map(fromRow).filter(Boolean);
          const known = new Set(server.map((t: any) => t.importId));
          upsertLocal(server);
          part = part.filter(t => !t.importId || !known.has(t.importId));
          error = part.length ? (await sb.from(TX).upsert(part.map(t => toRow(t, userId)), { onConflict: "user_id,id" })).error : null;
        }
        if (error) fail(error);
        upsertLocal(part); done += part.length; onProgress && onProgress(done / list.length);
      }
    },
    async deleteTx(id: string) { await store.deleteMany([id]); },
    async deleteMany(ids: string[]) {
      for (const part of chunk(ids, BATCH)) {
        const { error } = await sb.from(TX).delete().eq("user_id", userId).in("id", part);
        if (error) fail(error);
        removeLocal(part);
      }
    },
    async saveSettings(s: any) {
      const settings = { ...s, schemaVersion: SCHEMA_VERSION, updatedAt: Date.now() };
      const { error } = await sb.from(ST).upsert({ user_id: userId, settings, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) fail(error);
      push({ settings: normalizeSettings(settings), hasSettings: true });
    },
    async replaceAll(data: any, onProgress?: ((p: number) => void) | null) {
      const keep = new Set(data.txs.map((t: any) => t.id));
      const del = st.txs.filter((t: any) => !keep.has(t.id)).map((t: any) => t.id);
      await store.saveSettings(data.settings);
      onProgress && onProgress(0.05);
      if (del.length) await store.deleteMany(del);
      await store.saveMany(data.txs, p => onProgress && onProgress(0.1 + p * 0.9));
    },
    /** Re-reads everything from the server (used to verify a migration). */
    async reload() { const fresh = await fetchAll(); push({ ...fresh, ready: true, error: null }); return fresh; },
    dispose() { if (channel) sb.removeChannel(channel); },
  };
  return store;
}
