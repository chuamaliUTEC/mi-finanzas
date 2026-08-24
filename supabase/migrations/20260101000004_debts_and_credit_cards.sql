-- ============================================================
-- debts: loans / obligations owed by the user
-- ============================================================
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  creditor text,
  original_amount numeric(14,2) not null check (original_amount > 0),
  current_balance numeric(14,2) not null check (current_balance >= 0),
  interest_rate numeric(6,3) default 0,
  minimum_payment numeric(14,2),
  due_day smallint check (due_day between 1 and 31),
  status text not null default 'active' check (status in ('active', 'paid_off', 'defaulted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index debts_user_id_idx on public.debts(user_id);

alter table public.debts enable row level security;
create policy "debts_all_own" on public.debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_debts_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

-- ============================================================
-- debt_payments: payments made against a debt
-- ============================================================
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index debt_payments_user_id_idx on public.debt_payments(user_id);
create index debt_payments_debt_id_idx on public.debt_payments(debt_id);

alter table public.debt_payments enable row level security;
create policy "debt_payments_all_own" on public.debt_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- credit_cards
-- ============================================================
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  issuer text,
  last_four text,
  credit_limit numeric(14,2) not null check (credit_limit >= 0),
  current_balance numeric(14,2) not null default 0,
  statement_day smallint check (statement_day between 1 and 31),
  payment_due_day smallint check (payment_due_day between 1 and 31),
  interest_rate numeric(6,3) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_cards_user_id_idx on public.credit_cards(user_id);

alter table public.credit_cards enable row level security;
create policy "credit_cards_all_own" on public.credit_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_credit_cards_updated_at
  before update on public.credit_cards
  for each row execute function public.set_updated_at();

-- ============================================================
-- credit_card_transactions
-- ============================================================
create table public.credit_card_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  amount numeric(14,2) not null,
  description text,
  transaction_type text not null default 'purchase' check (transaction_type in ('purchase', 'payment', 'fee', 'refund', 'interest')),
  occurred_at date not null default current_date,
  installments smallint default 1,
  created_at timestamptz not null default now()
);

create index credit_card_transactions_user_id_idx on public.credit_card_transactions(user_id);
create index credit_card_transactions_card_id_idx on public.credit_card_transactions(credit_card_id);

alter table public.credit_card_transactions enable row level security;
create policy "credit_card_transactions_all_own" on public.credit_card_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
