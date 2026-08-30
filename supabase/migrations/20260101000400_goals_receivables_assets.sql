-- Fase 5: metas de ahorro, aportes, cuentas por cobrar y activos no
-- bancarios (secc. 19-20, 29-31).

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null default 'otro' check (kind in
    ('fondo_emergencia', 'eliminar_deuda', 'viaje', 'vivienda', 'inversion',
     'retiro', 'mudanza', 'extranjero', 'otro')),
  target_amount numeric(14, 2) not null check (target_amount > 0),
  currency text not null default 'PEN',
  target_date date,
  monthly_contribution numeric(14, 2),
  priority text not null default 'media'
    check (priority in ('baja', 'media', 'alta', 'muy_alta')),
  status text not null default 'activa'
    check (status in ('activa', 'pausada', 'lograda', 'cancelada')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists savings_goals_user_id_idx on public.savings_goals (user_id);
drop trigger if exists set_savings_goals_updated_at on public.savings_goals;
create trigger set_savings_goals_updated_at
  before update on public.savings_goals
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('savings_goals');

-- El monto actual de una meta = Σ aportes (no se guarda por separado).
create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount <> 0), -- negativo = retiro
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists savings_contributions_user_id_idx
  on public.savings_contributions (user_id);
create index if not exists savings_contributions_goal_idx
  on public.savings_contributions (goal_id);
drop trigger if exists set_savings_contributions_updated_at on public.savings_contributions;
create trigger set_savings_contributions_updated_at
  before update on public.savings_contributions
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('savings_contributions');

-- ME DEBEN (secc. 31). El saldo = monto original − Σ cobros.
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  person text not null,
  original_amount numeric(14, 2) not null check (original_amount > 0),
  currency text not null default 'PEN',
  expected_date date,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'parcial', 'cobrado', 'incobrable')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists receivables_user_id_idx on public.receivables (user_id);
drop trigger if exists set_receivables_updated_at on public.receivables;
create trigger set_receivables_updated_at
  before update on public.receivables
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('receivables');

create table if not exists public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  receivable_id uuid not null references public.receivables (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists receivable_payments_user_id_idx
  on public.receivable_payments (user_id);
create index if not exists receivable_payments_receivable_idx
  on public.receivable_payments (receivable_id);
drop trigger if exists set_receivable_payments_updated_at on public.receivable_payments;
create trigger set_receivable_payments_updated_at
  before update on public.receivable_payments
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('receivable_payments');

-- Activos no bancarios (bienes, fondos, etc.). Las cuentas ya son activos;
-- esta tabla es para lo que no vive en una cuenta. is_verified=false marca
-- valores declarados sin comprobar (⚠️ NO VERIFICADO, secc. 30).
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null default 'otro' check (kind in
    ('inversion', 'fondo', 'bien', 'otro')),
  value numeric(14, 2) not null check (value >= 0),
  currency text not null default 'PEN',
  is_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists assets_user_id_idx on public.assets (user_id);
drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('assets');
