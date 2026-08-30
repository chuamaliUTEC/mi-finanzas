-- Seed de desarrollo local (supabase db reset). Carga el perfil financiero
-- inicial del prompt maestro como DATOS, nunca como lógica (secc. 40).
-- En producción estos datos se ingresan vía onboarding; este archivo solo
-- facilita probar la app localmente con un usuario demo:
--   correo: demo@mifinanzas.local  ·  contraseña: demo123456

-- Usuario demo en auth.users (solo válido en el stack local de Supabase).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'demo@mifinanzas.local',
  crypt('demo123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, created_at, updated_at
)
values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@mifinanzas.local"}',
  'email', now(), now()
)
on conflict do nothing;

-- El trigger on_auth_user_created ya creó profile + categorías por defecto.
update public.profiles set
  full_name = 'Carmen',
  base_currency = 'PEN',
  employer = 'SOLGAS S.A.',
  employment_start_date = '2026-08-10',
  onboarding_completed_at = now()
where user_id = '11111111-1111-1111-1111-111111111111';

-- Cuentas (secc. 28). El saldo actual = initial_balance + movimientos.
insert into public.accounts (id, user_id, name, type, institution, initial_balance, is_verified)
values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Cuenta sueldo Interbank', 'sueldo', 'Interbank', 0, true),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Efectivo', 'efectivo', null, 0, true),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Yape', 'yape', 'BCP', 0, true),
  ('22222222-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Trading', 'inversion', null, 3000, false)  -- ⚠️ NO VERIFICADO (secc. 30)
on conflict (id) do nothing;

-- Fuentes de ingreso (secc. 3).
insert into public.income_sources
  (id, user_id, name, kind, recurrence, expected_amount, reliability, is_verified, expected_day, notes)
values
  ('33333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'Sueldo SOLGAS', 'fijo', 'mensual', 2405, 'alta', false, 24,
   'Neto estimado; pendiente de verificar con boleta. Único ingreso verificable para evaluación bancaria.'),
  ('33333333-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Aporte familiar', 'fijo', 'semanal', 100, 'alta', true, null,
   'S/ 100 por semana (~S/ 433 al mes).'),
  ('33333333-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Trabajos parciales', 'variable', 'mensual', 600, 'media', false, null, null),
  ('33333333-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Trading', 'variable', 'mensual', 230, 'baja', false, null, 'Sin verificar.')
on conflict (id) do nothing;

-- Ingresos extraordinarios (secc. 4) con asignación previa de destino.
insert into public.extraordinary_incomes (id, user_id, name, expected_amount, expected_date, notes)
values
  ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'CTS estimada', 735, '2026-11-15', null),
  ('44444444-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'Gratificación estimada', 1990, '2026-12-15', '100% destinada a deuda BCP antes de recibirse.'),
  ('44444444-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Cobro pendiente Piero', 500, null, null),
  ('44444444-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Cobro pendiente Leopoldo', 35, null, null)
on conflict (id) do nothing;

-- La gratificación queda pre-asignada 100% a deuda (el target_id concreto se
-- enlaza cuando exista la deuda BCP en la Fase 2 del seed, más abajo en este
-- archivo a medida que crezca).
insert into public.extraordinary_income_allocations
  (user_id, extraordinary_income_id, target_type, percent)
select '11111111-1111-1111-1111-111111111111',
       '44444444-0000-0000-0000-000000000002', 'deuda', 100
where not exists (
  select 1 from public.extraordinary_income_allocations
  where extraordinary_income_id = '44444444-0000-0000-0000-000000000002'
);

-- ---------------------------------------------------------------------------
-- Fase 2: tarjetas y deudas iniciales (secc. 5-6).
-- ---------------------------------------------------------------------------
insert into public.credit_cards
  (id, user_id, name, issuer, credit_line, cash_line, tea_purchases, tea_cash, tea_usd,
   membership_fee, insurance_monthly, closing_day, payment_day, benefits)
values
  ('55555555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'BCP Visa', 'BCP', 4740, 0, 87.50, 87.50, 66.00, 350, 0, 26, 20, 'Millas LATAM Pass'),
  ('55555555-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'SIP', 'SIP', 2000, 1600, 109.83, 109.83, null, 69.90, 15.90, 28, 25, 'Cashback')
on conflict (id) do nothing;

insert into public.debts
  (id, user_id, creditor, name, type, credit_card_id, initial_balance, tea, tcea, rate_type,
   installment_amount, minimum_payment, num_installments, installments_paid,
   insurance_monthly, due_day, target_payoff_date, priority, status, allows_early_payoff, notes)
values
  ('66666666-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'SIP', 'Tarjeta SIP', 'revolvente', '55555555-0000-0000-0000-000000000002',
   980.99, 109.83, null, 'tea', null, null, null, 0, 15.90, 25, null,
   'muy_alta', 'activa', 'desconocido', null),
  ('66666666-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'BCP', 'Tarjeta BCP Visa', 'revolvente', '55555555-0000-0000-0000-000000000001',
   3194.84, 87.50, null, 'tea', null, 348.44, null, 0, 0, 20, null,
   'muy_alta', 'activa', 'desconocido', 'Saldo aproximado.'),
  ('66666666-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'Rody', 'Préstamo Rody', 'sin_intereses', null,
   810, 0, null, 'sin_interes', null, null, null, 0, 0, null, '2026-11-30',
   'alta', 'activa', 'si', 'Sin intereses; debe quedar en 0 en noviembre 2026.'),
  ('66666666-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'Compartamos', 'Préstamo Compartamos', 'cuotas', null,
   4967, null, 62.7586, 'tcea', 430, 430, 18, 2, 13.44, null, null,
   'media', 'activa', 'desconocido',
   'Monto inicial S/ 5,171; capital estimado tras 2 cuotas ~S/ 4,967. Quedan 16 cuotas de S/ 430 (S/ 6,880).'),
  ('66666666-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'UTEC', 'Créditos UTEC', 'otro', null,
   84633.60, null, null, 'sin_interes', null, null, null, 0, 0, null, null,
   'baja', 'no_activada', 'si',
   '153.6 créditos × S/ 551. Aumenta hasta S/ 60 por año; permite adelanto. No activada aún.')
on conflict (id) do nothing;

-- La gratificación pre-asignada apunta ahora a la deuda BCP concreta.
update public.extraordinary_income_allocations
set target_id = '66666666-0000-0000-0000-000000000002'
where extraordinary_income_id = '44444444-0000-0000-0000-000000000002'
  and target_id is null;
