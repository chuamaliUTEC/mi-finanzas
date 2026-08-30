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
