-- Fase 1: núcleo financiero — cuentas, fuentes de ingreso, ingresos,
-- ingresos extraordinarios (con asignación previa de destino), categorías,
-- gastos y transferencias. Ver docs/ARQUITECTURA.md sección 4.

-- ---------------------------------------------------------------------------
-- Helper: aplica las 4 políticas RLS estándar "solo el dueño" a una tabla.
-- ---------------------------------------------------------------------------
create or replace function public.apply_owner_policies(tbl text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('drop policy if exists "%s_select_own" on public.%I', tbl, tbl);
  execute format(
    'create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id)',
    tbl, tbl);
  execute format('drop policy if exists "%s_insert_own" on public.%I', tbl, tbl);
  execute format(
    'create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id)',
    tbl, tbl);
  execute format('drop policy if exists "%s_update_own" on public.%I', tbl, tbl);
  execute format(
    'create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
    tbl, tbl);
  execute format('drop policy if exists "%s_delete_own" on public.%I', tbl, tbl);
  execute format(
    'create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id)',
    tbl, tbl);
end;
$$;

-- ---------------------------------------------------------------------------
-- accounts: dónde vive el dinero. El saldo actual NO se guarda: se calcula
-- como initial_balance + movimientos realizados (fuente de verdad única).
-- is_verified=false marca activos declarados pero no comprobados (p. ej.
-- trading): nunca cuentan como dinero disponible (secc. 30).
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in
    ('bancaria', 'ahorro', 'sueldo', 'efectivo', 'yape', 'plin', 'inversion')),
  institution text,
  currency text not null default 'PEN',
  initial_balance numeric(14, 2) not null default 0,
  is_verified boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists accounts_user_id_idx on public.accounts (user_id);
drop trigger if exists set_accounts_updated_at on public.accounts;
create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('accounts');

-- ---------------------------------------------------------------------------
-- income_sources: de dónde llega dinero (sueldo, aporte familiar, trabajos
-- parciales, trading…), con confiabilidad y verificación (secc. 3).
-- ---------------------------------------------------------------------------
create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('fijo', 'variable', 'extraordinario')),
  recurrence text not null default 'mensual'
    check (recurrence in ('mensual', 'quincenal', 'semanal', 'eventual')),
  expected_amount numeric(14, 2),
  currency text not null default 'PEN',
  reliability text not null default 'media'
    check (reliability in ('alta', 'media', 'baja')),
  is_verified boolean not null default false,
  expected_day smallint check (expected_day between 1 and 31),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists income_sources_user_id_idx on public.income_sources (user_id);
drop trigger if exists set_income_sources_updated_at on public.income_sources;
create trigger set_income_sources_updated_at
  before update on public.income_sources
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('income_sources');

-- ---------------------------------------------------------------------------
-- income_transactions: ingresos concretos. El status implementa la regla
-- central de la secc. 3: solo 'realizado' suma al dinero disponible.
-- ---------------------------------------------------------------------------
create table if not exists public.income_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid references public.income_sources (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'PEN',
  date date not null default current_date,
  status text not null default 'realizado' check (status in
    ('realizado', 'esperado', 'estimado', 'pendiente', 'no_verificado')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists income_transactions_user_id_idx on public.income_transactions (user_id);
create index if not exists income_transactions_date_idx on public.income_transactions (date desc);
drop trigger if exists set_income_transactions_updated_at on public.income_transactions;
create trigger set_income_transactions_updated_at
  before update on public.income_transactions
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('income_transactions');

-- ---------------------------------------------------------------------------
-- extraordinary_incomes + asignaciones: CTS, gratificación, cobros
-- puntuales. Se les asigna destino ANTES de recibirse (secc. 4) y jamás
-- cuentan como dinero libre mientras status = 'esperado'.
-- ---------------------------------------------------------------------------
create table if not exists public.extraordinary_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  expected_amount numeric(14, 2) not null check (expected_amount > 0),
  currency text not null default 'PEN',
  expected_date date,
  status text not null default 'esperado'
    check (status in ('esperado', 'recibido', 'cancelado')),
  received_amount numeric(14, 2),
  received_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists extraordinary_incomes_user_id_idx
  on public.extraordinary_incomes (user_id);
drop trigger if exists set_extraordinary_incomes_updated_at on public.extraordinary_incomes;
create trigger set_extraordinary_incomes_updated_at
  before update on public.extraordinary_incomes
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('extraordinary_incomes');

create table if not exists public.extraordinary_income_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  extraordinary_income_id uuid not null
    references public.extraordinary_incomes (id) on delete cascade,
  -- target_type + target_id apuntan de forma laxa al destino (deuda, meta,
  -- cuenta); las tablas de deudas/metas llegan en fases 2 y 5.
  target_type text not null check (target_type in ('deuda', 'meta', 'cuenta', 'libre')),
  target_id uuid,
  percent numeric(5, 2) not null check (percent > 0 and percent <= 100),
  created_at timestamptz not null default now()
);
create index if not exists extraordinary_income_allocations_user_id_idx
  on public.extraordinary_income_allocations (user_id);
create index if not exists extraordinary_income_allocations_income_idx
  on public.extraordinary_income_allocations (extraordinary_income_id);
select public.apply_owner_policies('extraordinary_income_allocations');

-- ---------------------------------------------------------------------------
-- Categorías y subcategorías de gasto, editables por usuario (secc. 9).
-- Las categorías por defecto se crean por trigger al crear el perfil:
-- mecanismo genérico para cualquier usuario, sin hardcodeo por persona.
-- ---------------------------------------------------------------------------
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, name)
);
create index if not exists expense_categories_user_id_idx on public.expense_categories (user_id);
drop trigger if exists set_expense_categories_updated_at on public.expense_categories;
create trigger set_expense_categories_updated_at
  before update on public.expense_categories
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('expense_categories');

create table if not exists public.expense_subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);
create index if not exists expense_subcategories_user_id_idx
  on public.expense_subcategories (user_id);
create index if not exists expense_subcategories_category_idx
  on public.expense_subcategories (category_id);
select public.apply_owner_policies('expense_subcategories');

create or replace function public.create_default_categories()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cat record;
  cat_id uuid;
begin
  for cat in
    select * from (values
      ('Alimentación', '🍽️', 1, array['supermercado','restaurante','delivery','almuerzo laboral','snacks']),
      ('Transporte', '🚌', 2, array['taxi','Uber','Didi','colectivo','bus','combustible']),
      ('Mascotas', '🐱', 3, array['comida','veterinaria','accesorios']),
      ('Vivienda', '🏠', 4, array['internet','gas','luz','agua','mantenimiento']),
      ('Ocio', '🎉', 5, array['salidas','cine','conciertos']),
      ('Ropa', '👗', 6, array[]::text[]),
      ('Limpieza', '🧼', 7, array[]::text[]),
      ('Salud', '🩺', 8, array['medicinas','consultas']),
      ('Maquillaje', '💄', 9, array[]::text[]),
      ('Suscripciones', '📺', 10, array['streaming','apps','IA']),
      ('Educación', '📚', 11, array['cursos','libros']),
      ('Viajes', '✈️', 12, array[]::text[]),
      ('Compras', '🛍️', 13, array[]::text[]),
      ('Deudas', '💳', 14, array[]::text[]),
      ('Ahorro', '💰', 15, array[]::text[]),
      ('Otros', '📦', 16, array[]::text[])
    ) as t(name, icon, sort_order, subs)
  loop
    insert into public.expense_categories (user_id, name, icon, sort_order)
    values (new.user_id, cat.name, cat.icon, cat.sort_order)
    on conflict (user_id, name) do nothing
    returning id into cat_id;
    if cat_id is not null then
      insert into public.expense_subcategories (user_id, category_id, name)
      select new.user_id, cat_id, unnest(cat.subs)
      on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_profile_created_seed_categories on public.profiles;
create trigger on_profile_created_seed_categories
  after insert on public.profiles
  for each row execute function public.create_default_categories();

-- ---------------------------------------------------------------------------
-- expenses: gastos con toda la metadata de la secc. 8. credit_card_id se
-- agrega en la Fase 2 (alter table) cuando exista la tabla de tarjetas.
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.expense_categories (id) on delete set null,
  subcategory_id uuid references public.expense_subcategories (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'PEN',
  date date not null default current_date,
  payment_method text not null default 'efectivo' check (payment_method in
    ('efectivo', 'yape', 'plin', 'transferencia', 'debito', 'credito', 'credito_cuotas')),
  merchant text,
  description text,
  tags text[] not null default '{}',
  is_recurring boolean not null default false,
  necessity text not null default 'necesario' check (necessity in ('necesario', 'deseo')),
  is_emotional boolean not null default false,
  status text not null default 'confirmado'
    check (status in ('confirmado', 'pendiente', 'anulado')),
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_date_idx on public.expenses (date desc);
create index if not exists expenses_category_idx on public.expenses (category_id);
drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('expenses');

-- ---------------------------------------------------------------------------
-- transfers: movimiento entre cuentas propias. Nunca cuenta como ingreso ni
-- gasto (regla probada en tests): solo mueve saldo de una cuenta a otra.
-- ---------------------------------------------------------------------------
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id uuid not null references public.accounts (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'PEN',
  date date not null default current_date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_account_id <> to_account_id)
);
create index if not exists transfers_user_id_idx on public.transfers (user_id);
create index if not exists transfers_date_idx on public.transfers (date desc);
drop trigger if exists set_transfers_updated_at on public.transfers;
create trigger set_transfers_updated_at
  before update on public.transfers
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('transfers');

-- Prioridad financiera declarada en el onboarding (secc. 41, paso 9).
alter table public.profiles add column if not exists financial_priority text;
