# Mi Finanzas

Plataforma de gestión financiera personal: no solo registra gastos, ayuda a
decidir. Persistencia permanente en PostgreSQL vía Supabase, autenticación
por usuario y Row Level Security en toda la información financiera.

La pregunta que responde cada pantalla no es "¿cuánto gasté?" sino
**"¿y ahora qué hago?"**.

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) para el análisis completo:
conflictos del prompt maestro y cómo se resolvieron, modelo de datos, motor
de reglas y estrategia de testing.

## Stack

- **Frontend:** React + TypeScript + Vite, React Router, React Hook Form +
  Zod, Tailwind CSS, Recharts.
- **Backend:** Supabase (PostgreSQL, Auth) con Row Level Security.
- **Tests:** Vitest + Testing Library (143 tests sobre la lógica financiera).
- **Deploy:** Vercel (frontend) + proyecto Supabase gestionado.

## Qué hace

| Sección | Responde |
|---|---|
| Inicio | ¿Cuánto puedo gastar hoy, esta semana, este mes? |
| Registrar | Gasto, ingreso o transferencia (con registro rápido en lenguaje natural) |
| Cuentas | ¿Cuánto dinero tengo realmente? |
| Me deben | ¿Cuánto me deben y quién? |
| Deudas y tarjetas | ¿Cuánto debo y qué ataco primero? |
| Presupuesto | ¿Estoy cumpliendo mi plan? ¿Voy camino a excederlo? |
| Metas | ¿Cómo voy con mi fondo de emergencia y mis objetivos? |
| ¿Qué debo hacer? | Tu próxima mejor acción, con el porqué |
| Mi situación | Seis indicadores de salud financiera, explicados |
| Calendario | ¿Qué pagos e ingresos vienen? |
| Pronóstico | ¿Qué pasará en 12 meses? ¿Qué pasa si…? |
| Reportes | ¿Cómo evolucioné? |
| Mis reglas | Las decisiones que ya tomé, por escrito |
| Configuración | Perfil, categorías, importación CSV y auditoría |

### Decisiones de producto que sostienen todo

- **Línea disponible ≠ dinero disponible.** El crédito libre nunca se
  presenta como capacidad de gasto.
- **Solo el ingreso realizado cuenta.** Lo esperado, estimado, pendiente o no
  verificado se ve, pero no suma al dinero disponible.
- **Los activos no verificados se marcan** y quedan fuera de la liquidez.
- **Los ingresos extraordinarios se asignan antes de recibirse**, para que no
  se sientan como dinero libre.
- **Nada de la lógica financiera está hardcodeada**: las reglas, umbrales y
  prioridades viven en la base de datos y se editan desde la app.
- **El motor de aprendizaje sugiere, nunca cambia solo** un presupuesto.

## Estructura

```text
src/
├── algorithms/     lógica financiera pura (sin UI ni DB), la parte más testeada
│   ├── accounts/     saldos y dinero disponible real
│   ├── debt/         amortización, estrategias, tarjetas
│   ├── budget/       plan vs. real vs. proyección, detección de recurrentes
│   ├── spendable/    "puedes gastar" y pagos próximos
│   ├── savings/      metas y fondo de emergencia
│   ├── networth/     patrimonio neto
│   ├── rules/        motor de reglas y próxima mejor acción
│   ├── learning/     ajustes aprendidos (sugeridos, no automáticos)
│   ├── forecast/     estadística y proyección a 12 meses
│   ├── health/       indicadores de situación financiera
│   ├── import/       parser CSV, mapeo y duplicados
│   └── quickadd/     interpretación de registro rápido
├── components/     UI reutilizable
├── pages/          una página por ruta
├── layouts/         AppShell (sidebar/bottom-nav) y ProtectedRoute
├── hooks/            useAuth, useTable (CRUD con auditoría), useFinancialOverview
├── lib/              cliente de Supabase
├── types/            tipos TS que reflejan el esquema
├── utils/             formateo de moneda/fecha
└── constants/          navegación

supabase/
├── migrations/         una migración por grupo de tablas, con RLS incluida
└── seed.sql             datos de ejemplo para desarrollo local

docs/
└── ARQUITECTURA.md       análisis, arquitectura y modelo de datos
```

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations/`
   (o usa `supabase db push` / `supabase start` con la CLI si prefieres
   trabajar localmente).
3. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` con los valores de **Project Settings → API**.

Al registrarte, un trigger crea tu perfil, tus categorías por defecto, las
reglas financieras base y los planes "SI… → ENTONCES…". El onboarding de
5 pasos completa el resto.

### 2. Instalar y correr

```bash
npm install
npm run dev
```

Con la CLI de Supabase, `supabase db reset` carga además un usuario demo
(`demo@mifinanzas.local` / `demo123456`) con un perfil financiero completo
para explorar la app con datos reales.

### 3. Verificación

```bash
npm run lint
npm test
npm run build
```

## Estado del proyecto

Las 10 fases del plan están completas y verificadas (lint sin errores,
143 tests en verde, build limpio):

| Fase | Contenido |
|---|---|
| 0 | Arquitectura, stack, Supabase, autenticación, RLS, diseño |
| 1 | Cuentas, ingresos, gastos, categorías, transferencias, onboarding |
| 2 | Deudas, tarjetas, amortización y simulador de liquidación |
| 3 | Presupuestos y gastos recurrentes |
| 4 | Dashboard y "puedes gastar" |
| 5 | Metas, fondo de emergencia, cuentas por cobrar, patrimonio |
| 6 | Motor de reglas, alertas, centro de decisiones, calendario |
| 7 | Pronóstico a 12 meses, escenarios y simulador "¿qué pasa si?" |
| 8 | Importación CSV con mapeo de columnas y detección de duplicados |
| 9 | Reportes, Mi situación, accesibilidad y pulido responsive |
