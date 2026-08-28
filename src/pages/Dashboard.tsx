import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/hooks/useAuth'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { calculateLiquidity, calculateNetWorth } from '@/algorithms/networth'
import { calculateSpendable } from '@/algorithms/budgeting/spendable'
import { lastNMonthBuckets, sumByMonth } from '@/algorithms/analytics/timeseries'
import { colorForIndex } from '@/utils/chartColors'
import type {
  Account,
  CreditCard,
  Debt,
  Expense,
  ExpenseCategory,
  FinancialAlert,
  IncomeTransaction,
  Receivable,
  SavingsGoal,
} from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'

const ALERT_SEVERITY_ICON: Record<FinancialAlert['severity'], string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
}

export default function Dashboard() {
  const { user } = useAuth()
  const { data: income, loading: l1 } = useSupabaseTable<IncomeTransaction>('income_transactions', {
    orderBy: 'received_at',
  })
  const { data: expenses, loading: l2 } = useSupabaseTable<Expense>('expenses', { orderBy: 'spent_at' })
  const { data: accounts, loading: l3 } = useSupabaseTable<Account>('accounts')
  const { data: receivables, loading: l4 } = useSupabaseTable<Receivable>('receivables')
  const { data: savingsGoals, loading: l5 } = useSupabaseTable<SavingsGoal>('savings_goals')
  const { data: debts, loading: l6 } = useSupabaseTable<Debt>('debts')
  const { data: creditCards, loading: l7 } = useSupabaseTable<CreditCard>('credit_cards')
  const { data: categories, loading: l8 } = useSupabaseTable<ExpenseCategory>('expense_categories')
  const { data: alerts, loading: l9 } = useSupabaseTable<FinancialAlert>('financial_alerts', {
    orderBy: 'created_at',
    ascending: false,
  })
  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7 || l8 || l9

  const firstName = user?.email?.split('@')[0] ?? ''

  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const monthIncome = useMemo(
    () => income.filter((i) => i.received_at.startsWith(currentMonthKey)).reduce((s, i) => s + Number(i.amount), 0),
    [income, currentMonthKey],
  )
  const monthExpenses = useMemo(
    () => expenses.filter((e) => e.spent_at.startsWith(currentMonthKey)).reduce((s, e) => s + Number(e.amount), 0),
    [expenses, currentMonthKey],
  )

  const totals = useMemo(() => {
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount), 0)
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0)
    return { balance: totalIncome - totalExpenses }
  }, [income, expenses])

  const netWorth = useMemo(
    () => calculateNetWorth(accounts, receivables, savingsGoals, debts, creditCards),
    [accounts, receivables, savingsGoals, debts, creditCards],
  )

  const liquidity = useMemo(() => {
    const cashOnHand = accounts.reduce((sum, a) => sum + Number(a.opening_balance), 0) + totals.balance
    return calculateLiquidity({ cashOnHand, committedThisMonth: 0, savingsGoals, receivables, invested: 0 })
  }, [accounts, totals.balance, savingsGoals, receivables])

  const spendable = useMemo(
    () =>
      calculateSpendable({
        liquidity: liquidity.disponible,
        reliableIncome: 0,
        essentialExpenses: 0,
        debtPayments: 0,
        savingsTarget: 0,
        goalContributions: 0,
        safetyMargin: 0,
      }),
    [liquidity],
  )

  const evolutionData = useMemo(() => {
    const buckets = lastNMonthBuckets(6)
    const incomeTotals = sumByMonth(
      income.map((i) => ({ date: i.received_at, amount: Number(i.amount) })),
      buckets,
    )
    const expenseTotals = sumByMonth(
      expenses.map((e) => ({ date: e.spent_at, amount: Number(e.amount) })),
      buckets,
    )
    return buckets.map((b, i) => ({ mes: b.label, Ingresos: incomeTotals[i], Gastos: expenseTotals[i] }))
  }, [income, expenses])

  const categoryBreakdown = useMemo(() => {
    const monthExpensesList = expenses.filter((e) => e.spent_at.startsWith(currentMonthKey))
    const byCategory = new Map<string, number>()
    for (const e of monthExpensesList) {
      const key = e.category_id ?? 'sin-categoria'
      byCategory.set(key, (byCategory.get(key) ?? 0) + Number(e.amount))
    }
    return Array.from(byCategory.entries())
      .map(([categoryId, total]) => ({
        name: categories.find((c) => c.id === categoryId)?.name ?? 'Sin categoría',
        value: total,
      }))
      .sort((a, b) => b.value - a.value)
  }, [expenses, categories, currentMonthKey])

  const accountRows = useMemo(() => {
    const debtRows = debts
      .filter((d) => d.status === 'active')
      .map((d) => ({ id: d.id, name: d.name, amount: d.current_balance, negative: true }))
    const cardRows = creditCards.map((c) => ({ id: c.id, name: c.name, amount: c.current_balance, negative: true }))
    const accountRowsList = accounts.map((a) => ({ id: a.id, name: a.name, amount: a.opening_balance, negative: false }))
    return [...accountRowsList, ...debtRows, ...cardRows]
  }, [accounts, debts, creditCards])

  const unreadAlerts = alerts.filter((a) => !a.is_read).slice(0, 4)

  const cardDebt = useMemo(() => {
    const known = creditCards.filter((c) => c.current_balance !== null)
    const total = known.reduce((sum, c) => sum + Number(c.current_balance), 0)
    return { total, hasUnknown: known.length < creditCards.length, count: creditCards.length }
  }, [creditCards])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Hola{firstName ? `, ${firstName}` : ''} 👋</h2>
        <p className="text-sm text-gray-500">Así está tu situación financiera hoy.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando datos…</p>
      ) : (
        <>
          {cardDebt.count > 0 && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                La cifra única · cuánto debes en tarjetas hoy
              </p>
              <p className="mt-1 text-3xl font-semibold text-brand-800">
                {formatCurrency(cardDebt.total)}
                {cardDebt.hasUnknown && ' *'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Si este mes es menor que el anterior, vas bien.
                {cardDebt.hasUnknown && ' * hay una tarjeta con saldo por confirmar, no incluida.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Puedes gastar" value={formatCurrency(spendable.amount)} tone="positive" />
            <StatCard
              label="Patrimonio neto"
              value={formatCurrency(netWorth.netWorth) + (netWorth.hasUnknownValues ? ' *' : '')}
              tone={netWorth.netWorth >= 0 ? 'positive' : 'negative'}
            />
            <StatCard label="Ingresos este mes" value={formatCurrency(monthIncome)} tone="positive" />
            <StatCard label="Gastos este mes" value={formatCurrency(monthExpenses)} tone="negative" />
          </div>
          {netWorth.hasUnknownValues && (
            <p className="text-xs text-amber-600">
              * Hay deudas o tarjetas con saldo "por confirmar" que no se incluyeron en este total.
            </p>
          )}

          {unreadAlerts.length > 0 && (
            <div className="space-y-2">
              {unreadAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"
                >
                  <span>{ALERT_SEVERITY_ICON[alert.severity]}</span>
                  <div>
                    <p className="font-medium text-gray-800">{alert.title}</p>
                    {alert.message && <p className="text-gray-600">{alert.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Tus cuentas</h3>
              {accountRows.length === 0 ? (
                <p className="text-sm text-gray-500">Aún no registras cuentas, deudas o tarjetas.</p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {accountRows.map((row) => (
                    <li key={row.id} className="flex items-center justify-between py-2">
                      <span className="text-gray-700">{row.name}</span>
                      {row.amount === null ? (
                        <StatusBadge status="por_confirmar" />
                      ) : (
                        <span className={row.negative ? 'text-red-600' : 'text-gray-900'}>
                          {row.negative ? '−' : ''}
                          {formatCurrency(Math.abs(Number(row.amount)))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Movimientos recientes</h3>
              {income.length === 0 && expenses.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Aún no registras movimientos. Usa "+ Registrar" para empezar.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {[...income.slice(-5).map((i) => ({ ...i, kind: 'Ingreso' as const })), ...expenses
                    .slice(-5)
                    .map((e) => ({ ...e, kind: 'Gasto' as const }))]
                    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                    .slice(0, 8)
                    .map((item) => (
                      <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-gray-700">{item.description || 'Sin descripción'}</p>
                          <p className="text-xs text-gray-400">
                            {item.kind} · {formatDate('received_at' in item ? item.received_at : item.spent_at)}
                          </p>
                        </div>
                        <span className={item.kind === 'Ingreso' ? 'text-brand-600' : 'text-red-600'}>
                          {formatCurrency(Number(item.amount))}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Evolución ingresos vs. gastos</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} width={40} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="Ingresos" fill="#8b46e8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-gray-700">Gastos por categoría (este mes)</h3>
              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500">Sin gastos registrados este mes.</p>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-56 w-full sm:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {categoryBreakdown.map((_, i) => (
                            <Cell key={i} fill={colorForIndex(i)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="w-full space-y-1.5 text-sm sm:w-1/2">
                    {categoryBreakdown.slice(0, 6).map((c, i) => (
                      <li key={c.name} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-gray-600">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: colorForIndex(i) }}
                          />
                          {c.name}
                        </span>
                        <span className="text-gray-800">{formatCurrency(c.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
