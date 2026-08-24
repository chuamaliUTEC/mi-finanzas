import { useMemo } from 'react'
import { StatCard } from '@/components/StatCard'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import type { Expense, IncomeTransaction } from '@/types/database'
import { formatCurrency } from '@/utils/format'

export default function Dashboard() {
  const { data: income, loading: loadingIncome } = useSupabaseTable<IncomeTransaction>(
    'income_transactions',
    { orderBy: 'received_at' },
  )
  const { data: expenses, loading: loadingExpenses } = useSupabaseTable<Expense>('expenses', {
    orderBy: 'spent_at',
  })

  const totals = useMemo(() => {
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount), 0)
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0)
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses }
  }, [income, expenses])

  const loading = loadingIncome || loadingExpenses

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Resumen</h2>
        <p className="text-sm text-gray-500">Vista general de tus finanzas registradas.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando datos…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Ingresos totales" value={formatCurrency(totals.totalIncome)} tone="positive" />
          <StatCard label="Gastos totales" value={formatCurrency(totals.totalExpenses)} tone="negative" />
          <StatCard
            label="Balance"
            value={formatCurrency(totals.balance)}
            tone={totals.balance >= 0 ? 'positive' : 'negative'}
          />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-700">Movimientos recientes</h3>
        {income.length === 0 && expenses.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no registras movimientos. Empieza agregando un ingreso o un gasto.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {[...income.slice(0, 5).map((i) => ({ ...i, kind: 'Ingreso' as const })), ...expenses
              .slice(0, 5)
              .map((e) => ({ ...e, kind: 'Gasto' as const }))]
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
              .slice(0, 8)
              .map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between py-2">
                  <span className="text-gray-600">
                    {item.kind}: {item.description || 'Sin descripción'}
                  </span>
                  <span className={item.kind === 'Ingreso' ? 'text-brand-600' : 'text-red-600'}>
                    {formatCurrency(Number(item.amount))}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
