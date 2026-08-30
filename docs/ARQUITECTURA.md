# Mi Finanzas — Análisis y arquitectura

Documento de diseño previo a la construcción, según el prompt maestro. Se
actualiza a medida que avanzan las fases; no es una foto fija.

## 1. Conflictos y ambigüedades detectados en el prompt, y su resolución

1. **Datos de Carmen vs. "no hardcodear" (secc. 2-32 vs. secc. 40).**
   Los montos, deudas, tarjetas, etc. del perfil inicial se cargan como
   **seed data** (filas insertadas para un usuario demo/inicial vía
   `supabase/seed.sql` u onboarding), nunca como ramas de código
   (`if user === 'Carmen'`). Toda regla financiera vive en tablas
   (`financial_rules`, `debt.priority`, `budget_categories`, etc.) y se
   evalúa con datos, no con nombres de usuario.

2. **"Puedes gastar" (secc. 12) depende de módulos que no existen hasta
   fases posteriores** (presupuesto, metas/ahorro comprometido, deudas).
   Se implementa como una función de cálculo pura
   (`computeSpendable()`) que en Fase 4 solo usa lo disponible
   (saldo, pagos próximos) y va incorporando términos (presupuesto
   protegido, ahorro comprometido) a medida que Fase 3 y Fase 5 aportan
   los datos. La función siempre indica qué componentes usó, para que la
   UI nunca finja precisión que no tiene.

3. **Multi-moneda (PEN base, tarjetas con saldo USD).** No se hace
   conversión automática de FX en v1: cada cuenta/tarjeta/movimiento
   guarda su propia moneda (`currency`), y los agregados solo suman
   valores de la misma moneda. Un campo `fx_rate` opcional queda
   preparado para cuando se quiera consolidar, pero no se usa aún.
   Evita inventar una tasa de cambio no solicitada.

4. **Amortización de deudas (cuotas, capital vs. interés, TCEA/TEA).**
   Se modela con un motor de amortización francés puro en
   `src/algorithms/debt/amortization.ts`, testeado con los números de
   ejemplo del prompt (Compartamos: 18 cuotas, S/ 430, seguro S/ 13.44).
   `debt_payments` guarda el desglose real capital/interés/seguro/mora
   de cada pago para no depender solo de la proyección teórica.

5. **"Línea disponible ≠ dinero disponible" y "pago anticipado vs.
   adelantado".** Son conceptos de UI y de dominio, no solo de copy:
   se modelan como campos explícitos (`credit_cards.available_credit`
   vs. `accounts` de efectivo real; `debts.allows_early_payoff_discount`
   con estado `UNKNOWN|YES|NO`) para que el motor de reglas y el
   dashboard nunca los confundan.

6. **Motor de aprendizaje (secc. 45) no debe modificar presupuestos
   solo.** Se implementa como generador de *sugerencias*
   (`learning_adjustments`, estado `pending|accepted|dismissed`); nunca
   escribe directo sobre `budget_categories`.

7. **Orden de fases con dependencias cruzadas** (alertas necesitan
   presupuesto y deuda; forecasting necesita histórico). Se respeta el
   orden 0→9 del prompt; los módulos de Fase 6-7 se construyen sobre
   vistas/funciones ya probadas de fases anteriores, no se adelantan.

## 2. Arquitectura

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + React
  Router + React Hook Form + Zod + Recharts.
- **Backend:** Supabase (PostgreSQL + Auth + Storage), Row Level
  Security en todas las tablas de usuario, sin servidor propio: el
  frontend habla directo con Supabase mediante `@supabase/supabase-js`
  usando el token de sesión del usuario. Lógica financiera pura
  (cálculos, forecasting, motor de reglas) vive en TypeScript del lado
  cliente en `src/algorithms/`, testeada de forma aislada, para poder
  reusarse también desde Postgres functions si en el futuro hace falta
  mover cálculos al servidor.
- **Auth:** Supabase Auth (email + password). `profiles` extiende
  `auth.users` 1:1. Todas las tablas financieras tienen `user_id uuid
  references auth.users(id)` + política RLS `auth.uid() = user_id`.
- **Deploy:** Vercel (frontend estático) + proyecto Supabase gestionado.
- **Persistencia:** PostgreSQL vía Supabase es la única fuente de
  verdad. No se usa localStorage para datos financieros (solo, como
  mucho, preferencias de UI no sensibles).

## 3. Estructura de carpetas

```text
src/
├── algorithms/        lógica financiera pura (sin dependencias de UI/DB)
│   ├── spendable/      "puedes gastar"
│   ├── debt/           amortización, avalancha/bola de nieve, TCEA
│   ├── budget/         real vs. plan, proyección de cierre
│   ├── forecast/       series de tiempo, escenarios
│   ├── networth/       patrimonio neto
│   └── rules/          motor de reglas declarativo
├── components/         UI reutilizable (botones, cards, gráficos, etc.)
│   ├── ui/              primitivos de diseño
│   └── charts/          wrappers de Recharts
├── pages/               una carpeta por sección de navegación
├── layouts/              AppShell (sidebar/bottom-nav), ProtectedRoute
├── hooks/                useAuth, useSupabaseQuery, etc.
├── lib/                  cliente Supabase, query keys
├── types/                tipos generados/reflejo del esquema
├── utils/                formato moneda/fecha, helpers
└── constants/            navegación, paleta, categorías por defecto

supabase/
├── migrations/           una migración por grupo de tablas (con RLS)
└── seed.sql              datos de ejemplo/perfil inicial (dev only)

tests/
├── algorithms/           tests unitarios de la lógica pura (prioridad)
└── components/           tests de integración de UI crítica

docs/
└── ARQUITECTURA.md        este documento
```

## 4. Modelo de datos (visión completa, se implementa por fases)

Convenciones en todas las tablas de usuario: `id uuid default
gen_random_uuid() primary key`, `user_id uuid not null references
auth.users(id) on delete cascade`, `created_at timestamptz not null
default now()`, `updated_at timestamptz not null default now()`
(trigger `set_updated_at`), `deleted_at timestamptz` (soft delete) en
tablas donde borrar afecta historial (deudas, movimientos, metas,
cuentas); índices en `user_id` y en columnas de fecha usadas para
filtrar/ordenar. RLS: `USING (auth.uid() = user_id)` en SELECT/UPDATE/
DELETE, `WITH CHECK (auth.uid() = user_id)` en INSERT.

| Fase | Tablas |
|---|---|
| 0 | `profiles`, `audit_logs` |
| 1 | `accounts`, `income_sources`, `income_transactions`, `expense_categories`, `expense_subcategories`, `expenses`, `transfers` |
| 2 | `debts`, `debt_payments`, `credit_cards`, `credit_card_transactions`, `debt_payoff_plans` |
| 3 | `monthly_budgets`, `budget_categories`, `recurring_expenses` |
| 4 | vistas materializadas/funciones de agregación para dashboard (sin tablas nuevas) |
| 5 | `savings_goals`, `savings_contributions`, `emergency_fund_stages`, `receivables`, `receivable_payments` |
| 6 | `financial_alerts`, `financial_rules`, `financial_events`, `if_then_plans`, `learning_adjustments` |
| 7 | `forecasts`, `forecast_actuals`, `spending_patterns` |
| 8 | `import_batches`, `import_mappings` |
| — | `assets` (Fase 5, patrimonio), `extraordinary_incomes` (Fase 1, con `allocation_plan`) |

Relaciones clave: `expenses.category_id → expense_categories`,
`expenses.subcategory_id → expense_subcategories`,
`expenses.account_id → accounts`, `expenses.credit_card_id →
credit_cards` (nullable), `debt_payments.debt_id → debts`,
`credit_card_transactions.credit_card_id → credit_cards`,
`budget_categories.budget_id → monthly_budgets`,
`budget_categories.category_id → expense_categories`,
`savings_contributions.goal_id → savings_goals`,
`receivable_payments.receivable_id → receivables`,
`audit_logs` referencia genérica (`entity_type text, entity_id uuid`)
para no acoplarse a una tabla.

Constraints relevantes: `expenses.amount > 0`, `expenses.type in
('ingreso','gasto','transferencia')`, `debts.status in
('activa','pagada','en_mora','congelada')`,
`income_transactions.confidence in ('alta','media','baja')`,
`income_transactions.verification_status in
('realizado','esperado','estimado','pendiente','no_verificado')` (regla
de la secc. 3: nunca se suman a "dinero disponible" salvo
`realizado`).

## 5. Flujo de usuario y navegación

Onboarding (9 pasos, secc. 41) → Dashboard. Navegación principal
(desktop: sidebar; mobile: bottom nav con Inicio/Registrar/Deudas/
Metas/Más):

Inicio · Registrar · Cuentas · Deudas y Tarjetas · Presupuesto · Metas
· Centro de Decisiones · Calendario · Pronóstico · Reportes · Mis
Reglas · Configuración.

Principio UX (secc. 13/49): cada pantalla responde **una** pregunta
central primero, con detalle progresivo debajo — nunca un dashboard
saturado de entrada.

## 6. Motor de reglas financieras

Tabla `financial_rules`: `condition_type`, `condition_params jsonb`,
`action_type`, `action_params jsonb`, `enabled boolean`,
`is_system boolean` (reglas base editables) vs. reglas personales del
usuario (secc. 24-25). El evaluador (`src/algorithms/rules/engine.ts`)
es una función pura `evaluateRules(rules, financialSnapshot) →
Alert[]`, sin condiciones de negocio hardcodeadas: cada regla del prompt
(deuda.TEA > 20 %, tarjeta.utilización > 30 %, etc.) es una fila de
seed, no una condición en TypeScript.

## 7. Estrategia de testing

Prioridad en `src/algorithms/*` (funciones puras, sin IO): saldo,
dinero gastable, intereses/amortización, utilización de tarjeta,
presupuesto real vs. plan, forecast, patrimonio neto, fechas de
vencimiento, ingresos extraordinarios (no contar como disponibles),
transferencias (no duplicar en ingresos/gastos), detección de
duplicados en importación. Cada fase se da por terminada solo cuando
`npm run lint`, `npm test` y `npm run build` pasan limpio, y (desde
que exista backend real) las políticas RLS se verifican con al menos
un test de "usuario A no puede leer datos de usuario B".

## 8. Plan de fases

Las 10 fases están completas. Cada una se construyó, se verificó
(lint + tests + build en verde) y se documentó antes de empezar la
siguiente, según pedía el prompt maestro.

| Fase | Entregado | Tests acumulados |
|---|---|---|
| 0 | Arquitectura, auth, RLS, diseño, layout responsive | 4 |
| 1 | Núcleo financiero + onboarding + registro rápido | 15 |
| 2 | Deudas, tarjetas, amortización, estrategias | 36 |
| 3 | Presupuesto, proyección al cierre, recurrentes | 45 |
| 4 | Dashboard y "puedes gastar" | 55 |
| 5 | Metas, fondo de emergencia, por cobrar, patrimonio | 63 |
| 6 | Motor de reglas, decisiones, aprendizaje, calendario | 91 |
| 7 | Forecasting, escenarios, simulador | 110 |
| 8 | Importación CSV, mapeo, duplicados | 136 |
| 9 | Reportes, Mi situación, accesibilidad | 143 |

### Decisiones tomadas durante la construcción

Además de los conflictos resueltos en la sección 1, aparecieron estas
decisiones al implementar:

1. **Las compras con tarjeta no se duplican.** El prompt pedía una tabla
   `credit_card_transactions`, pero una compra con tarjeta ya es un
   gasto: se modela como `expenses.credit_card_id`. Duplicarla en dos
   tablas garantizaría que tarde o temprano difieran.

2. **La utilización de una tarjeta se deriva de sus deudas vinculadas**
   (`debts.credit_card_id`), no se guarda como número aparte. Así pagar
   la deuda baja la utilización automáticamente, sin dos cifras que
   puedan contradecirse.

3. **Ningún saldo se almacena.** Cuentas, deudas, metas y cuentas por
   cobrar calculan su saldo desde los movimientos. Es más lento de
   consultar, pero elimina la clase entera de bugs donde el saldo
   guardado y los movimientos dejan de cuadrar.

4. **Una fecha comprometida pesa más que la tasa** en la prioridad
   dinámica de deudas. Incumplir una fecha dada a otra persona tiene un
   costo que no se mide en TEA; por eso una deuda al 0 % que vence en un
   mes va antes que una al 62 % sin fecha, igual que en el plan del
   propio prompt (octubre = Rody).

5. **Los recurrentes sin fecha de cobro conocida se reservan igual** en
   el cálculo de "puedes gastar". Es la opción conservadora: es peor
   decirle a alguien que puede gastar dinero que en realidad ya está
   comprometido.

6. **Los duplicados de importación exigen coincidencia de descripción**,
   no solo fecha y monto. Dos pasajes de S/ 5 el mismo día son dos
   gastos reales, no un duplicado.

7. **El pronóstico usa la mediana cuando detecta meses atípicos** y la
   media ponderada cuando la serie es limpia, para que un mes
   excepcional no arrastre 12 meses de proyección. Con menos de dos
   meses cerrados usa lo declarado y lo dice en la interfaz, en vez de
   fingir precisión.

8. **La puntuación de "Mi situación" se presenta como orientativa** y
   cada indicador explica qué significa y cómo mejora — nunca como
   diagnóstico ni como score crediticio.
