-- ============================================================
-- receivables: money owed TO the user by third parties
-- ============================================================
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debtor_name text not null,
  original_amount numeric(14,2) not null check (original_amount > 0),
  outstanding_amount numeric(14,2) not null check (outstanding_amount >= 0),
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'partially_paid', 'paid', 'written_off')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receivables_user_id_idx on public.receivables(user_id);

alter table public.receivables enable row level security;
drop policy if exists "receivables_all_own" on public.receivables;
create policy "receivables_all_own" on public.receivables
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_receivables_updated_at on public.receivables;
create trigger set_receivables_updated_at
  before update on public.receivables
  for each row execute function public.set_updated_at();

-- ============================================================
-- receivable_payments
-- ============================================================
create table if not exists public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists receivable_payments_user_id_idx on public.receivable_payments(user_id);
create index if not exists receivable_payments_receivable_id_idx on public.receivable_payments(receivable_id);

alter table public.receivable_payments enable row level security;
drop policy if exists "receivable_payments_all_own" on public.receivable_payments;
create policy "receivable_payments_all_own" on public.receivable_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- savings_goals
-- ============================================================
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0,
  target_date date,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists savings_goals_user_id_idx on public.savings_goals(user_id);

alter table public.savings_goals enable row level security;
drop policy if exists "savings_goals_all_own" on public.savings_goals;
create policy "savings_goals_all_own" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_savings_goals_updated_at on public.savings_goals;
create trigger set_savings_goals_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();

-- ============================================================
-- savings_contributions
-- ============================================================
create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  contributed_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists savings_contributions_user_id_idx on public.savings_contributions(user_id);
create index if not exists savings_contributions_goal_id_idx on public.savings_contributions(goal_id);

alter table public.savings_contributions enable row level security;
drop policy if exists "savings_contributions_all_own" on public.savings_contributions;
create policy "savings_contributions_all_own" on public.savings_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
