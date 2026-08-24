# Mi Finanzas

Plataforma web de finanzas personales con persistencia permanente en la nube
(Supabase + PostgreSQL), autenticación por usuario y acceso desde cualquier
dispositivo (PC, celular, tablet).

## Stack

- **Frontend:** React + TypeScript + Vite, React Router, Tailwind CSS, Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Storage) con Row Level Security
- **Tests:** Vitest + Testing Library

## Estructura

```text
src/
├── components/     componentes de UI reutilizables
├── pages/          páginas (una por ruta)
├── layouts/        AppLayout (shell con nav) y ProtectedRoute
├── hooks/          useAuth, useSupabaseTable (CRUD genérico contra Supabase)
├── services/        (reservado para lógica de servicio adicional)
├── algorithms/      lógica financiera pura: budgeting, forecasting, debt,
│                     savings, audit, recommendations, memory
├── lib/             cliente de Supabase
├── types/           tipos TS que reflejan el esquema de la base de datos
├── utils/           formateo de moneda/fecha
└── constants/        navegación, etc.

supabase/
├── migrations/       una migración SQL por grupo de tablas, con RLS incluida
├── seed.sql          datos de ejemplo para desarrollo local
└── config.toml       configuración del proyecto Supabase local
```

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations/`
   (o usa `supabase db push` con la CLI de Supabase si prefieres trabajar
   localmente con `supabase start`).
3. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` con los valores de **Project Settings → API**.

### 2. Instalar y correr

```bash
npm install
npm run dev
```

### 3. Validar antes de cada entrega

```bash
npm run lint
npm test
npm run build
```

## Modelo de datos

25 tablas, todas con `user_id` y Row Level Security (cada usuario solo ve y
modifica sus propios datos): `profiles`, `accounts`, `income_sources`,
`income_transactions`, `expense_categories`, `expenses`, `recurring_expenses`,
`debts`, `debt_payments`, `credit_cards`, `credit_card_transactions`,
`receivables`, `receivable_payments`, `savings_goals`,
`savings_contributions`, `monthly_budgets`, `budget_categories`, `forecasts`,
`forecast_actuals`, `financial_alerts`, `financial_events`,
`financial_memory`, `financial_snapshots`, `recommendation_history`,
`learning_adjustments`, `uploaded_files`, `audit_logs`.

Al registrarse un usuario (`auth.users`), un trigger crea automáticamente su
fila en `profiles`. Los archivos subidos por el usuario se guardan en el
bucket privado `user-files` de Supabase Storage, particionado por `user_id`.

## Navegación (IA de 6 secciones)

La app está organizada según la pregunta que responde cada sección:

- **Dashboard** (`/`) → ¿Cómo estoy? KPIs, gráficos, cuentas, alertas.
- **Operación** → ¿Qué pasó? Ingresos, Gastos, Cuentas, Deudas, Tarjetas, Me deben.
- **Análisis** (`/analisis`) → ¿Por qué pasó? Evolución, distribución, flujo de
  caja, endeudamiento, presupuesto vs. real, con selector de período
  (Mes/3 meses/6 meses/Año/Personalizado). Forecast vive aquí también.
- **Planificación** → ¿Qué quiero lograr? Presupuestos, Sobres, Metas,
  Departamento, Retiro, Simulador.
- **Inteligencia** (`/inteligencia`) → ¿Qué debería hacer? Feed unificado de
  Auditor + Aprendizaje + Recomendaciones, más Memoria financiera, Documentos
  y Calendario.
- **Administración** → ¿Cómo configuro mi sistema? Categorías, Tipos de
  ingreso, Preferencias de perfil.

Cada página operativa tiene una barra de acciones contextual (`+ Nuevo`,
`Filtros`) con formulario colapsable y edición inline (click en un registro
para editarlo), en vez de un formulario siempre visible. También hay un
botón **"+ Registrar"** global en el header para agregar un ingreso/gasto
rápido desde cualquier pantalla.

## Estado actual (qué funciona hoy)

- ✅ Registro / inicio de sesión / cierre de sesión vía Supabase Auth
- ✅ Rutas protegidas: sin sesión, redirige a `/login`
- ✅ Persistencia real en PostgreSQL para Ingresos, Gastos, Cuentas, Deudas,
  Tarjetas de crédito, Cuentas por cobrar, Presupuestos y Metas de ahorro
  (crear, editar, filtrar por fecha, eliminar), disponible en cualquier
  dispositivo apenas se inicia sesión
- ✅ **Memoria financiera versionada**: registrar un nuevo hecho nunca borra
  el anterior (pasa a "histórico" automáticamente vía trigger). "Por
  confirmar" es un estado real (`NULL`), nunca se asume `S/.0`
- ✅ **Dashboard con gráficos reales (Recharts)**: patrimonio neto, liquidez
  desglosada, "¿cuánto puedo gastar?", tus cuentas, movimientos recientes,
  evolución ingresos vs. gastos (barras), gastos por categoría (dona),
  alertas financieras
- ✅ **Análisis**: los mismos gráficos con selector de período, más flujo de
  caja acumulado, endeudamiento por deuda y presupuesto vs. real
- ✅ Documentos: subida real a Supabase Storage con metadata en Postgres
- ✅ Sobres (envelope budgeting) por categoría de gasto, contra el
  presupuesto del mes
- ✅ Calculadoras dedicadas de 🏠 Departamento (contado/hipoteca/aumentar
  cuota/postergar) y 👵 Retiro (valor nominal vs. real ajustado por
  inflación) — **conectadas a tus metas de ahorro reales**: puedes vincular
  una meta y el ahorro actual se sincroniza con su saldo real, con un aporte
  mensual sugerido según tus últimas contribuciones
- ✅ Forecast a 12 meses (promedio móvil) + comparación forecast vs. real
  con error absoluto/porcentual
- ✅ 🧠 **Inteligencia unificada**: un solo feed con hallazgos del Auditor
  (gastos anormales, duplicados, presupuesto excedido, recurrentes vencidos,
  metas atrasadas, deuda nueva), sugerencias de Aprendizaje (basadas en tu
  historial real, requieren tu aprobación) y Recomendaciones explicables
  (motivo, datos usados, impacto, confianza)
- ✅ 🔮 Simulador "¿qué pasaría si...?" interactivo sobre deuda, departamento
  y retiro
- ✅ 📅 Calendario financiero del mes (agenda: ingresos, gastos,
  vencimientos, metas, cobros esperados)
- ✅ Diseño responsive lila/púrpura (móvil, tablet, escritorio) con nav
  inferior en móvil y sidebar agrupado en desktop
- ✅ Code-splitting por página (lazy loading) para que el login no cargue
  Recharts ni el resto de la app de entrada
- ✅ Módulos de `algorithms/` con lógica financiera real pero simple (sin
  IA compleja, tal como se pidió): forecasting, debt (snowball/avalanche),
  savings, budgeting, networth, goals (departamento/retiro), audit,
  learning, recommendations, memory, analytics (series de tiempo)

## Próximas fases (no implementadas todavía)

- Importar movimientos desde CSV/estado de cuenta (exportar es más simple y
  quedó pendiente de priorizar; importar requiere mapeo de columnas y
  detección de duplicados — se dejó fuera de este alcance a propósito)
- Pagos parciales de deudas/tarjetas/cuentas por cobrar como flujos dedicados
- Subcategorías, tipos de deuda, etiquetas y métodos de pago como catálogos
  propios en Administración (hoy solo existen Categorías, Tipos de ingreso
  y Preferencias, que es lo que el esquema actual soporta)
- OCR / lectura automática de documentos subidos (la arquitectura está
  lista — `uploaded_files` vinculable a cualquier registro — pero no hay
  extracción automática todavía)
- Alertas automáticas (`financial_alerts`) disparadas por triggers o jobs,
  hoy se generan bajo demanda desde Inteligencia
- Snapshots periódicos (`financial_snapshots`) vía cron/Edge Function
- Vista de calendario en formato grilla (hoy es una agenda cronológica)
- Despliegue continuo (Vercel/Netlify + Supabase) — este repo está listo para
  desplegarse en cualquiera de esas plataformas, pero el despliegue en sí no
  se ha ejecutado desde este entorno

## Notas de seguridad

- Nunca subas `.env.local` (ya está en `.gitignore`).
- Todas las tablas tienen RLS habilitado con políticas `auth.uid() = user_id`,
  así que la `anon key` (pública) es segura de exponer en el frontend.
