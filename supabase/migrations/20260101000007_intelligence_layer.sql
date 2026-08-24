-- ============================================================
-- forecasts: projected financial position for a future period
-- ============================================================
create table if not exists public.forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forecast_date date not null,
  projected_income numeric(14,2) not null default 0,
  projected_expenses numeric(14,2) not null default 0,
  projected_balance numeric(14,2) not null default 0,
  method text not null default 'moving_average',
  created_at timestamptz not null default now()
);

create index if not exists forecasts_user_id_idx on public.forecasts(user_id);
create index if not exists forecasts_forecast_date_idx on public.forecasts(forecast_date);

alter table public.forecasts enable row level security;
drop policy if exists "forecasts_all_own" on public.forecasts;
create policy "forecasts_all_own" on public.forecasts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- forecast_actuals: what actually happened, to measure forecast error
-- ============================================================
create table if not exists public.forecast_actuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  forecast_id uuid not null references public.forecasts(id) on delete cascade,
  actual_income numeric(14,2) not null default 0,
  actual_expenses numeric(14,2) not null default 0,
  actual_balance numeric(14,2) not null default 0,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists forecast_actuals_user_id_idx on public.forecast_actuals(user_id);
create index if not exists forecast_actuals_forecast_id_idx on public.forecast_actuals(forecast_id);

alter table public.forecast_actuals enable row level security;
drop policy if exists "forecast_actuals_all_own" on public.forecast_actuals;
create policy "forecast_actuals_all_own" on public.forecast_actuals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- financial_alerts: actionable warnings (overspend, due date, low balance)
-- ============================================================
create table if not exists public.financial_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('overspend', 'due_date', 'low_balance', 'goal_at_risk', 'anomaly', 'other')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text,
  related_table text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists financial_alerts_user_id_idx on public.financial_alerts(user_id);
create index if not exists financial_alerts_is_read_idx on public.financial_alerts(is_read);

alter table public.financial_alerts enable row level security;
drop policy if exists "financial_alerts_all_own" on public.financial_alerts;
create policy "financial_alerts_all_own" on public.financial_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- financial_events: append-only domain event log (audit + memory input)
-- ============================================================
create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists financial_events_user_id_idx on public.financial_events(user_id);
create index if not exists financial_events_event_type_idx on public.financial_events(event_type);
create index if not exists financial_events_occurred_at_idx on public.financial_events(occurred_at);

alter table public.financial_events enable row level security;
drop policy if exists "financial_events_all_own" on public.financial_events;
create policy "financial_events_all_own" on public.financial_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- financial_memory: durable, summarized facts/preferences learned about the user
-- (small key/value-style memory, distinct from the raw event log above)
-- ============================================================
create table if not exists public.financial_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_key text not null,
  memory_value jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  source text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key)
);

create index if not exists financial_memory_user_id_idx on public.financial_memory(user_id);

alter table public.financial_memory enable row level security;
drop policy if exists "financial_memory_all_own" on public.financial_memory;
create policy "financial_memory_all_own" on public.financial_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_financial_memory_updated_at on public.financial_memory;
create trigger set_financial_memory_updated_at
  before update on public.financial_memory
  for each row execute function public.set_updated_at();

-- ============================================================
-- financial_snapshots: periodic point-in-time rollups (for fast dashboards/history)
-- ============================================================
create table if not exists public.financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_income numeric(14,2) not null default 0,
  total_expenses numeric(14,2) not null default 0,
  net_worth numeric(14,2) not null default 0,
  total_debt numeric(14,2) not null default 0,
  total_savings numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists financial_snapshots_user_id_idx on public.financial_snapshots(user_id);

alter table public.financial_snapshots enable row level security;
drop policy if exists "financial_snapshots_all_own" on public.financial_snapshots;
create policy "financial_snapshots_all_own" on public.financial_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- recommendation_history: suggestions shown to the user over time
-- ============================================================
create table if not exists public.recommendation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists recommendation_history_user_id_idx on public.recommendation_history(user_id);

alter table public.recommendation_history enable row level security;
drop policy if exists "recommendation_history_all_own" on public.recommendation_history;
create policy "recommendation_history_all_own" on public.recommendation_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- learning_adjustments: how the system's assumptions changed based on feedback
-- ============================================================
create table if not exists public.learning_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid references public.recommendation_history(id) on delete set null,
  adjustment_type text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists learning_adjustments_user_id_idx on public.learning_adjustments(user_id);

alter table public.learning_adjustments enable row level security;
drop policy if exists "learning_adjustments_all_own" on public.learning_adjustments;
create policy "learning_adjustments_all_own" on public.learning_adjustments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
