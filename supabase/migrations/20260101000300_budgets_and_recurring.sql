-- Fase 3: presupuestos mensuales y gastos recurrentes (secc. 10-11).

create table if not exists public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  month smallint not null check (month between 1 and 12),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, year, month)
);
create index if not exists monthly_budgets_user_id_idx on public.monthly_budgets (user_id);
drop trigger if exists set_monthly_budgets_updated_at on public.monthly_budgets;
create trigger set_monthly_budgets_updated_at
  before update on public.monthly_budgets
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('monthly_budgets');

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_id uuid not null references public.monthly_budgets (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id) on delete cascade,
  planned_amount numeric(14, 2) not null default 0 check (planned_amount >= 0),
  -- Presupuesto protegido: lo no gastado de esta categoría se descuenta del
  -- "puedes gastar" (gasto esencial que aún va a llegar en el mes).
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category_id)
);
create index if not exists budget_categories_user_id_idx on public.budget_categories (user_id);
create index if not exists budget_categories_budget_idx on public.budget_categories (budget_id);
drop trigger if exists set_budget_categories_updated_at on public.budget_categories;
create trigger set_budget_categories_updated_at
  before update on public.budget_categories
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('budget_categories');

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'PEN',
  category_id uuid references public.expense_categories (id) on delete set null,
  -- Día de cobro; null = fecha de cobro desconocida (se muestra "por
  -- confirmar" en lugar de inventar una).
  due_day smallint check (due_day between 1 and 31),
  is_active boolean not null default true,
  needs_verification boolean not null default false,  -- ej. cargo no reconocido
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists recurring_expenses_user_id_idx on public.recurring_expenses (user_id);
drop trigger if exists set_recurring_expenses_updated_at on public.recurring_expenses;
create trigger set_recurring_expenses_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('recurring_expenses');
