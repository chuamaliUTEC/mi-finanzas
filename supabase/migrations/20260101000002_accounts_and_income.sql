-- ============================================================
-- accounts: bank accounts / cash / wallets owned by a user
-- ============================================================
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'cash', 'investment', 'other')),
  currency text not null default 'PEN',
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts(user_id);

alter table public.accounts enable row level security;
create policy "accounts_all_own" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ============================================================
-- income_sources: e.g. "Sueldo", "Freelance", "Alquiler"
-- ============================================================
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_recurring boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_sources_user_id_idx on public.income_sources(user_id);

alter table public.income_sources enable row level security;
create policy "income_sources_all_own" on public.income_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_income_sources_updated_at
  before update on public.income_sources
  for each row execute function public.set_updated_at();

-- ============================================================
-- income_transactions: individual income entries
-- ============================================================
create table public.income_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  source_id uuid references public.income_sources(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'PEN',
  description text,
  received_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_transactions_user_id_idx on public.income_transactions(user_id);
create index income_transactions_received_at_idx on public.income_transactions(received_at);

alter table public.income_transactions enable row level security;
create policy "income_transactions_all_own" on public.income_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_income_transactions_updated_at
  before update on public.income_transactions
  for each row execute function public.set_updated_at();
