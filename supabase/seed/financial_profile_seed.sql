-- ---------------------------------------------------------------------------
-- CARGA DEL PERFIL FINANCIERO REAL
--
-- Fuente: perfil-financiero-completo.md (corte 26/08/2026) + actualización
-- de saldos del 30/08/2026.
--
-- Cómo se ejecuta: pega este archivo completo en el SQL Editor de Supabase
-- y ejecútalo. Es IDEMPOTENTE: puedes correrlo las veces que quieras sin
-- duplicar nada (usa identificadores estables y `on conflict do update`).
--
-- No crea usuarios: busca al usuario ya registrado por su correo y asocia
-- todo a su auth.uid(), de modo que las políticas RLS sigan aplicando.
-- ---------------------------------------------------------------------------

do $$
declare
  uid uuid;
  -- Identificadores estables: derivados del usuario, así el seed es
  -- reejecutable y no colisiona si en el futuro hay más de una cuenta.
  acc_interbank uuid; acc_ahorro_bcp uuid; acc_efectivo uuid;
  acc_yape uuid; acc_plin uuid;
  card_bcp uuid; card_sip uuid;
  debt_sip uuid; debt_bcp uuid; debt_rody uuid; debt_comp uuid; debt_utec uuid;
  extra_cts uuid; extra_grati uuid;
  goal_sip uuid; goal_bcp uuid; goal_rody uuid; goal_fondo uuid; goal_ingreso uuid;
  budget_sep uuid;
  cat_alimentacion uuid; cat_transporte uuid; cat_maquillaje uuid;
  cat_suscripciones uuid; cat_vivienda uuid; cat_mascotas uuid;
  cat_deudas uuid; cat_otros uuid;
begin
  select id into uid from auth.users where email = 'carmen.huamali@utec.edu.pe';
  if uid is null then
    raise exception 'No existe un usuario con ese correo. Regístrate primero en la aplicación y vuelve a ejecutar este script.';
  end if;

  -- Identificadores derivados del usuario (estables entre ejecuciones).
  acc_interbank  := md5(uid || 'acc_interbank')::uuid;
  acc_ahorro_bcp := md5(uid || 'acc_ahorro_bcp')::uuid;
  acc_efectivo   := md5(uid || 'acc_efectivo')::uuid;
  acc_yape       := md5(uid || 'acc_yape')::uuid;
  acc_plin       := md5(uid || 'acc_plin')::uuid;
  card_bcp       := md5(uid || 'card_bcp')::uuid;
  card_sip       := md5(uid || 'card_sip')::uuid;
  debt_sip       := md5(uid || 'debt_sip')::uuid;
  debt_bcp       := md5(uid || 'debt_bcp')::uuid;
  debt_rody      := md5(uid || 'debt_rody')::uuid;
  debt_comp      := md5(uid || 'debt_comp')::uuid;
  debt_utec      := md5(uid || 'debt_utec')::uuid;
  extra_cts      := md5(uid || 'extra_cts')::uuid;
  extra_grati    := md5(uid || 'extra_grati')::uuid;
  goal_sip       := md5(uid || 'goal_sip')::uuid;
  goal_bcp       := md5(uid || 'goal_bcp')::uuid;
  goal_rody      := md5(uid || 'goal_rody')::uuid;
  goal_fondo     := md5(uid || 'goal_fondo')::uuid;
  goal_ingreso   := md5(uid || 'goal_ingreso')::uuid;
  budget_sep     := md5(uid || 'budget_2026_09')::uuid;

  -- =========================================================================
  -- 1. PERFIL
  -- =========================================================================
  update public.profiles set
    full_name = 'Carmen',
    base_currency = 'PEN',
    age = 25,
    employer = 'SOLGAS S.A.',
    employment_start_date = '2026-08-10',
    employment_regime = 'Planilla',
    pension_fund = 'Integra, Fondo Tipo 2',
    health_insurance = 'EPS',
    health_insurance_cost = 41.56,
    housing = 'Casa de sus padres, sin alquiler',
    dependents = 'Ninguno (1 gato)',
    education = 'Ingeniería Ambiental, UTEC (concluida)',
    financial_priority = 'Eliminar SIP y Rody cuanto antes; mínimos puntuales en el resto',
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where user_id = uid;

  -- Referencias a las categorías creadas automáticamente al registrarse.
  select id into cat_alimentacion from public.expense_categories where user_id = uid and name = 'Alimentación';
  select id into cat_transporte   from public.expense_categories where user_id = uid and name = 'Transporte';
  select id into cat_maquillaje   from public.expense_categories where user_id = uid and name = 'Maquillaje';
  select id into cat_suscripciones from public.expense_categories where user_id = uid and name = 'Suscripciones';
  select id into cat_vivienda     from public.expense_categories where user_id = uid and name = 'Vivienda';
  select id into cat_mascotas     from public.expense_categories where user_id = uid and name = 'Mascotas';
  select id into cat_deudas       from public.expense_categories where user_id = uid and name = 'Deudas';
  select id into cat_otros        from public.expense_categories where user_id = uid and name = 'Otros';

  -- =========================================================================
  -- 2. CUENTAS
  --    initial_balance null = saldo desconocido (NO es cero).
  -- =========================================================================
  insert into public.accounts (id, user_id, name, type, institution, initial_balance, is_verified, currency)
  values
    (acc_interbank,  uid, 'Cuenta sueldo Interbank', 'sueldo',   'Interbank', null,   true, 'PEN'),
    (acc_ahorro_bcp, uid, 'Ahorro BCP',              'ahorro',   'BCP',       161.00, true, 'PEN'),
    (acc_efectivo,   uid, 'Efectivo',                'efectivo', null,        null,   true, 'PEN'),
    (acc_yape,       uid, 'Yape',                    'yape',     null,        null,   true, 'PEN'),
    (acc_plin,       uid, 'Plin',                    'plin',     null,        null,   true, 'PEN')
  on conflict (id) do update set
    name = excluded.name, type = excluded.type, institution = excluded.institution,
    initial_balance = excluded.initial_balance, is_verified = excluded.is_verified,
    deleted_at = null;

  -- =========================================================================
  -- 3. ACTIVOS NO BANCARIOS
  -- =========================================================================
  insert into public.assets (id, user_id, name, kind, value, is_verified, verification_status, notes)
  values (
    md5(uid || 'asset_trading')::uuid, uid, 'Capital en trading', 'inversion',
    3000.00, false, 'no_verificado',
    'Con un amigo. Pendiente: estado de cuenta de corredora a su nombre, historial de meses negativos y prueba de retiro parcial. NO es efectivo disponible.'
  )
  on conflict (id) do update set
    value = excluded.value, is_verified = false,
    verification_status = 'no_verificado', notes = excluded.notes, deleted_at = null;

  -- =========================================================================
  -- 4. FUENTES DE INGRESO
  -- =========================================================================
  insert into public.income_sources
    (id, user_id, name, kind, recurrence, expected_amount, reliability, is_verified,
     verification_status, verification_note, is_active, notes)
  values
    (md5(uid || 'inc_sueldo')::uuid, uid, 'Sueldo neto SOLGAS', 'fijo', 'mensual',
     2405.00, 'alta', false, 'estimado', 'Falta la boleta de agosto para confirmarlo.', true,
     'Único ingreso verificable ante un banco.'),
    (md5(uid || 'inc_papa')::uuid, uid, 'Aporte del papá', 'fijo', 'semanal',
     100.00, 'alta', true, 'confirmado', null, true,
     'S/ 100 por semana (~S/ 433 al mes).'),
    (md5(uid || 'inc_parciales')::uuid, uid, 'Trabajos parciales (empresa familiar)', 'variable', 'mensual',
     600.00, 'media', true, 'confirmado', null, true, null),
    (md5(uid || 'inc_trading')::uuid, uid, 'Trading (amigo)', 'variable', 'mensual',
     230.00, 'baja', false, 'no_verificado',
     'Sin verificar: no incrementa saldo, capacidad de gasto ni patrimonio líquido.', true, null)
  on conflict (id) do update set
    name = excluded.name, expected_amount = excluded.expected_amount,
    reliability = excluded.reliability, is_verified = excluded.is_verified,
    verification_status = excluded.verification_status,
    verification_note = excluded.verification_note,
    notes = excluded.notes, deleted_at = null;

  -- =========================================================================
  -- 5. INGRESOS EXTRAORDINARIOS (con destino preasignado)
  -- =========================================================================
  insert into public.extraordinary_incomes
    (id, user_id, name, expected_amount, expected_date, status, verification_status, notes)
  values
    (extra_cts, uid, 'CTS (2 meses + 21 días)', 735.00, '2026-11-15', 'esperado', 'estimado',
     'Primera quincena de noviembre.'),
    (extra_grati, uid, 'Gratificación (4 meses + bonif. 6.75 %)', 1990.00, '2026-12-15', 'esperado', 'estimado',
     'Primera quincena de diciembre. Preasignada 100 % a BCP antes de recibirse.')
  on conflict (id) do update set
    expected_amount = excluded.expected_amount, expected_date = excluded.expected_date,
    verification_status = excluded.verification_status, notes = excluded.notes, deleted_at = null;

  -- =========================================================================
  -- 6. CUENTAS POR COBRAR
  -- =========================================================================
  insert into public.receivables (id, user_id, person, original_amount, expected_date, status, notes)
  values
    (md5(uid || 'rec_piero')::uuid, uid, 'Piero', 500.00, null, 'pendiente',
     'En mora. Pendiente: acordar fecha y monto comprometido.'),
    (md5(uid || 'rec_leopoldo')::uuid, uid, 'Leopoldo', 35.00, null, 'pendiente', 'Sin fecha.')
  on conflict (id) do update set
    original_amount = excluded.original_amount, notes = excluded.notes, deleted_at = null;

  -- =========================================================================
  -- 7. TARJETAS DE CRÉDITO
  -- =========================================================================
  insert into public.credit_cards
    (id, user_id, name, issuer, credit_line, cash_line, tea_purchases, tea_cash,
     tea_cash_advance, tea_usd, membership_fee, membership_charge_date,
     insurance_monthly, closing_day, payment_day, benefits, notes)
  values
    (card_bcp, uid, 'BCP Visa', 'BCP', 4740.00, 0, 87.50, 107.00, 107.00, 66.00,
     350.00, '2027-04-25', 9.88, 26, 20, 'Millas LATAM Pass (828/mes)',
     'Riesgo cambiario en compras USD. Existe una segunda tarjeta BCP 3817 de estado desconocido.'),
    (card_sip, uid, 'SIP', 'SIP', 2000.00, 1600.00, 109.83, 109.83, 109.83, null,
     69.90, '2027-04-01', 15.90, 28, 25, 'Cashback 1 % Intercorp, 0.5 % resto', null)
  on conflict (id) do update set
    credit_line = excluded.credit_line, cash_line = excluded.cash_line,
    tea_purchases = excluded.tea_purchases, tea_cash = excluded.tea_cash,
    tea_cash_advance = excluded.tea_cash_advance, tea_usd = excluded.tea_usd,
    membership_fee = excluded.membership_fee,
    membership_charge_date = excluded.membership_charge_date,
    insurance_monthly = excluded.insurance_monthly,
    closing_day = excluded.closing_day, payment_day = excluded.payment_day,
    benefits = excluded.benefits, notes = excluded.notes, deleted_at = null;

  -- =========================================================================
  -- 8. DEUDAS  (saldos actualizados al 30/08/2026)
  -- =========================================================================
  insert into public.debts
    (id, user_id, creditor, name, type, credit_card_id, initial_balance, tea, tcea,
     rate_type, installment_amount, minimum_payment, num_installments, installments_paid,
     insurance_monthly, due_day, target_payoff_date, priority, status,
     allows_early_payoff, payment_strategy, notes)
  values
    -- SIP: saldo actualizado (era 980.99 al corte del perfil).
    (debt_sip, uid, 'SIP', 'Tarjeta SIP', 'revolvente', card_sip,
     1042.37, 109.83, null, 'tea', null, null, null, 0,
     15.90, 25, '2026-09-30', 'muy_alta', 'activa', 'si',
     'Atacar primero: es la tasa más alta.',
     'Saldo al 30/08/2026. Objetivo del plan: eliminarla en septiembre con el cobro a Piero.'),
    -- BCP: saldo actualizado (era 3,194.84 / 3,200.04 al corte).
    (debt_bcp, uid, 'BCP', 'Tarjeta BCP Visa', 'revolvente', card_bcp,
     3160.55, 87.50, null, 'tea', null, 348.44, null, 0,
     9.88, 20, '2026-12-31', 'muy_alta', 'activa', 'si',
     'Mínimo como táctica en septiembre y octubre; ataque real en noviembre y diciembre.',
     'Saldo al 30/08/2026. Del mínimo de S/ 348.44, unos S/ 172 son puro interés: solo ~S/ 176 tocan capital.'),
    -- Rody: se carga el original (1,110) y el pago hecho (300) más abajo,
    -- para que el avance del 27 % sea real y no un número escrito a mano.
    (debt_rody, uid, 'Rody', 'Préstamo Rody', 'sin_intereses', null,
     1110.00, 0, null, 'sin_interes', null, null, null, 0,
     0, null, '2026-11-30', 'alta', 'activa', 'si',
     'Restricción dura: plazo dado por él hasta noviembre. No renegociar.',
     'Relación terminada, sin comunicación. S/ 1,110 originales − S/ 300 pagados.'),
    (debt_comp, uid, 'Compartamos', 'Préstamo Compartamos', 'cuotas', null,
     4967.00, null, 62.7586, 'tcea', 430.00, 430.00, 18, 2,
     13.44, null, null, 'media', 'activa', 'desconocido',
     'Cuota obligatoria. Solo se vuelve objetivo si permite prepago con reducción de intereses.',
     'Crédito de S/ 5,171. Total a devolver S/ 7,740; costo del crédito S/ 2,569. Quedan 16 cuotas (S/ 6,880). Tasa moratoria nominal 15.81 %. PENDIENTE CRÍTICO: preguntar si permite pago anticipado CON REDUCCIÓN DE INTERESES (distinto de pago adelantado).'),
    (debt_utec, uid, 'UTEC', 'Créditos UTEC', 'otro', null,
     84633.60, null, null, 'sin_interes', null, null, null, 0,
     0, null, null, 'baja', 'no_activada', 'si',
     'No adelantar: es la deuda más barata por márgenes enormes.',
     '153.6 créditos a devolver de 206 de la carrera (75 % financiado). Precio actual S/ 551/crédito, sube hasta S/ 60 al año. En unidades de crédito el costo es 0 %; el único costo es la inflación del precio (~7.5–8 % TEA si sube S/ 60/año). NO ACTIVADA: no descuenta del flujo mensual.')
  on conflict (id) do update set
    initial_balance = excluded.initial_balance, tea = excluded.tea, tcea = excluded.tcea,
    rate_type = excluded.rate_type, installment_amount = excluded.installment_amount,
    minimum_payment = excluded.minimum_payment, num_installments = excluded.num_installments,
    installments_paid = excluded.installments_paid,
    insurance_monthly = excluded.insurance_monthly, due_day = excluded.due_day,
    target_payoff_date = excluded.target_payoff_date, priority = excluded.priority,
    status = excluded.status, allows_early_payoff = excluded.allows_early_payoff,
    payment_strategy = excluded.payment_strategy, notes = excluded.notes, deleted_at = null;

  -- Pago histórico de Rody: hace que el saldo calculado sea 810 y el avance 27 %.
  insert into public.debt_payments
    (id, user_id, debt_id, date, amount, principal_amount, notes)
  values (
    md5(uid || 'pay_rody_1')::uuid, uid, debt_rody, '2026-08-01', 300.00, 300.00,
    'Pagos acumulados antes del corte del perfil (fecha aproximada).'
  )
  on conflict (id) do update set
    amount = excluded.amount, principal_amount = excluded.principal_amount, deleted_at = null;

  -- Destino preasignado de la gratificación: 100 % a la deuda BCP.
  insert into public.extraordinary_income_allocations
    (id, user_id, extraordinary_income_id, target_type, target_id, percent)
  values (
    md5(uid || 'alloc_grati_bcp')::uuid, uid, extra_grati, 'deuda', debt_bcp, 100
  )
  on conflict (id) do update set target_id = excluded.target_id, percent = excluded.percent;

  -- La CTS va a BCP según el plan de noviembre.
  insert into public.extraordinary_income_allocations
    (id, user_id, extraordinary_income_id, target_type, target_id, percent)
  values (
    md5(uid || 'alloc_cts_bcp')::uuid, uid, extra_cts, 'deuda', debt_bcp, 100
  )
  on conflict (id) do update set target_id = excluded.target_id, percent = excluded.percent;

  -- =========================================================================
  -- 9. GASTOS RECURRENTES
  -- =========================================================================
  insert into public.recurring_expenses
    (id, user_id, name, amount, category_id, due_day, is_active, needs_verification, notes)
  values
    (md5(uid || 'rec_spotify')::uuid,  uid, 'Spotify',            32.90, cat_suscripciones, null, true, false, null),
    (md5(uid || 'rec_youtube')::uuid,  uid, 'YouTube',             6.00, cat_suscripciones, null, true, false, null),
    (md5(uid || 'rec_ia')::uuid,       uid, 'Suscripción IA',     88.00, cat_suscripciones, null, true, false, 'Aproximado. Pendiente: revisar duplicación ChatGPT / Claude.'),
    (md5(uid || 'rec_apple')::uuid,    uid, 'Apple',               4.00, cat_suscripciones, null, true, false, 'Aproximado.'),
    (md5(uid || 'rec_internet')::uuid, uid, 'Internet',           35.00, cat_vivienda,      null, true, false, 'Alternado con su hermana.'),
    (md5(uid || 'rec_gato')::uuid,     uid, 'Comida del gato',   109.00, cat_mascotas,      null, true, false, 'Aproximado.'),
    (md5(uid || 'rec_gas')::uuid,      uid, 'Balón de gas',        7.50, cat_vivienda,      null, true, false, 'Aproximado (prorrateado).'),
    (md5(uid || 'rec_seg_sip')::uuid,  uid, 'Seguro protección SIP', 15.90, cat_deudas,     25,   true, false, null),
    (md5(uid || 'rec_seg_bcp')::uuid,  uid, 'Desgravamen BCP',     9.88, cat_deudas,        20,   true, false, 'No estaba incluido en los S/ 532 de gastos estructurales del perfil.'),
    (md5(uid || 'rec_pacifico')::uuid, uid, 'Cargo Pacífico 7015379', 12.99, cat_otros,     null, true, true,  'PENDIENTE DE VERIFICAR: confirmar si corresponde y darlo de baja si no.'),
    (md5(uid || 'rec_oficina')::uuid,  uid, 'Lunes de oficina',  221.00, cat_transporte,    null, true, false, 'Estimado: (taxi 24 + colectivo 8 + almuerzo ~19.50) × 4.3. Martes a jueves la planta cubre transporte y almuerzo; viernes en casa.')
  on conflict (id) do update set
    amount = excluded.amount, category_id = excluded.category_id,
    due_day = excluded.due_day, needs_verification = excluded.needs_verification,
    notes = excluded.notes, is_active = true, deleted_at = null;

  -- =========================================================================
  -- 10. RANGOS HISTÓRICOS DE GASTO VARIABLE (referencia, no movimientos)
  -- =========================================================================
  insert into public.spending_ranges
    (id, user_id, category_id, label, min_amount, max_amount, period_note)
  values
    (md5(uid || 'range_rest')::uuid,   uid, cat_alimentacion, 'Restaurantes y delivery',  30.00, 771.00, 'Histórico febrero – julio 2026'),
    (md5(uid || 'range_apps')::uuid,   uid, cat_transporte,   'Transporte por apps',     129.00, 288.00, 'Histórico febrero – julio 2026'),
    (md5(uid || 'range_estet')::uuid,  uid, cat_maquillaje,   'Estética y belleza',        0.00, 358.00, 'Histórico febrero – julio 2026'),
    (md5(uid || 'range_total')::uuid,  uid, null,             'Banda total de gasto variable', 400.00, 1200.00, 'Esta varianza determina si el plan funciona.')
  on conflict (id) do update set
    min_amount = excluded.min_amount, max_amount = excluded.max_amount,
    label = excluded.label, period_note = excluded.period_note, deleted_at = null;

  -- =========================================================================
  -- 11. PRESUPUESTO DE SEPTIEMBRE 2026
  --     Se usa el extremo BAJO de cada rango histórico: es lo más exigente
  --     que ya lograste alguna vez, y es lo que el plan de septiembre
  --     necesita para matar SIP. Ajustable desde la app.
  -- =========================================================================
  insert into public.monthly_budgets (id, user_id, year, month, notes)
  values (budget_sep, uid, 2026, 9,
    'Basado en el extremo bajo de tu rango histórico. Meta del mes: eliminar SIP.')
  on conflict (id) do update set notes = excluded.notes, deleted_at = null;

  insert into public.budget_categories (id, user_id, budget_id, category_id, planned_amount, is_protected)
  values
    (md5(uid || 'bc_alim')::uuid,  uid, budget_sep, cat_alimentacion,  30.00, false),
    (md5(uid || 'bc_transp')::uuid, uid, budget_sep, cat_transporte,  129.00, false),
    (md5(uid || 'bc_maq')::uuid,   uid, budget_sep, cat_maquillaje,     0.00, false)
  on conflict (id) do update set planned_amount = excluded.planned_amount;

  -- =========================================================================
  -- 12. METAS  (del plan mes a mes del perfil)
  -- =========================================================================
  insert into public.savings_goals
    (id, user_id, name, kind, target_amount, target_date, monthly_contribution,
     priority, status, debt_id, notes)
  values
    (goal_sip, uid, 'Eliminar SIP', 'eliminar_deuda', 1042.37, '2026-09-30', null,
     'muy_alta', 'activa', debt_sip, 'Septiembre: cobro a Piero (S/ 500) + ~S/ 481 de flujo.'),
    (goal_rody, uid, 'Pagar Rody', 'eliminar_deuda', 810.00, '2026-11-30', null,
     'alta', 'activa', debt_rody, 'Octubre: ~S/ 810. Plazo dado por él, restricción dura.'),
    (goal_bcp, uid, 'Eliminar BCP', 'eliminar_deuda', 3160.55, '2026-12-31', null,
     'muy_alta', 'activa', debt_bcp, 'Noviembre: CTS S/ 735 + ~S/ 500. Diciembre: gratificación S/ 1,990.'),
    (goal_fondo, uid, 'Fondo de emergencia', 'fondo_emergencia', 1600.00, '2027-06-30', null,
     'media', 'activa', null, 'Equivale a ~3 meses de gastos. Se empieza en enero 2027, con el flujo liberado.'),
    (goal_ingreso, uid, 'Subir el ingreso a S/ 5,000 – 6,000', 'otro', 5000.00, '2027-08-31', null,
     'alta', 'activa', null, 'El cuello de botella es el ingreso sustentable, no el ahorro. Un banco solo cuenta el sueldo (~S/ 2,405).')
  on conflict (id) do update set
    name = excluded.name, target_amount = excluded.target_amount,
    target_date = excluded.target_date, priority = excluded.priority,
    debt_id = excluded.debt_id, notes = excluded.notes, deleted_at = null;

  -- =========================================================================
  -- 13. REGLAS DEL SISTEMA (las 11 del perfil, en tus palabras)
  --     Reemplazan a las reglas manuales genéricas creadas al registrarte.
  -- =========================================================================
  delete from public.financial_rules where user_id = uid and is_manual = true and is_system = true;

  insert into public.financial_rules
    (id, user_id, name, condition_type, condition_params, severity, message_template,
     is_system, is_manual, enabled, sort_order)
  values
    (md5(uid || 'rule_1')::uuid,  uid, 'Una cifra visible por vez. Nunca un tablero.',                          'manual', '{}'::jsonb, 'info', 'Una cifra visible por vez. Nunca un tablero.', true, true, true, 1),
    (md5(uid || 'rule_2')::uuid,  uid, 'Ciclos de 30 días.',                                                     'manual', '{}'::jsonb, 'info', 'Ciclos de 30 días.', true, true, true, 2),
    (md5(uid || 'rule_3')::uuid,  uid, 'Nunca pagar una línea de crédito con otra.',                             'manual', '{}'::jsonb, 'info', 'Nunca pagar una línea de crédito con otra.', true, true, true, 3),
    (md5(uid || 'rule_4')::uuid,  uid, 'PASE CUOTAS bloqueado — es 87.50 %, la misma tasa, solo más largo.',     'manual', '{}'::jsonb, 'info', 'PASE CUOTAS bloqueado — es 87.50 %, la misma tasa, solo más largo.', true, true, true, 4),
    (md5(uid || 'rule_5')::uuid,  uid, 'Windfalls preasignados antes de llegar.',                                'manual', '{}'::jsonb, 'info', 'Windfalls preasignados antes de llegar.', true, true, true, 5),
    (md5(uid || 'rule_6')::uuid,  uid, 'Tarjetas fuera de DIDI, Uber, delivery y Apple Pay.',                    'manual', '{}'::jsonb, 'info', 'Tarjetas fuera de DIDI, Uber, delivery y Apple Pay.', true, true, true, 6),
    (md5(uid || 'rule_7')::uuid,  uid, 'Un solo pago programado al mes por tarjeta.',                            'manual', '{}'::jsonb, 'info', 'Un solo pago programado al mes por tarjeta.', true, true, true, 7),
    (md5(uid || 'rule_8')::uuid,  uid, 'Rody = restricción dura, cerrada en noviembre.',                         'manual', '{}'::jsonb, 'info', 'Rody = restricción dura, cerrada en noviembre.', true, true, true, 8),
    (md5(uid || 'rule_9')::uuid,  uid, 'Planes "si pasa X, hago Y" para tristeza y dinero extra.',               'manual', '{}'::jsonb, 'info', 'Planes "si pasa X, hago Y" para tristeza y dinero extra.', true, true, true, 9),
    (md5(uid || 'rule_10')::uuid, uid, 'Línea liberada ≠ dinero disponible.',                                    'manual', '{}'::jsonb, 'info', 'Línea liberada ≠ dinero disponible.', true, true, true, 10),
    (md5(uid || 'rule_11')::uuid, uid, 'Ninguna inversión nueva mientras exista deuda sobre 20 % TEA.',          'manual', '{}'::jsonb, 'info', 'Ninguna inversión nueva mientras exista deuda sobre 20 % TEA.', true, true, true, 11)
  on conflict (id) do update set
    name = excluded.name, message_template = excluded.message_template,
    sort_order = excluded.sort_order, deleted_at = null;

  -- =========================================================================
  -- 14. PENDIENTES POR VERIFICAR (sección 12 del perfil)
  -- =========================================================================
  insert into public.pending_verifications
    (id, user_id, title, detail, amount, priority, sort_order)
  values
    (md5(uid || 'pend_1')::uuid,  uid, 'Verificar el trading',            'Estado de cuenta de corredora a su nombre, historial de meses negativos y prueba de retiro parcial.', 3000.00, 'critico', 1),
    (md5(uid || 'pend_2')::uuid,  uid, 'Cronograma formal de UTEC',       'Con fecha de activación.', null, 'critico', 2),
    (md5(uid || 'pend_3')::uuid,  uid, 'Reporte de Deudas SBS',           'Para ver la foto completa de lo reportado.', null, 'critico', 3),
    (md5(uid || 'pend_4')::uuid,  uid, 'Compartamos: ¿permite pago anticipado con reducción de intereses?', 'Preguntar con esas palabras exactas. Distinto de "pago adelantado", que solo adelanta cuotas sin bajar el costo. Si permite, cancelar los ~S/ 4,967 ahorraría buena parte de los S/ 2,569 de intereses.', 2569.00, 'critico', 4),
    (md5(uid || 'pend_5')::uuid,  uid, 'Boleta de agosto',                'Para confirmar el sueldo neto de S/ 2,405.', 2405.00, 'critico', 5),
    (md5(uid || 'pend_6')::uuid,  uid, 'Cargo Pacífico 7015379',          'Confirmar si corresponde; darlo de baja si no.', 12.99, 'operativo', 6),
    (md5(uid || 'pend_7')::uuid,  uid, 'Tarjeta BCP 3817',                'Existe una segunda tarjeta: confirmar estado y línea.', null, 'operativo', 7),
    (md5(uid || 'pend_8')::uuid,  uid, 'Duplicación ChatGPT / Claude',    'Revisar si se paga dos veces por lo mismo.', null, 'operativo', 8),
    (md5(uid || 'pend_9')::uuid,  uid, 'MORELLI S/ 556.10',               'Cargo por identificar. NO cargado como deuda hasta confirmarlo.', 556.10, 'operativo', 9),
    (md5(uid || 'pend_10')::uuid, uid, 'TARJ000073013358 S/ 1,300',       'Cargo por identificar. NO cargado como deuda hasta confirmarlo.', 1300.00, 'operativo', 10),
    (md5(uid || 'pend_11')::uuid, uid, 'Monto de las dos salidas mensuales', 'Con amigos, monto no declarado.', null, 'operativo', 11),
    (md5(uid || 'pend_12')::uuid, uid, 'TREA de la cuenta Interbank',     'Para saber cuánto rinde el dinero parado.', null, 'operativo', 12),
    (md5(uid || 'pend_13')::uuid, uid, 'Fecha y monto comprometido con Piero', 'El cobro de S/ 500 está en mora y sin fecha.', 500.00, 'operativo', 13),
    (md5(uid || 'pend_14')::uuid, uid, 'Saldo de la cuenta sueldo Interbank', 'Sin este dato, "Puedes gastar" no se puede calcular.', null, 'critico', 14)
  on conflict (id) do update set
    title = excluded.title, detail = excluded.detail, amount = excluded.amount,
    priority = excluded.priority, sort_order = excluded.sort_order, deleted_at = null;

  -- =========================================================================
  -- 15. PLANES "SI… → ENTONCES…" (gatillos identificados en el perfil)
  -- =========================================================================
  delete from public.if_then_plans where user_id = uid;

  insert into public.if_then_plans (id, user_id, trigger_text, steps, sort_order)
  values
    (md5(uid || 'plan_1')::uuid, uid, 'SI recibo dinero extraordinario (CTS, gratificación, un cobro)',
     array['Registrar el ingreso', 'Separar las obligaciones del mes', 'Asignar a la deuda que toca según el plan',
           'Separar el ahorro', 'Recién entonces calcular el dinero libre'], 1),
    (md5(uid || 'plan_2')::uuid, uid, 'SI estoy triste y quiero gastar',
     array['Registrar la compra como gasto emocional ANTES de hacerla',
           'Ver su impacto en el mes', 'Decidir con ese número delante'], 2),
    (md5(uid || 'plan_3')::uuid, uid, 'SI voy a comprar algo no presupuestado',
     array['Esperar 24 horas', 'Volver a evaluarlo', 'Si sigue en pie, pagarlo con Yape o efectivo, nunca con tarjeta'], 3),
    (md5(uid || 'plan_4')::uuid, uid, 'SI me ofrecen un préstamo para "generar historial"',
     array['Recordar que ya tengo dos tarjetas activas que generan el mismo historial sin costo',
           'Recordar que ese malentendido costó S/ 2,569', 'Decir que no'], 4),
    (md5(uid || 'plan_5')::uuid, uid, 'SI se me libera línea de crédito al pagar',
     array['No es dinero disponible', 'No aumentar el gasto', 'Seguir con el plan del mes'], 5)
  on conflict (id) do update set
    trigger_text = excluded.trigger_text, steps = excluded.steps, deleted_at = null;

  raise notice 'Perfil financiero cargado correctamente para %', uid;
end $$;
