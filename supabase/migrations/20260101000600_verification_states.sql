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
