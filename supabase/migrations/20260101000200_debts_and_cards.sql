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
