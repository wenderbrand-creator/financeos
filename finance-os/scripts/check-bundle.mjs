/**
 * Fails the build if the production bundle contains anything that must never reach a browser:
 * a Supabase service_role / secret key, private keys, or source maps.
 * Runs automatically after `npm run build` (postbuild).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p); } };
walk(dist);

const problems = [];
for (const f of files) {
  if (f.endsWith(".map")) problems.push(`source map publicado: ${f}`);
  if (!/\.(js|html|css|json|txt)$/.test(f)) continue;
  const text = readFileSync(f, "utf8");
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) problems.push(`chave secreta do Supabase (sb_secret_) em ${f}`);
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) problems.push(`chave privada em ${f}`);
  for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
      if (payload.role && payload.role !== "anon") problems.push(`JWT com role "${payload.role}" em ${f} (use apenas a chave anon/publishable)`);
    } catch { /* not a JWT */ }
  }
}
if (problems.length) {
  console.error("\n[ERRO] Verificacao de seguranca do bundle falhou:\n  - " + problems.join("\n  - ") + "\n");
  process.exit(1);
}
console.log(`[OK] Bundle verificado: ${files.length} arquivos, nenhuma credencial secreta ou source map.`);
