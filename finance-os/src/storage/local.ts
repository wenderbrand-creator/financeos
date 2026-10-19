import { txBody } from "../domain/model";
import { SCHEMA_VERSION } from "../domain/constants";
import { defaultSettings, normalizeSettings, normalizeTx } from "../domain/model";
import { createEmitter } from "./core";

export const LS_KEY = "finance-os:v1";
export function localAvailable() { try { localStorage.setItem("__fos", "1"); localStorage.removeItem("__fos"); return true; } catch { return false; } }
export function createMemoryStore(initial: any, kind: string, persist?: (data: any) => void) {
  const em = createEmitter();
  let st = { settings: initial.settings, hasSettings: true, txs: initial.txs, ready: true, error: null };
  const commit = (patch) => {
    const next = { ...st, ...patch };
    if (persist) persist({ schemaVersion: SCHEMA_VERSION, settings: next.settings, txs: next.txs.map(t => ({ id: t.id, ...txBody(t) })) });
    st = next; em.emit(st);
  };
  return {
    kind,
    subscribe(fn) { const off = em.on(fn); fn(st); return off; },
    get state() { return st; },
    async saveTx(t) { const i = st.txs.findIndex(x => x.id === t.id); const txs = st.txs.slice(); if (i >= 0) txs[i] = t; else txs.push(t); commit({ txs }); },
    async deleteTx(id) { commit({ txs: st.txs.filter(t => t.id !== id) }); },
    async saveMany(list, onProgress) { const by = new Map(st.txs.map(t => [t.id, t])); for (const t of list) by.set(t.id, t); commit({ txs: [...by.values()] }); onProgress && onProgress(1); },
    async deleteMany(ids) { const del = new Set(ids); commit({ txs: st.txs.filter(t => !del.has(t.id)) }); },
    async saveSettings(s) { commit({ settings: { ...s, schemaVersion: SCHEMA_VERSION } }); },
    async replaceAll(data, onProgress) { commit({ settings: data.settings, txs: data.txs }); onProgress && onProgress(1); },
    async reload() { return { settings: st.settings, txs: st.txs }; },
  };
}
export function createLocalStore() {
  let initial = { settings: defaultSettings(), txs: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (raw) initial = { settings: normalizeSettings(raw.settings), txs: (raw.txs || []).map(t => normalizeTx(t.id, t)).filter(Boolean) };
  } catch { /* corrupt or blocked: start empty without overwriting until a change */ }
  return createMemoryStore(initial, "local", (data) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
    catch (e) { const err: any = new Error("local"); err.code = "local_write"; throw err; }
  });
}
