import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { useEnvelopes } from '@/hooks/useEnvelopes'
import { lastNMonthBuckets, sumByMonth } from '@/algorithms/analytics/timeseries'
import { calculateBudgetVariance } from '@/algorithms/budgeting'
import { colorForIndex } from '@/utils/chartColors'
import { formatCurrency } from '@/utils/format'
import type { Debt, Expense, ExpenseCategory, IncomeTransaction } from '@/types/database'

type Period = 'mes' | '3m' | '6m' | 'año' | 'personalizado'

const PERIOD_MONTHS: Record<Exclude<Period, 'personalizado'>, number> = {
  mes: 1,
  '3m': 3,
  '6m': 6,
  año: 12,
}

export default function Analysis() {
  const [period, setPeriod] = useState<Period>('6m')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { data: income, loading: l1 } = useSupabaseTable<IncomeTransaction>('income_transactions')
  const { data: expenses, loading: l2 } = useSupabaseTable<Expense>('expenses')
  const { data: categories, loading: l3 } = useSupabaseTable<ExpenseCategory>('expense_categories')
  const { data: debts, loading: l4 } = useSupabaseTable<Debt>('debts')
  const { envelopes, loading: l5 } = useEnvelopes()

  const loading = l1 || l2 || l3 || l4 || l5

  const monthsBack = period === 'personalizado' ? 12 : PERIOD_MONTHS[period]
  const buckets = useMemo(() => lastNMonthBuckets(monthsBack), [monthsBack])

  const filteredIncome = useMemo(() => {
    if (period !== 'personalizado') return income
    return income.filter((i) => (!customFrom || i.received_at >= customFrom) && (!customTo || i.received_at <= customTo))
  }, [income, period, customFrom, customTo])
  const filteredExpenses = useMemo(() => {
    if (period !== 'personalizado') return expenses
    return expenses.filter((e) => (!customFrom || e.spent_at >= customFrom) && (!customTo || e.spent_at <= customTo))
  }, [expenses, period, customFrom, customTo])

  const evolutionData = useMemo(() => {
    const incomeTotals = sumByMonth(
      filteredIncome.map((i) => ({ date: i.received_at, amount: Number(i.amount) })),
      buckets,
    )
    const expenseTotals = sumByMonth(
      filteredExpenses.map((e) => ({ date: e.spent_at, amount: Number(e.amount) })),
      buckets,
    )
    let running = 0
    return buckets.map((b, i) => {
      running += incomeTotals[i] - expenseTotals[i]
      return {
        mes: b.label,
        Ingresos: incomeTotals[i],
        Gastos: expenseTotals[i],
        'Flujo acumulado': running,
      }
    })
  }, [filteredIncome, filteredExpenses, buckets])

  const categoryBreakdown = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const e of filteredExpenses) {
      const key = e.category_id ?? 'sin-categoria'
      byCategory.set(key, (byCategory.get(key) ?? 0) + Number(e.amount))
    }
    return Array.from(byCategory.entries())
      .map(([categoryId, total]) => ({
        name: categories.find((c) => c.id === categoryId)?.name ?? 'Sin categoría',
        value: total,
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses, categories])

  const debtData = useMemo(
    () =>
      debts
        .filter((d) => d.status === 'active' && d.current_balance !== null)
        .map((d) => ({ name: d.name, Saldo: Number(d.current_balance) })),
    [debts],
  )

  const budgetVsReal = useMemo(() => {
    if (envelopes.length === 0) return []
    return calculateBudgetVariance(
      envelopes.map((e) => ({
        id: e.categoryId,
        user_id: '',
        budget_id: '',
        category_id: e.categoryId,
        planned_amount: e.planned,
        created_at: '',
        updated_at: '',
      })),
      expenses,
    )
      .filter((v) => v.planned > 0 || v.actual > 0)
      .map((v) => ({
        name: categories.find((c) => c.id === v.categoryId)?.name ?? 'Sin categoría',
        Planeado: v.planned,
        Real: v.actual,
      }))
  }, [envelopes, expenses, categories])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">📊 Análisis</h2>
          <p className="text-sm text-gray-500">Evolución, distribución, endeudamiento y presupuesto vs. real.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-md bg-gray-100 p-1 text-sm">
          {(['mes', '3m', '6m', 'año', 'personalizado'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                period === p ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {p === 'mes' ? 'Mes' : p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : p === 'año' ? 'Año' : 'Personalizado'}
            </button>
          ))}
        </div>
      </div>

      {period === 'personalizado' && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
          <div>
            <label className="block text-xs font-medium text-gray-600">Desde</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Hasta</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Evolución ingresos vs. gastos</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={50} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#8b46e8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Flujo de caja acumulado</h3>
            <p className="mb-2 text-xs text-gray-400">
              Ingresos menos gastos acumulados en el período. No incluye deudas ni metas.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={50} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Line type="monotone" dataKey="Flujo acumulado" stroke="#8b46e8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Distribución de gastos</h3>
            {categoryBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500">Sin gastos en este período.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {categoryBreakdown.map((_, i) => (
                        <Cell key={i} fill={colorForIndex(i)} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Endeudamiento (saldo actual conocido)</h3>
            {debtData.length === 0 ? (
              <p className="text-sm text-gray-500">Sin deudas con saldo confirmado.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={debtData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="Saldo" fill="#f87171" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Presupuesto vs. real (mes actual)</h3>
            {budgetVsReal.length === 0 ? (
              <p className="text-sm text-gray-500">
                Sin sobres configurados este mes. Ve a Planificación → Sobres para asignar presupuesto por categoría.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={budgetVsReal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={50} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="Planeado" fill="#c084fc" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Real" fill="#8b46e8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
