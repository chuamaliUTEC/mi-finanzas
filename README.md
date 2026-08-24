# Mi Finanzas

Plataforma web de finanzas personales con persistencia permanente en la nube
(Supabase + PostgreSQL), autenticación por usuario y acceso desde cualquier
dispositivo (PC, celular, tablet).

## Stack

- **Frontend:** React + TypeScript + Vite, React Router, Tailwind CSS
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

## Estado actual (qué funciona hoy)

- ✅ Registro / inicio de sesión / cierre de sesión vía Supabase Auth
- ✅ Rutas protegidas: sin sesión, redirige a `/login`
- ✅ Persistencia real en PostgreSQL para Ingresos, Gastos, Deudas, Tarjetas
  de crédito, Presupuestos mensuales y Metas de ahorro (crear, listar,
  eliminar), disponible en cualquier dispositivo apenas se inicia sesión
- ✅ Dashboard con totales de ingresos/gastos/balance y movimientos recientes
- ✅ Diseño responsive (móvil, tablet, escritorio)
- ✅ Módulos de `algorithms/` con lógica financiera real pero simple
  (promedio móvil para forecasting, snowball/avalanche para deudas,
  progreso de metas, varianza de presupuesto, recomendaciones basadas en
  reglas, memoria clave/valor) — sin IA compleja, tal como se pidió
- ✅ `audit_logs` con helper para registrar acciones

## Próximas fases (no implementadas todavía)

- Edición inline de registros existentes (hoy: crear y eliminar)
- Pagos parciales de deudas/tarjetas/cuentas por cobrar como flujos dedicados
- Carga de archivos (recibos, estados de cuenta) contra el bucket `user-files`
- Alertas automáticas (`financial_alerts`) disparadas por triggers o jobs
- Snapshots periódicos (`financial_snapshots`) vía cron/Edge Function
- Despliegue continuo (Vercel/Netlify + Supabase) — este repo está listo para
  desplegarse en cualquiera de esas plataformas, pero el despliegue en sí no
  se ha ejecutado desde este entorno

## Notas de seguridad

- Nunca subas `.env.local` (ya está en `.gitignore`).
- Todas las tablas tienen RLS habilitado con políticas `auth.uid() = user_id`,
  así que la `anon key` (pública) es segura de exponer en el frontend.
