/* ---------- user experience preferences (Configurações › Aparência) ---------- */
export const ACCENTS = [
  ["Índigo", "#5856D6"], ["Azul", "#2563EB"], ["Ciano", "#0891B2"], ["Esmeralda", "#059669"], ["Violeta", "#7C3AED"],
  ["Magenta", "#C026D3"], ["Coral", "#E2554B"], ["Âmbar", "#D97706"], ["Grafite", "#3F4654"],
];
export const DEFAULT_PREFS = { theme: "system", accent: "#5856D6", density: "comfortable", motion: "system", startPage: "inicio", hideOnOpen: false };
export const isHex = h => typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h);
export function normPrefs(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    theme: ["system", "light", "dark"].includes(r.theme) ? r.theme : DEFAULT_PREFS.theme,
    accent: isHex(r.accent) ? r.accent.toUpperCase() : DEFAULT_PREFS.accent,
    density: ["comfortable", "compact"].includes(r.density) ? r.density : DEFAULT_PREFS.density,
    motion: ["system", "on", "off"].includes(r.motion) ? r.motion : DEFAULT_PREFS.motion,
    startPage: ["inicio", "visao", "orcamento"].includes(r.startPage) ? r.startPage : DEFAULT_PREFS.startPage,
    hideOnOpen: !!r.hideOnOpen,
  };
}
export function hexRgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255); }
export function luminance(rgb) { const f = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); const [r, g, b] = rgb.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function applyPrefs(p) {
  const r = document.documentElement;
  if (p.theme === "light" || p.theme === "dark") r.setAttribute("data-fos-theme", p.theme); else r.removeAttribute("data-fos-theme");
  r.setAttribute("data-fos-density", p.density);
  r.setAttribute("data-fos-motion", p.motion);
  const rgb = hexRgb(p.accent);
  r.style.setProperty("--accent-base", p.accent);
  r.style.setProperty("--on-accent-l", luminance(rgb) > 0.4 ? "#0D0F14" : "#fff");
  r.style.setProperty("--on-accent-d", luminance(rgb.map(c => c * 0.72 + 0.28)) > 0.4 ? "#0D0F14" : "#fff");
}
export function motionAllowed(p) { if (p.motion === "off") return false; if (p.motion === "on") return true; try { return !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; } }
export function effectiveTheme(p) {
  if (p.theme !== "system") return p.theme;
  const host = document.documentElement.getAttribute("data-theme");
  if (host === "dark" || host === "light") return host;
  try { return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch { return "light"; }
}

/* =====================================================================
   11. SHELL
   ===================================================================== */
export const LS_UI = "finance-os:ui";
export function loadUI() { try { return JSON.parse(localStorage.getItem(LS_UI) || "{}"); } catch { return {}; } }
export function saveUI(v) { try { localStorage.setItem(LS_UI, JSON.stringify(v)); } catch { } }
