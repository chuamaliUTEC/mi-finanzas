import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/layouts/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'

// Charts (Recharts) and the rest of the app are the bulk of the bundle —
// lazy-load every authenticated page so the login screen stays light.
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Income = lazy(() => import('@/pages/Income'))
const Expenses = lazy(() => import('@/pages/Expenses'))
const Debts = lazy(() => import('@/pages/Debts'))
const CreditCards = lazy(() => import('@/pages/CreditCards'))
const Budgets = lazy(() => import('@/pages/Budgets'))
const SavingsGoals = lazy(() => import('@/pages/SavingsGoals'))
const Receivables = lazy(() => import('@/pages/Receivables'))
const Documents = lazy(() => import('@/pages/Documents'))
const FinancialMemoryPage = lazy(() => import('@/pages/FinancialMemory'))
const Envelopes = lazy(() => import('@/pages/Envelopes'))
const Departamento = lazy(() => import('@/pages/Departamento'))
const Retiro = lazy(() => import('@/pages/Retiro'))
const ForecastPage = lazy(() => import('@/pages/Forecast'))
const Intelligence = lazy(() => import('@/pages/Intelligence'))
const Simulator = lazy(() => import('@/pages/Simulator'))
const CalendarPage = lazy(() => import('@/pages/Calendar'))
const Accounts = lazy(() => import('@/pages/Accounts'))
const Categories = lazy(() => import('@/pages/admin/Categories'))
const IncomeTypes = lazy(() => import('@/pages/admin/IncomeTypes'))
const Preferences = lazy(() => import('@/pages/admin/Preferences'))
const Analysis = lazy(() => import('@/pages/Analysis'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))

function PageFallback() {
  return <p className="p-6 text-sm text-gray-500">Cargando…</p>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<PageFallback />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="/ingresos"
            element={
              <Suspense fallback={<PageFallback />}>
                <Income />
              </Suspense>
            }
          />
          <Route
            path="/gastos"
            element={
              <Suspense fallback={<PageFallback />}>
                <Expenses />
              </Suspense>
            }
          />
          <Route
            path="/deudas"
            element={
              <Suspense fallback={<PageFallback />}>
                <Debts />
              </Suspense>
            }
          />
          <Route
            path="/tarjetas"
            element={
              <Suspense fallback={<PageFallback />}>
                <CreditCards />
              </Suspense>
            }
          />
          <Route
            path="/presupuestos"
            element={
              <Suspense fallback={<PageFallback />}>
                <Budgets />
              </Suspense>
            }
          />
          <Route
            path="/metas"
            element={
              <Suspense fallback={<PageFallback />}>
                <SavingsGoals />
              </Suspense>
            }
          />
          <Route
            path="/me-deben"
            element={
              <Suspense fallback={<PageFallback />}>
                <Receivables />
              </Suspense>
            }
          />
          <Route
            path="/documentos"
            element={
              <Suspense fallback={<PageFallback />}>
                <Documents />
              </Suspense>
            }
          />
          <Route
            path="/memoria"
            element={
              <Suspense fallback={<PageFallback />}>
                <FinancialMemoryPage />
              </Suspense>
            }
          />
          <Route
            path="/sobres"
            element={
              <Suspense fallback={<PageFallback />}>
                <Envelopes />
              </Suspense>
            }
          />
          <Route
            path="/departamento"
            element={
              <Suspense fallback={<PageFallback />}>
                <Departamento />
              </Suspense>
            }
          />
          <Route
            path="/retiro"
            element={
              <Suspense fallback={<PageFallback />}>
                <Retiro />
              </Suspense>
            }
          />
          <Route
            path="/forecast"
            element={
              <Suspense fallback={<PageFallback />}>
                <ForecastPage />
              </Suspense>
            }
          />
          <Route
            path="/inteligencia"
            element={
              <Suspense fallback={<PageFallback />}>
                <Intelligence />
              </Suspense>
            }
          />
          <Route
            path="/simulador"
            element={
              <Suspense fallback={<PageFallback />}>
                <Simulator />
              </Suspense>
            }
          />
          <Route
            path="/calendario"
            element={
              <Suspense fallback={<PageFallback />}>
                <CalendarPage />
              </Suspense>
            }
          />
          <Route
            path="/cuentas"
            element={
              <Suspense fallback={<PageFallback />}>
                <Accounts />
              </Suspense>
            }
          />
          <Route
            path="/admin/categorias"
            element={
              <Suspense fallback={<PageFallback />}>
                <Categories />
              </Suspense>
            }
          />
          <Route
            path="/admin/ingresos"
            element={
              <Suspense fallback={<PageFallback />}>
                <IncomeTypes />
              </Suspense>
            }
          />
          <Route
            path="/admin/preferencias"
            element={
              <Suspense fallback={<PageFallback />}>
                <Preferences />
              </Suspense>
            }
          />
          <Route
            path="/analisis"
            element={
              <Suspense fallback={<PageFallback />}>
                <Analysis />
              </Suspense>
            }
          />
          <Route
            path="/cuestionario"
            element={
              <Suspense fallback={<PageFallback />}>
                <Onboarding />
              </Suspense>
            }
          />
        </Route>
      </Route>
    </Routes>
  )
}
