-- ===========================================================================
--  MI FINANZAS · INSTALACIÓN COMPLETA DE LA BASE DE DATOS
-- ===========================================================================
--
--  Pega TODO este archivo en el SQL Editor de Supabase y ejecútalo una vez.
--
--  Es seguro correrlo aunque ya hayas ejecutado algunas migraciones antes:
--  cada tabla usa "create table if not exists" y cada función
--  "create or replace", así que no duplica ni borra nada. Si una tabla ya
--  existe, simplemente se salta.
--
--  Contiene las 8 migraciones en el orden correcto:
--    1. Extensiones, perfiles y auditoría
--    2. Núcleo financiero (cuentas, ingresos, gastos, categorías)
--    3. Deudas y tarjetas
--    4. Presupuestos y gastos recurrentes
--    5. Metas, cuentas por cobrar y activos
--    6. Motor de reglas, alertas y planes
--    7. Estados de verificación
--    8. Registro de usuario a prueba de fallos
--
--  Al terminar deberías poder crear tu cuenta en la aplicación.
-- ===========================================================================


-- ===========================================================================
-- 20260101000000_extensions_profiles_audit.sql
-- ===========================================================================
-- Fase 0: extensiones, perfiles, auditoría y convenciones base (RLS,
-- updated_at). Ver docs/ARQUITECTURA.md sección 4.

create extension if not exists "pgcrypto";

-- Función reutilizada por todas las migraciones futuras para mantener
-- updated_at al día en cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles: extensión 1:1 de auth.users con datos no sensibles para
-- autenticación (nombre, moneda base, empleador, fecha de ingreso).
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  base_currency text not null default 'PEN',
  birth_date date,
  employer text,
  employment_start_date date,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

-- Crea el perfil automáticamente cuando se registra un usuario nuevo,
-- para que el resto de la app pueda asumir que profiles siempre existe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- audit_logs: registro genérico de cambios importantes (secc. 39).
-- entity_type/entity_id referencian de forma laxa cualquier tabla
-- futura (deudas, presupuestos, metas, reglas, movimientos, etc.) sin
-- acoplar esta tabla a un esquema que aún no existe.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check (auth.uid() = user_id);

-- audit_logs es un historial: nunca se actualiza ni se borra desde el
-- cliente (sin policy de update/delete => denegado por defecto con RLS).


-- ===========================================================================
-- 20260101000100_core_finance.sql
-- ===========================================================================
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


-- ===========================================================================
-- 20260101000200_debts_and_cards.sql
-- ===========================================================================
-- Fase 2: deudas, pagos de deuda y tarjetas de crédito (secc. 5-7).
--
-- Decisiones de modelado (docs/ARQUITECTURA.md):
-- - El saldo actual de una deuda NO se guarda: se calcula como
--   initial_balance − Σ pagos a capital. Cada pago guarda su desglose real
--   (capital / interés / seguro / comisiones / mora).
-- - La "credit_card_transactions" del prompt se materializa como
--   expenses.credit_card_id: una compra con tarjeta ES un gasto; duplicarla
--   en otra tabla crearía dobles registros.
-- - La utilización de una tarjeta = saldo de las deudas vinculadas a ella
--   (debts.credit_card_id), así pagar la deuda baja la utilización sin
--   mantener dos números que puedan divergir.

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  issuer text,
  credit_line numeric(14, 2) not null check (credit_line >= 0),
  cash_line numeric(14, 2) not null default 0,
  currency text not null default 'PEN',
  tea_purchases numeric(7, 4),          -- % anual, ej. 87.50
  tea_cash numeric(7, 4),
  tea_usd numeric(7, 4),
  membership_fee numeric(14, 2) not null default 0,
  insurance_monthly numeric(14, 2) not null default 0,
  closing_day smallint check (closing_day between 1 and 31),
  payment_day smallint check (payment_day between 1 and 31),
  benefits text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists credit_cards_user_id_idx on public.credit_cards (user_id);
drop trigger if exists set_credit_cards_updated_at on public.credit_cards;
create trigger set_credit_cards_updated_at
  before update on public.credit_cards
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('credit_cards');

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  creditor text not null,
  name text,
  type text not null default 'otro' check (type in
    ('revolvente', 'cuotas', 'prestamo_personal', 'sin_intereses', 'otro')),
  credit_card_id uuid references public.credit_cards (id) on delete set null,
  initial_balance numeric(14, 2) not null check (initial_balance >= 0),
  currency text not null default 'PEN',
  -- Tasas: TEA para revolventes, TCEA para préstamos en cuotas; 0 = sin
  -- intereses (p. ej. préstamo familiar).
  tea numeric(7, 4),
  tcea numeric(7, 4),
  rate_type text not null default 'tea' check (rate_type in ('tea', 'tcea', 'sin_interes')),
  installment_amount numeric(14, 2),
  minimum_payment numeric(14, 2),
  num_installments smallint,
  installments_paid smallint not null default 0,
  insurance_monthly numeric(14, 2) not null default 0,
  fees_monthly numeric(14, 2) not null default 0,
  due_day smallint check (due_day between 1 and 31),
  target_payoff_date date,               -- restricción temporal (ej. Rody nov-2026)
  priority text not null default 'media'
    check (priority in ('baja', 'media', 'alta', 'muy_alta')),
  status text not null default 'activa'
    check (status in ('activa', 'pagada', 'en_mora', 'congelada', 'no_activada')),
  -- Pago anticipado (reduce intereses) vs. adelanto de cuotas: hay que
  -- preguntar al acreedor; el estado inicial honesto es 'desconocido'.
  allows_early_payoff text not null default 'desconocido'
    check (allows_early_payoff in ('si', 'no', 'desconocido')),
  payment_strategy text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists debts_user_id_idx on public.debts (user_id);
create index if not exists debts_card_idx on public.debts (credit_card_id);
drop trigger if exists set_debts_updated_at on public.debts;
create trigger set_debts_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('debts');

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  principal_amount numeric(14, 2) not null default 0 check (principal_amount >= 0),
  interest_amount numeric(14, 2) not null default 0 check (interest_amount >= 0),
  insurance_amount numeric(14, 2) not null default 0 check (insurance_amount >= 0),
  fees_amount numeric(14, 2) not null default 0 check (fees_amount >= 0),
  penalty_amount numeric(14, 2) not null default 0 check (penalty_amount >= 0),
  is_extra_payment boolean not null default false,  -- amortización voluntaria
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (principal_amount + interest_amount + insurance_amount
         + fees_amount + penalty_amount <= amount + 0.01)
);
create index if not exists debt_payments_user_id_idx on public.debt_payments (user_id);
create index if not exists debt_payments_debt_idx on public.debt_payments (debt_id);
create index if not exists debt_payments_date_idx on public.debt_payments (date desc);
drop trigger if exists set_debt_payments_updated_at on public.debt_payments;
create trigger set_debt_payments_updated_at
  before update on public.debt_payments
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('debt_payments');

-- Una compra con tarjeta es un gasto: se enlaza aquí en lugar de duplicarse
-- en otra tabla de transacciones.
alter table public.expenses
  add column if not exists credit_card_id uuid
    references public.credit_cards (id) on delete set null;
create index if not exists expenses_card_idx on public.expenses (credit_card_id);


-- ===========================================================================
-- 20260101000300_budgets_and_recurring.sql
-- ===========================================================================
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


-- ===========================================================================
-- 20260101000400_goals_receivables_assets.sql
-- ===========================================================================
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


-- ===========================================================================
-- 20260101000500_intelligence.sql
-- ===========================================================================
-- Fase 6: capa de inteligencia — reglas, alertas, planes SI→ENTONCES,
-- ajustes aprendidos y bitácora de eventos (secc. 15-16, 22-25, 45, 48).
--
-- Principio: NINGUNA regla financiera vive en TypeScript. Cada regla del
-- prompt (TEA > 20 %, utilización > 30 %, saldo < pagos próximos…) es una
-- FILA en financial_rules con condition_type + params en jsonb. El motor
-- solo sabe evaluar tipos de condición genéricos contra un snapshot.

create table if not exists public.financial_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  condition_type text not null,
  condition_params jsonb not null default '{}'::jsonb,
  severity text not null default 'info'
    check (severity in ('info', 'atencion', 'riesgo', 'critico')),
  message_template text not null,
  -- Reglas del sistema (sembradas) vs. reglas personales de la usuaria
  -- (secc. 24). Ambas se pueden activar/desactivar y editar.
  is_system boolean not null default false,
  -- Reglas declarativas sin condición evaluable ("nunca pagar una línea de
  -- crédito con otra"): se muestran como recordatorio, no generan alerta.
  is_manual boolean not null default false,
  enabled boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists financial_rules_user_id_idx on public.financial_rules (user_id);
drop trigger if exists set_financial_rules_updated_at on public.financial_rules;
create trigger set_financial_rules_updated_at
  before update on public.financial_rules
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('financial_rules');

-- Alertas generadas por el motor. Se persisten para poder marcarlas como
-- leídas/descartadas y para que las notificaciones tengan historial.
create table if not exists public.financial_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_id uuid references public.financial_rules (id) on delete set null,
  severity text not null check (severity in ('info', 'atencion', 'riesgo', 'critico')),
  title text not null,
  message text not null,
  -- Clave estable de deduplicación: misma regla + mismo sujeto no se
  -- vuelve a insertar mientras siga vigente.
  dedupe_key text not null,
  entity_type text,
  entity_id uuid,
  status text not null default 'nueva'
    check (status in ('nueva', 'vista', 'descartada', 'resuelta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists financial_alerts_user_id_idx on public.financial_alerts (user_id);
create index if not exists financial_alerts_status_idx on public.financial_alerts (status);
drop trigger if exists set_financial_alerts_updated_at on public.financial_alerts;
create trigger set_financial_alerts_updated_at
  before update on public.financial_alerts
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('financial_alerts');

-- Planes conductuales SI X → ENTONCES Y (secc. 25).
create table if not exists public.if_then_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger_text text not null,          -- "SI recibo dinero extraordinario"
  steps text[] not null default '{}',  -- pasos ordenados del "ENTONCES"
  enabled boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists if_then_plans_user_id_idx on public.if_then_plans (user_id);
drop trigger if exists set_if_then_plans_updated_at on public.if_then_plans;
create trigger set_if_then_plans_updated_at
  before update on public.if_then_plans
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('if_then_plans');

-- Motor de aprendizaje (secc. 45): sugerencias de ajuste que SIEMPRE
-- requieren confirmación; nunca se aplican solas sobre el presupuesto.
create table if not exists public.learning_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.expense_categories (id) on delete cascade,
  kind text not null default 'presupuesto'
    check (kind in ('presupuesto', 'recurrente', 'meta')),
  observation text not null,
  current_value numeric(14, 2),
  suggested_value numeric(14, 2),
  months_observed smallint not null default 0,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aceptada', 'descartada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_adjustments_user_id_idx on public.learning_adjustments (user_id);
drop trigger if exists set_learning_adjustments_updated_at on public.learning_adjustments;
create trigger set_learning_adjustments_updated_at
  before update on public.learning_adjustments
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('learning_adjustments');

-- Bitácora de hechos financieros relevantes (secc. 22): sirve de insumo
-- para detección de patrones y para el historial de notificaciones.
create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  description text not null,
  amount numeric(14, 2),
  entity_type text,
  entity_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists financial_events_user_id_idx on public.financial_events (user_id);
create index if not exists financial_events_occurred_idx on public.financial_events (occurred_at desc);
select public.apply_owner_policies('financial_events');

-- ---------------------------------------------------------------------------
-- Reglas base del sistema, sembradas para CADA usuario al crear su perfil
-- (mecanismo genérico, sin condicionales por persona).
-- ---------------------------------------------------------------------------
create or replace function public.create_default_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.financial_rules
    (user_id, name, description, condition_type, condition_params, severity,
     message_template, is_system, is_manual, sort_order)
  values
    (new.user_id, 'Deuda cara', 'Una deuda con tasa alta debe atacarse primero.',
     'debt_rate_above', '{"threshold": 20}'::jsonb, 'riesgo',
     'Tu deuda {name} tiene una tasa de {rate} % anual: es la más cara que tienes.',
     true, false, 1),
    (new.user_id, 'Utilización de tarjeta alta',
     'Usar más del 30 % de la línea presiona tu perfil crediticio.',
     'card_utilization_above', '{"threshold": 0.3}'::jsonb, 'riesgo',
     'La utilización de {name} está en {utilization} %. Pagando {payment} bajaría a 30 %.',
     true, false, 2),
    (new.user_id, 'Presupuesto excedido',
     'Cuando una categoría supera lo planificado.',
     'budget_category_exceeded', '{}'::jsonb, 'atencion',
     'Gastaste {spent} en {name}: {over} por encima de tu presupuesto.',
     true, false, 3),
    (new.user_id, 'Proyección por encima del presupuesto',
     'El ritmo actual llevaría a exceder la categoría al cierre del mes.',
     'budget_category_projected_over', '{}'::jsonb, 'atencion',
     'Vas camino a gastar {projected} en {name}, por encima de tus {planned}.',
     true, false, 4),
    (new.user_id, 'Saldo insuficiente para pagos próximos',
     'El dinero disponible no cubre las obligaciones que vienen.',
     'balance_below_upcoming', '{"horizon_days": 15}'::jsonb, 'critico',
     'Tu dinero disponible ({available}) no cubre tus pagos próximos ({upcoming}).',
     true, false, 5),
    (new.user_id, 'Ingreso extraordinario sin asignar',
     'Todo ingreso extraordinario se asigna antes de gastarse.',
     'extraordinary_unallocated', '{}'::jsonb, 'atencion',
     'Tienes {name} ({amount}) sin destino asignado. Decide su uso antes de recibirlo.',
     true, false, 6),
    (new.user_id, 'Gasto muy por encima del promedio',
     'Detecta desviaciones significativas frente a tu historial.',
     'category_spike', '{"threshold_pct": 30, "min_months": 2}'::jsonb, 'atencion',
     'Tu gasto en {name} subió {change} % respecto a tu promedio.',
     true, false, 7),
    (new.user_id, 'Nueva deuda con deuda cara vigente',
     'No conviene endeudarse más mientras exista deuda de tasa alta.',
     'new_debt_while_expensive', '{"threshold": 20}'::jsonb, 'riesgo',
     'Ya tienes deuda cara ({name}, {rate} %): evita tomar deuda nueva.',
     true, false, 8),
    -- Reglas personales declarativas (secc. 24): recordatorios, no alertas.
    (new.user_id, 'Nunca pagar una línea de crédito con otra', null,
     'manual', '{}'::jsonb, 'info', 'Nunca pagar una línea de crédito con otra.', true, true, 20),
    (new.user_id, 'PASE CUOTAS bloqueado', null,
     'manual', '{}'::jsonb, 'info', 'PASE CUOTAS bloqueado.', true, true, 21),
    (new.user_id, 'Los ingresos extraordinarios se asignan antes de gastarse', null,
     'manual', '{}'::jsonb, 'info',
     'Los ingresos extraordinarios se asignan antes de gastarse.', true, true, 22),
    (new.user_id, 'Tarjetas fuera de apps de transporte, delivery y pagos móviles', null,
     'manual', '{}'::jsonb, 'info',
     'Tarjetas fuera de DIDI, Uber, delivery y Apple Pay.', true, true, 23),
    (new.user_id, 'Un solo pago programado al mes por tarjeta', null,
     'manual', '{}'::jsonb, 'info', 'Un solo pago programado al mes por tarjeta.', true, true, 24),
    (new.user_id, 'Línea liberada no significa dinero disponible', null,
     'manual', '{}'::jsonb, 'info',
     'Línea liberada no significa dinero disponible.', true, true, 25),
    (new.user_id, 'Sin inversiones nuevas mientras exista deuda sobre 20 % TEA', null,
     'manual', '{}'::jsonb, 'info',
     'No realizar nuevas inversiones mientras exista deuda superior al 20 % TEA.', true, true, 26),
    (new.user_id, 'Trabajar con ciclos financieros de 30 días', null,
     'manual', '{}'::jsonb, 'info', 'Trabajar con ciclos financieros de 30 días.', true, true, 27),
    (new.user_id, 'Registrar patrones de gasto que generen problemas', null,
     'manual', '{}'::jsonb, 'info',
     'Registrar patrones de gasto que generen problemas.', true, true, 28),
    (new.user_id, 'Crear planes SI X → ENTONCES Y', null,
     'manual', '{}'::jsonb, 'info', 'Crear planes "SI X → ENTONCES Y".', true, true, 29);

  insert into public.if_then_plans (user_id, trigger_text, steps, sort_order)
  values
    (new.user_id, 'SI recibo dinero extraordinario',
     array['Registrar el ingreso', 'Separar obligaciones', 'Asignar a deuda',
           'Separar ahorro', 'Recién entonces calcular dinero libre'], 1),
    (new.user_id, 'SI estoy a punto de comprar algo no presupuestado',
     array['Esperar 24 horas', 'Volver a evaluar la compra'], 2),
    (new.user_id, 'SI estoy triste y quiero gastar',
     array['Registrar la compra como gasto emocional',
           'Ver su impacto mensual antes de confirmar'], 3);

  return new;
end;
$$;

drop trigger if exists on_profile_created_seed_rules on public.profiles;
create trigger on_profile_created_seed_rules
  after insert on public.profiles
  for each row execute function public.create_default_rules();


-- ===========================================================================
-- 20260101000600_verification_states.sql
-- ===========================================================================
-- Ajustes para representar el ESTADO DE VERIFICACIÓN de cada dato.
--
-- Principio: la plataforma nunca debe hacer pasar una estimación por dinero
-- real. Estas cuatro columnas permiten distinguir, en la propia base de
-- datos, lo confirmado de lo estimado, lo pendiente y lo no verificado.

-- ---------------------------------------------------------------------------
-- 1. El saldo de una cuenta puede ser DESCONOCIDO.
--    Antes: not null default 0 → "no sé cuánto tengo" se veía igual que
--    "tengo cero". Ahora null = sin información, 0 = cero real.
-- ---------------------------------------------------------------------------
alter table public.accounts alter column initial_balance drop not null;
alter table public.accounts alter column initial_balance drop default;
comment on column public.accounts.initial_balance is
  'null = saldo desconocido (mostrar "pendiente de actualizar"); 0 = cero real.';

-- ---------------------------------------------------------------------------
-- 2. Estado de verificación de las fuentes de ingreso y de los activos.
-- ---------------------------------------------------------------------------
alter table public.income_sources
  add column if not exists verification_status text not null default 'confirmado'
    check (verification_status in ('confirmado', 'estimado', 'pendiente', 'no_verificado'));

alter table public.income_sources
  add column if not exists verification_note text;

alter table public.assets
  add column if not exists verification_status text not null default 'confirmado'
    check (verification_status in ('confirmado', 'estimado', 'pendiente', 'no_verificado'));

alter table public.extraordinary_incomes
  add column if not exists verification_status text not null default 'estimado'
    check (verification_status in ('confirmado', 'estimado', 'pendiente', 'no_verificado'));

-- ---------------------------------------------------------------------------
-- 3. Metas vinculadas a una deuda: el progreso se deriva del saldo real de
--    la deuda, no de aportes manuales. Al pagar la deuda, la meta avanza.
-- ---------------------------------------------------------------------------
alter table public.savings_goals
  add column if not exists debt_id uuid references public.debts (id) on delete set null;
create index if not exists savings_goals_debt_idx on public.savings_goals (debt_id);

-- ---------------------------------------------------------------------------
-- 4. Datos laborales y personales del perfil.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists age smallint;
alter table public.profiles add column if not exists employment_regime text;
alter table public.profiles add column if not exists pension_fund text;
alter table public.profiles add column if not exists health_insurance text;
alter table public.profiles add column if not exists health_insurance_cost numeric(14, 2);
alter table public.profiles add column if not exists housing text;
alter table public.profiles add column if not exists dependents text;
alter table public.profiles add column if not exists education text;

-- ---------------------------------------------------------------------------
-- 5. Pendientes por verificar: cargos no identificados, documentos que
--    faltan, preguntas abiertas. No son deuda ni gasto hasta confirmarse.
-- ---------------------------------------------------------------------------
create table if not exists public.pending_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  detail text,
  amount numeric(14, 2),
  priority text not null default 'operativo'
    check (priority in ('critico', 'operativo')),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'resuelto', 'descartado')),
  resolved_at timestamptz,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists pending_verifications_user_id_idx
  on public.pending_verifications (user_id);
drop trigger if exists set_pending_verifications_updated_at on public.pending_verifications;
create trigger set_pending_verifications_updated_at
  before update on public.pending_verifications
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('pending_verifications');

-- ---------------------------------------------------------------------------
-- 6. Rangos históricos de gasto variable: referencia, no movimientos.
--    Permite mostrar "restaurantes: S/ 30 – 771" sin inventar gastos.
-- ---------------------------------------------------------------------------
create table if not exists public.spending_ranges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.expense_categories (id) on delete set null,
  label text not null,
  min_amount numeric(14, 2) not null check (min_amount >= 0),
  max_amount numeric(14, 2) not null check (max_amount >= 0),
  period_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (max_amount >= min_amount)
);
create index if not exists spending_ranges_user_id_idx on public.spending_ranges (user_id);
drop trigger if exists set_spending_ranges_updated_at on public.spending_ranges;
create trigger set_spending_ranges_updated_at
  before update on public.spending_ranges
  for each row execute function public.set_updated_at();
select public.apply_owner_policies('spending_ranges');

-- ---------------------------------------------------------------------------
-- 7. Campos extra de tarjetas presentes en el perfil.
-- ---------------------------------------------------------------------------
alter table public.credit_cards add column if not exists tea_cash_advance numeric(7, 4);
alter table public.credit_cards add column if not exists membership_charge_date date;


-- ===========================================================================
-- 20260101000700_robust_signup.sql
-- ===========================================================================
-- El registro de usuario nunca debe fallar por los datos de cortesía.
--
-- Al registrarse se disparan tres funciones en cadena: crear el perfil,
-- sembrar las categorías por defecto y sembrar las reglas. Si CUALQUIERA
-- lanza una excepción, Postgres aborta toda la transacción y Supabase
-- devuelve "Database error saving new user": la persona se queda sin
-- cuenta por no haber podido crearle una categoría.
--
-- Las categorías y las reglas son una comodidad; la cuenta es lo esencial.
-- Aquí se invierte esa prioridad: los seeds se envuelven en un manejador
-- de excepciones, de modo que si fallan se registra un aviso y el usuario
-- queda creado igual. Siempre podrá crear sus categorías a mano.

-- ---------------------------------------------------------------------------
-- 1. Crear el perfil: si algo sale mal, el usuario se crea igualmente.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    insert into public.profiles (user_id) values (new.id)
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'No se pudo crear el perfil de %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Categorías por defecto.
--    Corrige además un error sutil: `returning ... into` no modifica la
--    variable cuando el INSERT no inserta nada (por conflicto), así que
--    cat_id conservaba el id de la categoría ANTERIOR y las subcategorías
--    terminaban colgadas de la categoría equivocada. Ahora se limpia en
--    cada vuelta y se resuelve por consulta si hubo conflicto.
-- ---------------------------------------------------------------------------
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
    begin
      cat_id := null;  -- imprescindible: si no, arrastra el id anterior

      insert into public.expense_categories (user_id, name, icon, sort_order)
      values (new.user_id, cat.name, cat.icon, cat.sort_order::smallint)
      on conflict (user_id, name) do nothing
      returning id into cat_id;

      -- Si ya existía, recuperamos su id en lugar de saltar las subcategorías.
      if cat_id is null then
        select id into cat_id from public.expense_categories
        where user_id = new.user_id and name = cat.name;
      end if;

      if cat_id is not null and array_length(cat.subs, 1) > 0 then
        insert into public.expense_subcategories (user_id, category_id, name)
        select new.user_id, cat_id, unnest(cat.subs)
        on conflict (category_id, name) do nothing;
      end if;
    exception when others then
      raise warning 'No se pudo sembrar la categoría % para %: %', cat.name, new.user_id, sqlerrm;
    end;
  end loop;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Reglas y planes por defecto, con el mismo blindaje.
-- ---------------------------------------------------------------------------
create or replace function public.create_default_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  begin
    insert into public.financial_rules
      (user_id, name, description, condition_type, condition_params, severity,
       message_template, is_system, is_manual, sort_order)
    values
      (new.user_id, 'Deuda cara', 'Una deuda con tasa alta debe atacarse primero.',
       'debt_rate_above', '{"threshold": 20}'::jsonb, 'riesgo',
       'Tu deuda {name} tiene una tasa de {rate} % anual: es la más cara que tienes.',
       true, false, 1),
      (new.user_id, 'Utilización de tarjeta alta',
       'Usar más del 30 % de la línea presiona tu perfil crediticio.',
       'card_utilization_above', '{"threshold": 0.3}'::jsonb, 'riesgo',
       'La utilización de {name} está en {utilization} %. Pagando {payment} bajaría a 30 %.',
       true, false, 2),
      (new.user_id, 'Presupuesto excedido',
       'Cuando una categoría supera lo planificado.',
       'budget_category_exceeded', '{}'::jsonb, 'atencion',
       'Gastaste {spent} en {name}: {over} por encima de tu presupuesto.',
       true, false, 3),
      (new.user_id, 'Proyección por encima del presupuesto',
       'El ritmo actual llevaría a exceder la categoría al cierre del mes.',
       'budget_category_projected_over', '{}'::jsonb, 'atencion',
       'Vas camino a gastar {projected} en {name}, por encima de tus {planned}.',
       true, false, 4),
      (new.user_id, 'Saldo insuficiente para pagos próximos',
       'El dinero disponible no cubre las obligaciones que vienen.',
       'balance_below_upcoming', '{"horizon_days": 15}'::jsonb, 'critico',
       'Tu dinero disponible ({available}) no cubre tus pagos próximos ({upcoming}).',
       true, false, 5),
      (new.user_id, 'Ingreso extraordinario sin asignar',
       'Todo ingreso extraordinario se asigna antes de gastarse.',
       'extraordinary_unallocated', '{}'::jsonb, 'atencion',
       'Tienes {name} ({amount}) sin destino asignado. Decide su uso antes de recibirlo.',
       true, false, 6),
      (new.user_id, 'Gasto muy por encima del promedio',
       'Detecta desviaciones significativas frente a tu historial.',
       'category_spike', '{"threshold_pct": 30, "min_months": 2}'::jsonb, 'atencion',
       'Tu gasto en {name} subió {change} % respecto a tu promedio.',
       true, false, 7),
      (new.user_id, 'Nueva deuda con deuda cara vigente',
       'No conviene endeudarse más mientras exista deuda de tasa alta.',
       'new_debt_while_expensive', '{"threshold": 20}'::jsonb, 'riesgo',
       'Ya tienes deuda cara ({name}, {rate} %): evita tomar deuda nueva.',
       true, false, 8),
      (new.user_id, 'Nunca pagar una línea de crédito con otra', null,
       'manual', '{}'::jsonb, 'info', 'Nunca pagar una línea de crédito con otra.', true, true, 20),
      (new.user_id, 'Línea liberada no significa dinero disponible', null,
       'manual', '{}'::jsonb, 'info',
       'Línea liberada no significa dinero disponible.', true, true, 21),
      (new.user_id, 'Los ingresos extraordinarios se asignan antes de gastarse', null,
       'manual', '{}'::jsonb, 'info',
       'Los ingresos extraordinarios se asignan antes de gastarse.', true, true, 22),
      (new.user_id, 'Trabajar con ciclos financieros de 30 días', null,
       'manual', '{}'::jsonb, 'info', 'Trabajar con ciclos financieros de 30 días.', true, true, 23);
  exception when others then
    raise warning 'No se pudieron sembrar las reglas de %: %', new.user_id, sqlerrm;
  end;

  begin
    insert into public.if_then_plans (user_id, trigger_text, steps, sort_order)
    values
      (new.user_id, 'SI recibo dinero extraordinario',
       array['Registrar el ingreso', 'Separar obligaciones', 'Asignar a deuda',
             'Separar ahorro', 'Recién entonces calcular dinero libre'], 1),
      (new.user_id, 'SI estoy a punto de comprar algo no presupuestado',
       array['Esperar 24 horas', 'Volver a evaluar la compra'], 2),
      (new.user_id, 'SI estoy triste y quiero gastar',
       array['Registrar la compra como gasto emocional',
             'Ver su impacto mensual antes de confirmar'], 3);
  exception when others then
    raise warning 'No se pudieron sembrar los planes de %: %', new.user_id, sqlerrm;
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Reparación: crea el perfil, las categorías y las reglas de cualquier
--    usuario que ya exista en auth.users pero se haya quedado sin ellos por
--    un fallo anterior.
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
  p record;
begin
  for u in select id from auth.users loop
    insert into public.profiles (user_id) values (u.id)
    on conflict (user_id) do nothing;
  end loop;

  -- Dispara el sembrado para los perfiles que quedaron sin categorías.
  for p in
    select pr.user_id from public.profiles pr
    where not exists (
      select 1 from public.expense_categories c where c.user_id = pr.user_id
    )
  loop
    insert into public.expense_categories (user_id, name, icon, sort_order)
    values
      (p.user_id, 'Alimentación', '🍽️', 1), (p.user_id, 'Transporte', '🚌', 2),
      (p.user_id, 'Mascotas', '🐱', 3), (p.user_id, 'Vivienda', '🏠', 4),
      (p.user_id, 'Ocio', '🎉', 5), (p.user_id, 'Ropa', '👗', 6),
      (p.user_id, 'Limpieza', '🧼', 7), (p.user_id, 'Salud', '🩺', 8),
      (p.user_id, 'Maquillaje', '💄', 9), (p.user_id, 'Suscripciones', '📺', 10),
      (p.user_id, 'Educación', '📚', 11), (p.user_id, 'Viajes', '✈️', 12),
      (p.user_id, 'Compras', '🛍️', 13), (p.user_id, 'Deudas', '💳', 14),
      (p.user_id, 'Ahorro', '💰', 15), (p.user_id, 'Otros', '📦', 16)
    on conflict (user_id, name) do nothing;
  end loop;
end $$;



-- ===========================================================================
-- PERMISOS PARA LA API (imprescindible)
-- PostgREST solo expone las tablas sobre las que anon/authenticated tienen
-- permisos. Sin esto, la aplicación responde "Could not find the table in
-- the schema cache" aunque la tabla exista. Es seguro: los permisos dejan
-- pasar la petición y las políticas RLS deciden qué filas se ven.
-- ===========================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ===========================================================================
-- VERIFICACIÓN FINAL: debe mostrar 29 tablas, 29 protegidas y 3 disparadores
-- ===========================================================================
select
  (select count(*) from pg_tables where schemaname = 'public') as tablas_creadas,
  (select count(*) from pg_tables where schemaname = 'public' and rowsecurity) as tablas_protegidas,
  (select count(*) from pg_policies where schemaname = 'public') as politicas,
  (select count(*) from pg_trigger where tgname in (
     'on_auth_user_created', 'on_profile_created_seed_categories',
     'on_profile_created_seed_rules')) as disparadores,
  (select count(*) from information_schema.tables
   where table_schema = 'public'
     and table_name in ('financial_rules','pending_verifications','spending_ranges')
  ) as las_tres_que_faltaban,
  (select count(distinct table_name) from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon') as visibles_para_la_api;
