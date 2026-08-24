-- ============================================================
-- data_status: shared vocabulary for "how current is this value?"
-- Used across tables that can hold uncertain or superseded data.
-- ============================================================
create type public.data_status as enum (
  'actual',
  'historico',
  'desactualizado',
  'confirmado',
  'por_confirmar'
);

-- ============================================================
-- financial_memory: rebuilt to be append-only / versioned.
-- Updating a fact NEVER overwrites the previous row — it inserts a new
-- 'actual' row and a trigger demotes the previous 'actual' row for the
-- same key to 'historico'. This preserves the full evolution of a fact.
-- ============================================================
alter table public.financial_memory
  drop constraint if exists financial_memory_user_id_memory_key_key;

alter table public.financial_memory
  add column if not exists status public.data_status not null default 'actual',
  add column if not exists effective_date date not null default current_date,
  add column if not exists superseded_by uuid references public.financial_memory(id) on delete set null;

create index if not exists financial_memory_key_idx on public.financial_memory(user_id, memory_key);
create index if not exists financial_memory_status_idx on public.financial_memory(status);

create or replace function public.archive_previous_memory_fact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'actual' then
    update public.financial_memory
    set status = 'historico', superseded_by = new.id
    where user_id = new.user_id
      and memory_key = new.memory_key
      and status = 'actual'
      and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists archive_previous_memory_fact_trigger on public.financial_memory;
create trigger archive_previous_memory_fact_trigger
  after insert on public.financial_memory
  for each row execute function public.archive_previous_memory_fact();

-- ============================================================
-- income_sources: distinguish guaranteed salary from variable/
-- extraordinary/earmarked income, per the "ingreso != dinero libre" rule.
-- ============================================================
alter table public.income_sources
  add column if not exists source_type text not null default 'fijo'
    check (source_type in ('fijo', 'variable', 'extraordinario', 'destinado_especifico')),
  add column if not exists frequency text
    check (frequency is null or frequency in ('semanal', 'quincenal', 'mensual', 'irregular')),
  add column if not exists earmarked_for text, -- e.g. 'inversion', 'ahorro' when destinado_especifico
  add column if not exists status public.data_status not null default 'actual';

-- ============================================================
-- debts / credit_cards: allow "unknown" to be represented as NULL,
-- distinct from a real 0 balance. Never assume 0 when a value is unconfirmed.
-- ============================================================
alter table public.debts
  alter column current_balance drop not null,
  alter column original_amount drop not null,
  add column if not exists status_detail public.data_status not null default 'confirmado',
  add column if not exists currency text not null default 'PEN';

alter table public.credit_cards
  alter column current_balance drop not null,
  alter column current_balance drop default,
  add column if not exists status_detail public.data_status not null default 'confirmado',
  add column if not exists currency text not null default 'PEN';

alter table public.receivables
  add column if not exists currency text not null default 'PEN',
  add column if not exists status_detail public.data_status not null default 'confirmado';

comment on column public.debts.current_balance is
  'NULL means unknown/unconfirmed ("por confirmar") — never default this to 0.';
comment on column public.credit_cards.current_balance is
  'NULL means unknown/unconfirmed ("por confirmar") — never default this to 0.';
