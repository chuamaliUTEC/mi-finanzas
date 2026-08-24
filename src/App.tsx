import { Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/layouts/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Dashboard from '@/pages/Dashboard'
import Income from '@/pages/Income'
import Expenses from '@/pages/Expenses'
import Debts from '@/pages/Debts'
import CreditCards from '@/pages/CreditCards'
import Budgets from '@/pages/Budgets'
import SavingsGoals from '@/pages/SavingsGoals'
import Receivables from '@/pages/Receivables'
import Documents from '@/pages/Documents'
import FinancialMemoryPage from '@/pages/FinancialMemory'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ingresos" element={<Income />} />
          <Route path="/gastos" element={<Expenses />} />
          <Route path="/deudas" element={<Debts />} />
          <Route path="/tarjetas" element={<CreditCards />} />
          <Route path="/presupuestos" element={<Budgets />} />
          <Route path="/metas" element={<SavingsGoals />} />
          <Route path="/me-deben" element={<Receivables />} />
          <Route path="/documentos" element={<Documents />} />
          <Route path="/memoria" element={<FinancialMemoryPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
