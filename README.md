# Mi Finanzas

Plataforma de gestión financiera personal: no solo registra gastos, ayuda a
decidir. Persistencia permanente en PostgreSQL vía Supabase, autenticación
por usuario, RLS en toda la información financiera.

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) para el análisis
completo (conflictos del prompt maestro y su resolución, modelo de datos
por fases, motor de reglas, estrategia de testing).

## Stack

- **Frontend:** React + TypeScript + Vite, React Router, React Hook Form +
  Zod, Tailwind CSS, Recharts.
- **Backend:** Supabase (PostgreSQL, Auth) con Row Level Security.
- **Tests:** Vitest + Testing Library.
- **Deploy:** Vercel (frontend) + proyecto Supabase gestionado.

## Estructura

```text
src/
├── algorithms/     lógica financiera pura (sin UI ni DB), la parte más testeada
├── components/     UI reutilizable
├── pages/          una carpeta/archivo por ruta
├── layouts/         AppShell (sidebar/bottom-nav) y ProtectedRoute
├── hooks/            useAuth, etc.
├── lib/              cliente de Supabase
├── types/            tipos TS que reflejan el esquema de la base de datos
├── utils/             formateo de moneda/fecha
└── constants/          navegación, secciones, paleta

supabase/
├── migrations/         una migración SQL por grupo de tablas, con RLS incluida
└── seed.sql             datos de ejemplo para desarrollo local

docs/
└── ARQUITECTURA.md       análisis, arquitectura y modelo de datos completo
```

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en orden los archivos de `supabase/migrations/`
   (o usa `supabase db push` / `supabase start` con la CLI si prefieres
   trabajar localmente).
3. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` con los valores de **Project Settings → API**.

### 2. Instalar y correr

```bash
npm install
npm run dev
```

### 3. Verificación

```bash
npm run lint
npm test
npm run build
```

## Estado del proyecto

- ✅ **Fase 0 — Arquitectura:** estructura del proyecto, stack, Supabase,
  autenticación (registro/ingreso/sesión), esquema base (`profiles`,
  `audit_logs`) con RLS, sistema de diseño (paleta lila/lavanda) y layout
  responsive (sidebar de escritorio / bottom nav en mobile) con
  navegación completa a secciones aún vacías.
- ⏳ Fase 1 en adelante: ver `docs/ARQUITECTURA.md` sección 8.
