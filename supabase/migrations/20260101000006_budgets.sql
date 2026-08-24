-- ============================================================
-- monthly_budgets: one row per user per calendar month
-- ============================================================
create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_month date not null, -- always stored as the 1st day of the month
  planned_income numeric(14,2) not null default 0,
  planned_expenses numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_month)
);

create index if not exists monthly_budgets_user_id_idx on public.monthly_budgets(user_id);

alter table public.monthly_budgets enable row level security;
drop policy if exists "monthly_budgets_all_own" on public.monthly_budgets;
create policy "monthly_budgets_all_own" on public.monthly_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_monthly_budgets_updated_at on public.monthly_budgets;
create trigger set_monthly_budgets_updated_at
  before update on public.monthly_budgets
  for each row execute function public.set_updated_at();

-- ============================================================
-- budget_categories: planned amount per expense_category within a budget
-- ============================================================
create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references public.monthly_budgets(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  planned_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists budget_categories_user_id_idx on public.budget_categories(user_id);
create index if not exists budget_categories_budget_id_idx on public.budget_categories(budget_id);

alter table public.budget_categories enable row level security;
drop policy if exists "budget_categories_all_own" on public.budget_categories;
create policy "budget_categories_all_own" on public.budget_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_budget_categories_updated_at on public.budget_categories;
create trigger set_budget_categories_updated_at
  before update on public.budget_categories
  for each row execute function public.set_updated_at();
