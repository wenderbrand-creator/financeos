-- Finance OS — schema for Supabase (Postgres)
-- Run once in Supabase Dashboard → SQL Editor (or `supabase db push`).
-- Money is always stored as integer cents (bigint). Each row belongs to one auth user.

create table if not exists public.user_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  settings    jsonb not null,               -- profile name, accounts, cards, categories, preferences
  updated_at  timestamptz not null default now()
);

create table if not exists public.transactions (
  user_id       uuid not null references auth.users(id) on delete cascade,
  id            text not null check (char_length(id) between 1 and 120),
  type          text not null check (type in ('income', 'expense')),
  description   text not null check (char_length(description) between 1 and 200),
  amount_cents  bigint not null check (amount_cents > 0 and amount_cents <= 99999999999),
  category      text not null,
  date          date not null,
  status        text not null check (status in ('paid', 'pending')),
  account_id    text not null,
  series_id     text,
  series_index  integer,
  series_total  integer,
  import_id     text,
  transfer_id   text,
  bill_month    text check (bill_month is null or bill_month ~ '^\d{4}-\d{2}$'),
  created_ms    bigint not null default 0,
  updated_ms    bigint not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists transactions_user_date_idx    on public.transactions (user_id, date);
create index if not exists transactions_user_account_idx on public.transactions (user_id, account_id);
create index if not exists transactions_user_import_idx  on public.transactions (user_id, import_id) where import_id is not null;

-- Row Level Security: a user can only see and change their own rows.
alter table public.user_settings enable row level security;
alter table public.transactions  enable row level security;

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Live sync between devices (optional; the app works without it).
do $$ begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then null; when undefined_object then null; end $$;
