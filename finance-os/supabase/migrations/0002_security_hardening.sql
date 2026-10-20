-- Finance OS — 0002: security hardening (non-destructive)
-- Run AFTER 0001_finance_os.sql, once, in Supabase Dashboard → SQL Editor.
-- It never deletes or rewrites existing rows. New constraints are added NOT VALID, so they are
-- enforced on every new INSERT/UPDATE without failing on legacy rows; a validation query at the end
-- reports any legacy row that would not pass.

begin;

-- ---------------------------------------------------------------------------
-- 1. Least privilege: anonymous visitors get nothing; signed-in users only CRUD.
--    (Supabase grants ALL on new public tables to anon/authenticated by default.
--    RLS already blocks rows, but TRUNCATE/REFERENCES/TRIGGER are not covered by RLS.)
-- ---------------------------------------------------------------------------
revoke all on table public.transactions  from anon, authenticated;
revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update, delete on table public.transactions  to authenticated;
grant select, insert, update, delete on table public.user_settings to authenticated;

-- user_id defaults to the caller; the client never needs to be trusted with it
alter table public.transactions  alter column user_id set default auth.uid();
alter table public.user_settings alter column user_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- 2. Row Level Security: one explicit policy per operation (replaces the "for all" policies).
--    UPDATE has both USING and WITH CHECK, so a row can neither be read nor moved to another user.
-- ---------------------------------------------------------------------------
alter table public.transactions  enable row level security;
alter table public.user_settings enable row level security;
alter table public.transactions  force row level security;
alter table public.user_settings force row level security;

drop policy if exists "own transactions" on public.transactions;
drop policy if exists "tx select own" on public.transactions;
drop policy if exists "tx insert own" on public.transactions;
drop policy if exists "tx update own" on public.transactions;
drop policy if exists "tx delete own" on public.transactions;
create policy "tx select own" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "tx insert own" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tx update own" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tx delete own" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "own settings" on public.user_settings;
drop policy if exists "settings select own" on public.user_settings;
drop policy if exists "settings insert own" on public.user_settings;
drop policy if exists "settings update own" on public.user_settings;
drop policy if exists "settings delete own" on public.user_settings;
create policy "settings select own" on public.user_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy "settings insert own" on public.user_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "settings update own" on public.user_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings delete own" on public.user_settings for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. Data integrity constraints (money stays integer cents; reject absurd or oversized input)
-- ---------------------------------------------------------------------------
alter table public.transactions drop constraint if exists tx_id_format;
alter table public.transactions add constraint tx_id_format check (id ~ '^[A-Za-z0-9_.~:@+-]{1,120}$') not valid;
alter table public.transactions drop constraint if exists tx_category_len;
alter table public.transactions add constraint tx_category_len check (char_length(category) between 1 and 64) not valid;
alter table public.transactions drop constraint if exists tx_account_len;
alter table public.transactions add constraint tx_account_len check (char_length(account_id) between 1 and 120) not valid;
alter table public.transactions drop constraint if exists tx_date_range;
alter table public.transactions add constraint tx_date_range check (date between date '1990-01-01' and date '2100-12-31') not valid;
alter table public.transactions drop constraint if exists tx_desc_clean;
alter table public.transactions add constraint tx_desc_clean check (btrim(description) <> '' and description !~ '[\x00-\x08\x0B\x0C\x0E-\x1F]') not valid;
alter table public.transactions drop constraint if exists tx_series_shape;
alter table public.transactions add constraint tx_series_shape check (
  (series_id is null and series_index is null and series_total is null)
  or (series_id is not null and char_length(series_id) <= 120 and series_total between 1 and 600 and series_index between 1 and series_total)
) not valid;
alter table public.transactions drop constraint if exists tx_refs_len;
alter table public.transactions add constraint tx_refs_len check (
  coalesce(char_length(import_id), 0) <= 160 and coalesce(char_length(transfer_id), 0) <= 120
) not valid;
alter table public.transactions drop constraint if exists tx_ms_nonneg;
alter table public.transactions add constraint tx_ms_nonneg check (created_ms >= 0 and updated_ms >= 0) not valid;

alter table public.user_settings drop constraint if exists settings_shape;
alter table public.user_settings add constraint settings_shape check (
  jsonb_typeof(settings) = 'object' and octet_length(settings::text) <= 262144
) not valid;

-- server-side timestamp (the client cannot backdate updated_at)
create or replace function public.fos_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists fos_touch_tx on public.transactions;
create trigger fos_touch_tx before insert or update on public.transactions for each row execute function public.fos_touch_updated_at();
drop trigger if exists fos_touch_settings on public.user_settings;
create trigger fos_touch_settings before insert or update on public.user_settings for each row execute function public.fos_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Duplicate protection: the same bank-statement line can exist only once per user.
--    Created only if current data has no duplicates (otherwise it reports and skips).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.transactions where import_id is not null group by user_id, import_id having count(*) > 1) then
    raise notice 'Finance OS: import_id duplicado encontrado; índice único NÃO criado. Rode a consulta de verificação no fim do arquivo.';
  else
    execute 'create unique index if not exists transactions_user_import_uniq on public.transactions (user_id, import_id) where import_id is not null';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Abuse limit: at most 50 000 transactions per account (protects the database from
--    a malicious sign-up filling storage). Counter kept by trigger; no per-row COUNT(*).
-- ---------------------------------------------------------------------------
create table if not exists public.user_usage (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  tx_count integer not null default 0 check (tx_count >= 0)
);
alter table public.user_usage enable row level security;
alter table public.user_usage force row level security;
revoke all on table public.user_usage from anon, authenticated;
grant select on table public.user_usage to authenticated;
drop policy if exists "usage select own" on public.user_usage;
create policy "usage select own" on public.user_usage for select to authenticated using ((select auth.uid()) = user_id);

-- backfill counters from existing data (read-only on transactions)
insert into public.user_usage (user_id, tx_count)
select user_id, count(*)::int from public.transactions group by user_id
on conflict (user_id) do update set tx_count = excluded.tx_count;

create or replace function public.fos_track_usage() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if tg_op = 'INSERT' then
    insert into public.user_usage as u (user_id, tx_count) values (new.user_id, 1)
      on conflict (user_id) do update set tx_count = u.tx_count + 1
      returning u.tx_count into n;
    if n > 50000 then
      raise exception 'Limite de lançamentos da conta atingido' using errcode = '54000';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.user_usage set tx_count = greatest(tx_count - 1, 0) where user_id = old.user_id;
    return old;
  end if;
  return null;
end $$;
revoke all on function public.fos_track_usage() from public, anon, authenticated;
drop trigger if exists fos_usage_tx on public.transactions;
create trigger fos_usage_tx after insert or delete on public.transactions for each row execute function public.fos_track_usage();

-- ---------------------------------------------------------------------------
-- 6. Audit trail of financial changes (who/when/what amount). Written only by trigger;
--    users can read their own history and can never edit or delete it.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  at          timestamptz not null default now(),
  action      text not null check (action in ('insert', 'update', 'delete')),
  tx_id       text not null,
  amount_old  bigint,
  amount_new  bigint,
  date_old    date,
  date_new    date,
  actor       uuid default auth.uid()
);
create index if not exists audit_log_user_at_idx on public.audit_log (user_id, at desc);
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;
drop policy if exists "audit select own" on public.audit_log;
create policy "audit select own" on public.audit_log for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.fos_audit_tx() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (user_id, action, tx_id, amount_new, date_new) values (new.user_id, 'insert', new.id, new.amount_cents, new.date);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.amount_cents is distinct from old.amount_cents or new.date is distinct from old.date
       or new.type is distinct from old.type or new.account_id is distinct from old.account_id then
      insert into public.audit_log (user_id, action, tx_id, amount_old, amount_new, date_old, date_new)
      values (new.user_id, 'update', new.id, old.amount_cents, new.amount_cents, old.date, new.date);
    end if;
    return new;
  else
    -- when the whole account is being deleted (cascade from auth.users), keep no trail behind
    if exists (select 1 from auth.users where id = old.user_id) then
      insert into public.audit_log (user_id, action, tx_id, amount_old, date_old) values (old.user_id, 'delete', old.id, old.amount_cents, old.date);
    end if;
    return old;
  end if;
end $$;
revoke all on function public.fos_audit_tx() from public, anon, authenticated;
drop trigger if exists fos_audit on public.transactions;
create trigger fos_audit after insert or update or delete on public.transactions for each row execute function public.fos_audit_tx();

revoke all on function public.fos_touch_updated_at() from public, anon, authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verificação (somente leitura). Deve retornar 0 linhas em cada consulta.
-- ---------------------------------------------------------------------------
-- Linhas antigas que não passariam nas novas regras:
-- select user_id, id from public.transactions where not (id ~ '^[A-Za-z0-9_.~:@+-]{1,120}$')
--   or char_length(category) not between 1 and 64 or date not between '1990-01-01' and '2100-12-31';
-- Lançamentos importados duplicados:
-- select user_id, import_id, count(*) from public.transactions where import_id is not null group by 1,2 having count(*) > 1;
-- Tabelas públicas sem RLS (deve vir vazio):
-- select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
