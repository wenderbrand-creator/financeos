/**
 * Database security tests for Finance OS (RLS, privileges, constraints, triggers).
 * Runs the real migrations on an in-memory PostgreSQL (PGlite) that emulates Supabase:
 * roles anon/authenticated, auth.users, auth.uid() from the JWT claims, and Supabase's
 * default "grant all" on public tables. Usage:  npm run test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(join(here, "..", "migrations", f), "utf8");
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
let pass = 0, fail = 0;
const ok = (cond, name, extra = "") => { if (cond) { pass++; console.log("  ✓", name); } else { fail++; console.log("  ✗", name, extra); } };

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- Supabase default: every new public table is fully granted to anon and authenticated
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  insert into auth.users values ('${A}', 'a@test.dev'), ('${B}', 'b@test.dev');
`);
await db.exec(mig("0001_finance_os.sql"));
await db.exec(mig("0002_security_hardening.sql"));
await db.exec(mig("0002_security_hardening.sql")); // must be re-runnable
await db.exec(mig("0003_account_deletion.sql"));
await db.exec(mig("0003_account_deletion.sql")); // must be re-runnable

/** run a statement as a given role/user; returns {rows, error} */
async function as(user, sql, params = []) {
  const tx = await db.transaction(async (t) => {
    if (user === "anon") await t.exec(`set local role anon; select set_config('request.jwt.claim.sub', '', true);`);
    else await t.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${user}', true);`);
    try { const r = await t.query(sql, params); return { rows: r.rows, affected: r.affectedRows ?? 0 }; }
    catch (e) { return { error: String(e.message || e) }; }
  });
  return tx;
}
const tx = (id, u, extra = {}) => ({ id, type: "expense", description: "Mercado", amount_cents: 12345, category: "alimentacao", date: "2026-10-10", status: "paid", account_id: "acc-main", ...extra });
const ins = (u, t) => as(u, `insert into public.transactions (user_id, id, type, description, amount_cents, category, date, status, account_id, series_id, series_index, series_total, import_id)
  values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [t.user_id ?? u, t.id, t.type, t.description, t.amount_cents, t.category, t.date, t.status, t.account_id, t.series_id ?? null, t.series_index ?? null, t.series_total ?? null, t.import_id ?? null]);

console.log("\nIsolamento entre usuários");
ok(!(await ins(A, tx("a1", A))).error, "A cria o próprio lançamento");
ok(!(await ins(B, tx("b1", B))).error, "B cria o próprio lançamento");
let r = await as(A, `select id from public.transactions`);
ok(r.rows.length === 1 && r.rows[0].id === "a1", "A lê somente os próprios lançamentos", JSON.stringify(r));
r = await as(A, `select id from public.transactions where user_id = '${B}'`);
ok(r.rows.length === 0, "A não lê lançamentos de B nem filtrando pelo user_id de B (IDOR)");
r = await as(A, `update public.transactions set amount_cents = 1 where id = 'b1'`);
r = await as(B, `select amount_cents from public.transactions where id = 'b1'`);
ok(Number(r.rows[0].amount_cents) === 12345, "A não altera lançamento de B");
r = await as(A, `delete from public.transactions where id = 'b1'`);
r = await as(B, `select count(*)::int c from public.transactions`);
ok(r.rows[0].c === 1, "A não exclui lançamento de B");
r = await ins(A, { ...tx("forjado", A), user_id: B });
ok(!!r.error, "A não cria lançamento em nome de B (user_id forjado)", r.error || "");
r = await as(A, `update public.transactions set user_id = '${B}' where id = 'a1'`);
ok(!!r.error, "A não transfere o próprio lançamento para B", r.error || "");
r = await as(A, `insert into public.transactions (id, type, description, amount_cents, category, date, status, account_id) values ('semuser','expense','x',100,'outros-d','2026-10-10','paid','acc-main') returning user_id`);
ok(!r.error && r.rows[0].user_id === A, "user_id é preenchido pelo servidor (auth.uid())", r.error || "");

console.log("\nVisitante não autenticado (anon)");
r = await as("anon", `select * from public.transactions`);
ok(!!r.error, "anon não lê transações (sem privilégio)", r.error ? "" : JSON.stringify(r));
r = await as("anon", `select * from public.user_settings`);
ok(!!r.error, "anon não lê configurações");
r = await ins("anon", tx("anon1", A));
ok(!!r.error, "anon não grava transações");
r = await as("anon", `select * from public.audit_log`);
ok(!!r.error, "anon não lê histórico");

console.log("\nPrivilégios perigosos");
r = await as(A, `truncate public.transactions`);
ok(!!r.error, "usuário autenticado não pode TRUNCATE (RLS não cobre TRUNCATE)");
r = await as(A, `insert into public.audit_log (user_id, action, tx_id) values ('${A}','insert','x')`);
ok(!!r.error, "usuário não escreve no histórico de auditoria");
r = await as(A, `delete from public.audit_log`);
ok(!!r.error, "usuário não apaga o histórico de auditoria");
r = await as(A, `update public.user_usage set tx_count = 0`);
ok(!!r.error, "usuário não zera o próprio contador de uso");
r = await as(A, `select public.fos_audit_tx()`);
ok(!!r.error, "funções SECURITY DEFINER não podem ser chamadas diretamente");

console.log("\nConfigurações");
ok(!(await as(A, `insert into public.user_settings (user_id, settings) values ($1, '{"profileName":"A"}')`, [A])).error, "A grava as próprias configurações");
r = await as(B, `select * from public.user_settings`);
ok(r.rows.length === 0, "B não lê configurações de A");
r = await as(B, `update public.user_settings set settings = '{"x":1}' where user_id = '${A}'`);
r = await as(A, `select settings->>'profileName' n from public.user_settings`);
ok(r.rows[0]?.n === "A", "B não altera configurações de A");
r = await as(A, `update public.user_settings set settings = '[1,2]'::jsonb`);
ok(!!r.error, "configurações precisam ser um objeto JSON");
r = await as(A, `update public.user_settings set settings = jsonb_build_object('lixo', repeat('x', 300000))`);
ok(!!r.error, "configurações acima de 256 KB são recusadas");

console.log("\nIntegridade dos valores");
for (const [name, t] of [
  ["valor zero", tx("v0", A, { amount_cents: 0 })],
  ["valor negativo", tx("vneg", A, { amount_cents: -500 })],
  ["valor absurdo (> R$ 999 milhões)", tx("vbig", A, { amount_cents: 100000000000 })],
  ["tipo inválido", tx("vtype", A, { type: "gift" })],
  ["status inválido", tx("vst", A, { status: "maybe" })],
  ["data fora do intervalo", tx("vdate", A, { date: "1800-01-01" })],
  ["descrição vazia", tx("vdesc", A, { description: "   " })],
  ["descrição longa demais", tx("vlong", A, { description: "x".repeat(201) })],
  ["id com caracteres inválidos", tx("a/../b", A)],
  ["parcela 5 de 3", tx("vser", A, { series_id: "p1", series_index: 5, series_total: 3 })],
]) { const e = await ins(A, t); ok(!!e.error, `recusa ${name}`); }
r = await as(A, `insert into public.transactions (user_id,id,type,description,amount_cents,category,date,status,account_id) values ($1,'frac','expense','x',10.5,'outros-d','2026-10-10','paid','acc') `, [A]);
const frac = await as(A, `select amount_cents from public.transactions where id='frac'`);
ok(!!r.error || (frac.rows[0] && Number.isInteger(Number(frac.rows[0].amount_cents))), "centavos são sempre inteiros (bigint)");

console.log("\nDuplicidade de importação");
ok(!(await ins(A, tx("i1", A, { import_id: "fX1" }))).error, "primeira importação de uma linha do extrato");
r = await ins(A, tx("i2", A, { import_id: "fX1" }));
ok(!!r.error, "a mesma linha do extrato não entra duas vezes");
ok(!(await ins(B, tx("i3", B, { import_id: "fX1" }))).error, "outro usuário pode ter o mesmo identificador de extrato");

console.log("\nAuditoria e contadores");
await as(A, `update public.transactions set amount_cents = 999 where id = 'a1'`);
await as(A, `delete from public.transactions where id = 'semuser'`);
r = await as(A, `select action, tx_id, amount_old, amount_new from public.audit_log order by id`);
const acts = r.rows.map(x => `${x.action}:${x.tx_id}`);
ok(acts.includes("update:a1") && acts.includes("delete:semuser") && acts.includes("insert:a1"), "alterações de valor e exclusões ficam no histórico", acts.join(","));
ok(r.rows.find(x => x.action === "update")?.amount_old == 12345, "histórico guarda valor antigo e novo");
r = await as(B, `select * from public.audit_log`);
ok(r.rows.every(x => x.user_id === B), "B vê apenas o próprio histórico");
const cnt = await as(A, `select tx_count from public.user_usage`);
const real = await as(A, `select count(*)::int c from public.transactions`);
ok(cnt.rows[0]?.tx_count === real.rows[0].c, "contador de uso confere com a quantidade real", JSON.stringify([cnt.rows, real.rows]));
r = await as(A, `update public.transactions set updated_at = '2000-01-01' where id = 'a1' returning updated_at`);
ok(!r.error && new Date(r.rows[0].updated_at).getFullYear() >= 2024, "updated_at é definido pelo servidor");

console.log("\nLimite por conta");
await db.exec(`update public.user_usage set tx_count = 50000 where user_id = '${B}'`);
r = await ins(B, tx("over", B));
ok(!!r.error && /Limite/.test(r.error), "bloqueia acima de 50 000 lançamentos por conta", r.error || "");

console.log("\nExclusão da conta (LGPD)");
await db.exec(`delete from auth.users where id = '${B}'`);
const left = await db.query(`select (select count(*) from public.transactions where user_id='${B}')::int t, (select count(*) from public.audit_log where user_id='${B}')::int a, (select count(*) from public.user_settings where user_id='${B}')::int s`);
ok(left.rows[0].t === 0 && left.rows[0].a === 0 && left.rows[0].s === 0, "ao excluir a conta, lançamentos, histórico e configurações somem", JSON.stringify(left.rows));

console.log("\nTabelas públicas sem RLS");
r = await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
ok(r.rows.length === 0, "todas as tabelas públicas têm RLS", JSON.stringify(r.rows));

console.log("\nExclusão da própria conta (LGPD)");
const C = "33333333-3333-3333-3333-333333333333";
await db.exec(`insert into auth.users values ('${C}', 'c@test.dev')`);
ok(!(await ins(C, tx("c1", C))).error, "C cria um lançamento antes de excluir a conta");
r = await as("anon", `select public.delete_my_account()`);
ok(!!r.error, "visitante anônimo não consegue chamar a exclusão", JSON.stringify(r));
r = await as(C, `select public.delete_my_account()`);
ok(!r.error, "C exclui a própria conta", JSON.stringify(r));
r = await db.query(`select count(*)::int n from auth.users where id = '${C}'`);
ok(r.rows[0].n === 0, "usuário C some de auth.users");
r = await db.query(`select (select count(*)::int from public.transactions where user_id = '${C}') + (select count(*)::int from public.audit_log where user_id = '${C}') + (select count(*)::int from public.user_usage where user_id = '${C}') n`);
ok(r.rows[0].n === 0, "lançamentos, histórico e contador de C são apagados junto");
r = await db.query(`select count(*)::int n from auth.users where id = '${A}'`);
ok(r.rows[0].n === 1, "a conta de A continua intacta");
r = await as(A, `select count(*)::int n from public.transactions`);
ok(r.rows[0].n >= 1, "os lançamentos de A continuam intactos");

console.log(`\n${pass} aprovados, ${fail} reprovados`);
process.exit(fail ? 1 : 0);
