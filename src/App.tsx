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
const Envelopes = lazy(() => import('@/pages/Envelopes'))
const Analysis = lazy(() => import('@/pages/Analysis'))
const RecurringExpenses = lazy(() => import('@/pages/RecurringExpenses'))

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
            path="/sobres"
            element={
              <Suspense fallback={<PageFallback />}>
                <Envelopes />
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
            path="/gastos-recurrentes"
            element={
              <Suspense fallback={<PageFallback />}>
                <RecurringExpenses />
              </Suspense>
            }
          />
        </Route>
      </Route>
    </Routes>
  )
}
