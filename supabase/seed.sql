-- Seed: perfil financiero inicial de Carmen Rosa Huamali.
--
-- CÓMO EJECUTAR:
-- 1. Crea tu cuenta primero desde la app (Registrarse) para que exista tu fila
--    en auth.users / profiles.
-- 2. Copia tu user id desde Supabase Studio (Authentication → Users).
-- 3. Ejecuta este archivo pasando ese id como variable, por ejemplo:
--      psql "$DATABASE_URL" -v user_id="'00000000-0000-0000-0000-000000000000'" -f supabase/seed.sql
--    (o pégalo en el SQL Editor de Supabase reemplazando :'user_id' por tu UUID real).
--
-- Principio seguido en todo este archivo: nunca inventar un dato desconocido.
-- Donde el monto real no se conoce con certeza, se deja NULL (columna) o se
-- registra como 'por_confirmar' / 'desactualizado' (memoria), nunca como 0.
-- Cualquier cifra calculada a partir de datos parciales se marca ESTIMADO
-- en el texto, nunca se guarda como si fuera un dato confirmado.

update public.profiles
set full_name = 'Carmen Rosa Huamali', currency = 'PEN', locale = 'es-PE', timezone = 'America/Lima'
where id = :'user_id';

-- ============================================================
-- Perfil y objetivos (memoria financiera, categoría "actual")
-- ============================================================
insert into public.financial_memory (user_id, memory_key, memory_value, confidence, source, status) values
  (:'user_id', 'perfil_demografico', '{"texto": "25 años, Lima, Perú, soltera. Plan de matrimonio estimado entre los 29 y 32 años."}', 0.9, 'usuario', 'actual'),
  (:'user_id', 'perfil_riesgo', '{"texto": "Riesgo medio. Prioridad: estabilidad antes que rentabilidad agresiva."}', 0.9, 'usuario', 'actual'),
  (:'user_id', 'objetivo_retiro', '{"texto": "Retiro objetivo a los 60 años, año 2062 (horizonte ~35 años)."}', 0.9, 'usuario', 'actual'),
  (:'user_id', 'objetivo_departamento', '{"texto": "Comprar departamento antes de los 30 años. Precio objetivo, cuota inicial y fecha exacta: por definir."}', 0.7, 'usuario', 'actual'),
  (:'user_id', 'prioridad_financiera', '{"texto": "1) Eliminar deuda cara y préstamos con fechas vencidas. 2) Comprar departamento antes de los 30. 3) Construir patrimonio para el retiro a los 60. Manteniendo siempre una reserva mínima de liquidez."}', 0.9, 'usuario', 'actual'),
  (:'user_id', 'regla_ingreso_inversion', '{"texto": "Los S/.230 mensuales de bonos/utilidades están destinados a inversión y NO deben considerarse dinero disponible para gasto."}', 0.95, 'usuario', 'actual'),
  (:'user_id', 'meta_fondo_emergencia', '{"texto": "Primera etapa: 1 mes de gastos esenciales. Luego ampliar a 3-6 meses. Monto exacto pendiente de calcular sobre gastos esenciales reales."}', 0.7, 'usuario', 'actual'),
  (:'user_id', 'deuda_rody', '{"texto": "Se le debe a Rody aproximadamente S/.1,400. Objetivo de pago: noviembre."}', 0.8, 'usuario', 'actual'),
  (:'user_id', 'prestamo_bancario_progreso', '{"texto": "Plazo original 18 meses, cuota aprox. S/.430/mes, vencimiento día 24. Van 2 de 18 cuotas pagadas (quedan 16). ESTIMADO de saldo pendiente: ~S/.6,880 (16 cuotas x S/.430, no incluye intereses, NO es el saldo real confirmado). Tasa de interés: por confirmar."}', 0.6, 'usuario', 'actual'),
  (:'user_id', 'tarjeta_principal_detalle', '{"texto": "Consumo total S/.3,851.43. Incluye un componente en USD (283.54) y otro en PEN (S/.2,883.14) — estas cifras no reconcilian exactamente entre sí, pendiente de aclarar con el estado de cuenta. Se realizó el pago mínimo, pero queda un saldo de S/.2,427.63 que debía pagarse el 20 de agosto y sigue vencido/sin pagar. Fecha de pago: día 20 de cada mes."}', 0.8, 'usuario', 'actual'),
  (:'user_id', 'tarjeta_secundaria_detalle', '{"texto": "Segunda tarjeta: consumo S/.943.14. Cierra el día 28 de cada mes; el pago correspondiente vence el día 25 del mes siguiente. Próximo vencimiento: 25 de septiembre."}', 0.8, 'usuario', 'actual')
on conflict do nothing;

-- ============================================================
-- Datos históricos / desactualizados — se conservan, pero NO deben
-- usarse como cifras actuales para ningún cálculo.
-- ============================================================
insert into public.financial_memory (user_id, memory_key, memory_value, confidence, source, status, effective_date) values
  (:'user_id', 'salario_mensual', '{"texto": "S/.2,000 (salario declarado en un registro anterior)."}', 0.5, 'usuario', 'historico', '2025-01-01'),
  (:'user_id', 'remuneracion_bruta_anterior', '{"texto": "S/.2,850 remuneración bruta declarada anteriormente."}', 0.4, 'usuario', 'desactualizado', '2025-01-01'),
  (:'user_id', 'compensacion_anual_objetivo', '{"texto": "S/.41,097 compensación anual objetivo declarada anteriormente."}', 0.4, 'usuario', 'desactualizado', '2025-01-01'),
  (:'user_id', 'ingreso_neto_aprox_anterior', '{"texto": "Aproximadamente S/.2,650 después de descuentos (dato anterior)."}', 0.4, 'usuario', 'desactualizado', '2025-01-01'),
  (:'user_id', 'bonos_semanales_anteriores', '{"texto": "Bonos semanales aproximados de S/.100 (dato anterior, sin confirmar vigencia)."}', 0.3, 'usuario', 'desactualizado', '2025-01-01'),
  (:'user_id', 'liquidez_ultima_conocida', '{"texto": "S/.73 disponibles (último dato conocido). NO usar como saldo actual sin confirmación."}', 0.3, 'usuario', 'desactualizado', current_date),
  (:'user_id', 'gasto_mascota_referencia', '{"texto": "Referencia: un saco de alimento para gatos de S/.198 dura aprox. 2 meses, para los dos gatos."}', 0.5, 'usuario', 'desactualizado', current_date),
  (:'user_id', 'receivable_cop_historico', '{"texto": "Registros en COP sin nombre de deudor confirmado: COP 80,000; luego COP 150,000; menos COP 10,500 pagados = COP 139,500 pendientes según el último cálculo. Ambiguo: falta confirmar a quién corresponde y si son montos acumulativos o revisiones del mismo saldo antes de crear el registro formal en Cuentas por Cobrar."}', 0.3, 'usuario', 'desactualizado', current_date)
on conflict do nothing;

-- ============================================================
-- Ingresos actuales declarados (memoria — el monto real de cada
-- transacción se registra aparte, en income_transactions, a medida
-- que ocurre; esto es la cifra "esperada" vigente).
-- ============================================================
insert into public.financial_memory (user_id, memory_key, memory_value, confidence, source, status) values
  (:'user_id', 'salario_mensual', '{"texto": "S/.2,600 (salario fijo declarado actual)."}', 0.9, 'usuario', 'actual'),
  (:'user_id', 'ingreso_consultoria_mensual', '{"texto": "Aproximadamente S/.600 por consultoría independiente. Variable, no garantizado."}', 0.7, 'usuario', 'actual'),
  (:'user_id', 'ingreso_potencial_total', '{"texto": "Ingreso potencial combinado aprox. S/.3,430 (S/.2,600 salario + S/.600 consultoría + S/.230 destinados a inversión). No tratar como dinero 100% disponible para gasto."}', 0.8, 'usuario', 'actual')
on conflict do nothing;

-- ============================================================
-- Fuentes de ingreso actuales (estructuradas)
-- ============================================================
insert into public.income_sources (user_id, name, is_recurring, source_type, frequency, earmarked_for, status) values
  (:'user_id', 'Salario fijo', true, 'fijo', 'mensual', null, 'actual'),
  (:'user_id', 'Consultoría independiente', true, 'variable', 'mensual', null, 'actual'),
  (:'user_id', 'Bonos/utilidades', true, 'destinado_especifico', 'irregular', 'inversion', 'actual')
on conflict do nothing;

-- ============================================================
-- Deudas
-- ============================================================
-- current_balance/original_amount/interest_rate NULL = por confirmar
-- (nunca asumir 0 cuando se desconoce). Van 2 de 18 cuotas pagadas del
-- préstamo bancario; el saldo exacto queda como ESTIMADO en financial_memory,
-- no aquí, porque esta columna es para el dato confirmado.
insert into public.debts (user_id, name, creditor, original_amount, current_balance, interest_rate, minimum_payment, due_day, currency, status, status_detail) values
  (:'user_id', 'Préstamo bancario', null, null, null, null, 430, 24, 'PEN', 'active', 'por_confirmar'),
  (:'user_id', 'Deuda personal', 'Rody', 1400, 1400, 0, null, null, 'PEN', 'active', 'confirmado')
on conflict do nothing;

-- ============================================================
-- Tarjetas de crédito
-- ============================================================
-- Tarjeta principal: consumo confirmado S/.3,851.43. El desglose USD/PEN y
-- el saldo vencido de S/.2,427.63 (debía pagarse el 20 de agosto) están en
-- financial_memory porque no reconcilian limpiamente en columnas numéricas.
-- Límite y tasa de interés: por confirmar.
insert into public.credit_cards (user_id, name, issuer, credit_limit, current_balance, payment_due_day, interest_rate, currency, status_detail) values
  (:'user_id', 'Tarjeta principal', null, null, 3851.43, 20, null, 'PEN', 'confirmado'),
  (:'user_id', 'Tarjeta secundaria', null, null, 943.14, 25, null, 'PEN', 'confirmado')
on conflict do nothing;

update public.credit_cards
set statement_day = 28
where user_id = :'user_id' and name = 'Tarjeta secundaria';

-- ============================================================
-- Categorías de gasto (incluye Mascotas como categoría independiente)
-- ============================================================
insert into public.expense_categories (user_id, name) values
  (:'user_id', 'Alimentación'),
  (:'user_id', 'Transporte'),
  (:'user_id', 'Mascotas'),
  (:'user_id', 'Vivienda'),
  (:'user_id', 'Servicios'),
  (:'user_id', 'Suscripciones'),
  (:'user_id', 'Deudas'),
  (:'user_id', 'Ahorro'),
  (:'user_id', 'Departamento'),
  (:'user_id', 'Inversiones'),
  (:'user_id', 'Retiro'),
  (:'user_id', 'Gastos personales'),
  (:'user_id', 'Ocio'),
  (:'user_id', 'Salud'),
  (:'user_id', 'Educación'),
  (:'user_id', 'Viajes'),
  (:'user_id', 'Gastos extraordinarios'),
  (:'user_id', 'Dinero libre')
on conflict (user_id, name) do nothing;

-- ============================================================
-- Alerta: pago de tarjeta principal vencido sin pagar
-- ============================================================
insert into public.financial_alerts (user_id, type, severity, title, message) values
  (:'user_id', 'due_date', 'critical', 'Pago de tarjeta vencido',
   'Tarjeta principal: queda un saldo de S/.2,427.63 que debía pagarse el 20 de agosto y sigue sin pagar (se hizo solo el pago mínimo).')
on conflict do nothing;
