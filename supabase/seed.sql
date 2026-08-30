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
