-- ============================================================
-- expense_categories: e.g. "Comida", "Transporte", "Servicios"
-- ============================================================
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.expense_categories enable row level security;
create policy "expense_categories_all_own" on public.expense_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_expense_categories_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();

-- ============================================================
-- expenses: individual expense entries
-- ============================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.expense_categories(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'PEN',
  description text,
  spent_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_user_id_idx on public.expenses(user_id);
create index expenses_spent_at_idx on public.expenses(spent_at);
create index expenses_category_id_idx on public.expenses(category_id);

alter table public.expenses enable row level security;
create policy "expenses_all_own" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ============================================================
-- recurring_expenses: templates that generate expenses periodically
-- ============================================================
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_expenses_user_id_idx on public.recurring_expenses(user_id);

alter table public.recurring_expenses enable row level security;
create policy "recurring_expenses_all_own" on public.recurring_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger set_recurring_expenses_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();
