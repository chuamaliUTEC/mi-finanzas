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
import { useFinancialOverview } from '@/hooks/useFinancialOverview'
import { useTable } from '@/hooks/useTable'
import { computeDebtBalance, debtAnnualRate } from '@/algorithms/debt/debts'
import { describeSeries } from '@/algorithms/forecast/statistics'
import { monthlySeries } from '@/algorithms/forecast/forecast'
import { computeNetWorth } from '@/algorithms/networth/networth'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency } from '@/utils/format'

// REPORTES (secc. 32): mensual, deudas, gastos, flujo de caja y patrimonio.
// Cada reporte cierra con una lectura, no solo con la tabla.

type Report = 'mensual' | 'gastos' | 'deudas' | 'flujo'

const REPORTS: { value: Report; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'gastos', label: 'Gastos' },
  { value: 'deudas', label: 'Deudas' },
  { value: 'flujo', label: 'Flujo de caja' },
]

// Paleta derivada del sistema de diseño, ordenada para que categorías
// contiguas se distingan bien.
const CHART_COLORS = [
  '#8c63d6', '#2f9e6e', '#c98a1f', '#d9722f', '#5c379a',
  '#79798d', '#ac8de7', '#d13a3a', '#cdb8f3', '#454555',
]

const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export function Reportes() {
  const overview = useFinancialOverview()
  const assets = useTable('assets')
  const receivables = useTable('receivables')
  const receivablePayments = useTable('receivable_payments')
  const [report, setReport] = useState<Report>('mensual')
  const { tables, today, year, month } = overview

  // Últimos 6 meses cerrados + el mes en curso.
  const monthKeys = useMemo(() => {
    const keys: { key: string; label: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(year, month - 1 - i, 1)
      keys.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`,
      })
    }
    return keys
  }, [year, month])

  const monthlyData = useMemo(
    () =>
      monthKeys.map(({ key, label }) => {
        const income = tables.incomes.rows
          .filter((i) => i.deleted_at === null && i.status === 'realizado' && i.date.startsWith(key))
          .reduce((s, i) => s + i.amount, 0)
        const expenses = tables.expenses.rows
          .filter((e) => e.deleted_at === null && e.status === 'confirmado' && e.date.startsWith(key))
          .reduce((s, e) => s + e.amount, 0)
        const debtPaid = tables.debtPayments.rows
          .filter((p) => p.deleted_at === null && p.date.startsWith(key))
          .reduce((s, p) => s + p.amount, 0)
        return {
          label,
          ingresos: Math.round(income * 100) / 100,
          gastos: Math.round(expenses * 100) / 100,
          deuda: Math.round(debtPaid * 100) / 100,
          ahorro: Math.round((income - expenses - debtPaid) * 100) / 100,
        }
      }),
    [monthKeys, tables.incomes.rows, tables.expenses.rows, tables.debtPayments.rows],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of overview.monthExpenses) {
      if (expense.deleted_at !== null || expense.status !== 'confirmado') continue
      const name =
        tables.categories.rows.find((c) => c.id === expense.category_id)?.name ?? 'Sin categoría'
      map.set(name, (map.get(name) ?? 0) + expense.amount)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [overview.monthExpenses, tables.categories.rows])

  const expenseStats = useMemo(
    () =>
      describeSeries(
        monthlySeries(
          tables.expenses.rows,
          today,
          12,
          (row) => (row as { status?: string }).status === 'confirmado',
        ),
      ),
    [tables.expenses.rows, today],
  )

  const netWorth = useMemo(
    () =>
      computeNetWorth({
        accounts: tables.accounts.rows,
        incomes: tables.incomes.rows,
        expenses: tables.expenses.rows,
        transfers: tables.transfers.rows,
        assets: assets.rows,
        receivables: receivables.rows,
        receivablePayments: receivablePayments.rows,
        debts: tables.debts.rows,
        debtPayments: tables.debtPayments.rows,
      }),
    [
      tables.accounts.rows, tables.incomes.rows, tables.expenses.rows,
      tables.transfers.rows, assets.rows, receivables.rows,
      receivablePayments.rows, tables.debts.rows, tables.debtPayments.rows,
    ],
  )

  const activeDebts = tables.debts.rows.filter(
    (d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada',
  )

  const currentMonthLabel = `${MONTH_LABELS[month - 1]} ${year}`
  const thisMonth = monthlyData[monthlyData.length - 1]
  const previousMonth = monthlyData[monthlyData.length - 2]

  const tooltipStyle = {
    borderRadius: 12,
    border: '1px solid #e2e2e9',
    fontSize: 13,
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Reportes" subtitle="Cómo evolucionaron tus finanzas." />

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReport(r.value)}
            className={
              report === r.value
                ? 'rounded-xl bg-lavender-600 px-4 py-2 text-sm font-medium text-white'
                : 'rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-600'
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {report === 'mensual' && (
        <>
          <div className="card">
            <p className="text-sm font-medium text-ink-500">
              Ingresos, gastos y pagos de deuda (6 meses)
            </p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#79798d' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#79798d' }} width={70} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={tooltipStyle}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="ingresos" fill="#2f9e6e" name="Ingresos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gastos" fill="#c98a1f" name="Gastos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deuda" fill="#8c63d6" name="Deuda" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <p className="text-sm font-medium text-ink-500">Resumen de {currentMonthLabel}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Ingresos</dt>
                <dd className="font-medium text-positive">
                  {formatCurrency(thisMonth?.ingresos ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Gastos</dt>
                <dd className="font-medium text-ink-900">{formatCurrency(thisMonth?.gastos ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Pagos de deuda</dt>
                <dd className="font-medium text-ink-900">{formatCurrency(thisMonth?.deuda ?? 0)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-1.5">
                <dt className="font-medium text-ink-900">Ahorro del mes</dt>
                <dd
                  className={`font-semibold ${
                    (thisMonth?.ahorro ?? 0) >= 0 ? 'text-positive' : 'text-critical'
                  }`}
                >
                  {formatCurrency(thisMonth?.ahorro ?? 0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Patrimonio neto</dt>
                <dd
                  className={`font-medium ${
                    netWorth.netWorth < 0 ? 'text-critical' : 'text-ink-900'
                  }`}
                >
                  {formatCurrency(netWorth.netWorth)}
                </dd>
              </div>
            </dl>
            {previousMonth && (
              <p className="mt-3 text-sm text-ink-600">
                {thisMonth.gastos > previousMonth.gastos
                  ? `Gastaste ${formatCurrency(thisMonth.gastos - previousMonth.gastos)} más que el mes pasado.`
                  : thisMonth.gastos < previousMonth.gastos
                    ? `Gastaste ${formatCurrency(previousMonth.gastos - thisMonth.gastos)} menos que el mes pasado.`
                    : 'Tu gasto se mantuvo igual que el mes pasado.'}
              </p>
            )}
          </div>
        </>
      )}

      {report === 'gastos' && (
        <>
          <div className="card">
            <p className="text-sm font-medium text-ink-500">
              Gasto por categoría · {currentMonthLabel}
            </p>
            {byCategory.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Sin gastos registrados este mes.</p>
            ) : (
              <>
                <div className="mt-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="45%"
                        outerRadius="75%"
                        paddingAngle={2}
                      >
                        {byCategory.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={tooltipStyle}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {byCategory.map((item, i) => (
                    <li key={item.name} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-ink-700">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        {item.name}
                      </span>
                      <span className="font-medium text-ink-900">{formatCurrency(item.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {expenseStats.months > 0 && (
            <div className="card">
              <p className="text-sm font-medium text-ink-500">Tu gasto en perspectiva</p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Promedio mensual</dt>
                  <dd className="font-medium">{formatCurrency(expenseStats.average)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Mediana</dt>
                  <dd className="font-medium">{formatCurrency(expenseStats.median)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Variabilidad</dt>
                  <dd className="font-medium">{formatCurrency(expenseStats.standardDeviation)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Tendencia</dt>
                  <dd
                    className={`font-medium ${
                      expenseStats.trend > 0 ? 'text-warning' : 'text-positive'
                    }`}
                  >
                    {expenseStats.trend > 0 ? '+' : ''}
                    {formatCurrency(expenseStats.trend)}/mes
                  </dd>
                </div>
              </dl>
              {expenseStats.outliers.length > 0 && (
                <p className="mt-3 text-sm text-ink-600">
                  Detectamos {expenseStats.outliers.length}{' '}
                  {expenseStats.outliers.length === 1 ? 'mes atípico' : 'meses atípicos'} en tu
                  historial: conviene revisarlos antes de sacar conclusiones del promedio.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {report === 'deudas' && (
        <div className="card">
          <p className="text-sm font-medium text-ink-500">Estado de tus deudas</p>
          {activeDebts.length === 0 ? (
            <p className="mt-3 text-sm text-positive">🎉 No tienes deudas activas.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-4">Deuda</th>
                    <th className="py-2 pr-4">Inicial</th>
                    <th className="py-2 pr-4">Actual</th>
                    <th className="py-2 pr-4">Pagado</th>
                    <th className="py-2">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDebts.map((debt) => {
                    const balance = computeDebtBalance(debt, tables.debtPayments.rows)
                    const paid = debt.initial_balance - balance
                    const progress =
                      debt.initial_balance > 0 ? (paid / debt.initial_balance) * 100 : 0
                    return (
                      <tr key={debt.id} className="border-b border-ink-50">
                        <td className="py-2 pr-4 text-ink-800">{debt.name ?? debt.creditor}</td>
                        <td className="py-2 pr-4 text-ink-600">
                          {formatCurrency(debt.initial_balance)}
                        </td>
                        <td className="py-2 pr-4 font-medium text-ink-900">
                          {formatCurrency(balance)}
                        </td>
                        <td className="py-2 pr-4 text-positive">
                          {formatCurrency(paid)} ({progress.toFixed(0)} %)
                        </td>
                        <td className="py-2 text-ink-600">
                          {debtAnnualRate(debt) > 0
                            ? `${debtAnnualRate(debt).toFixed(2)} %`
                            : 'sin interés'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="font-medium text-ink-900">
                    <td className="py-2 pr-4">Total</td>
                    <td className="py-2 pr-4">
                      {formatCurrency(
                        activeDebts.reduce((s, d) => s + d.initial_balance, 0),
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatCurrency(overview.totalDebt)}</td>
                    <td className="py-2 pr-4 text-positive">
                      {formatCurrency(
                        activeDebts.reduce((s, d) => s + d.initial_balance, 0) - overview.totalDebt,
                      )}
                    </td>
                    <td className="py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {report === 'flujo' && (
        <div className="card">
          <p className="text-sm font-medium text-ink-500">Entradas vs. salidas (6 meses)</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#79798d' }} />
                <YAxis tick={{ fontSize: 11, fill: '#79798d' }} width={70} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#2f9e6e"
                  strokeWidth={2}
                  name="Entradas"
                />
                <Line
                  type="monotone"
                  dataKey="gastos"
                  stroke="#c98a1f"
                  strokeWidth={2}
                  name="Salidas"
                />
                <Line
                  type="monotone"
                  dataKey="ahorro"
                  stroke="#8c63d6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  name="Neto"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm text-ink-600">
            {(thisMonth?.ahorro ?? 0) >= 0
              ? `Este mes te quedaron ${formatCurrency(thisMonth?.ahorro ?? 0)} después de gastos y deuda.`
              : `Este mes gastaste ${formatCurrency(Math.abs(thisMonth?.ahorro ?? 0))} más de lo que entró: estás consumiendo saldo.`}
          </p>
        </div>
      )}
    </div>
  )
}
