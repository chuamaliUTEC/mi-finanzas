import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinancialOverview } from '@/hooks/useFinancialOverview'
import {
  buildForecast,
  simulateExtraExpense,
  type Scenario,
} from '@/algorithms/forecast/forecast'
import { extraPaymentImpact } from '@/algorithms/rules/nextAction'
import { computeDebtBalance } from '@/algorithms/debt/debts'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency } from '@/utils/format'

const SCENARIOS: { value: Scenario; label: string; hint: string }[] = [
  { value: 'pesimista', label: 'Pesimista', hint: 'Entra 15 % menos y gastas 15 % más.' },
  { value: 'base', label: 'Base', hint: 'Se mantiene tu ritmo actual.' },
  { value: 'optimista', label: 'Optimista', hint: 'Entra 10 % más y contienes 10 % el gasto.' },
]

export function Pronostico() {
  const overview = useFinancialOverview()
  const [scenario, setScenario] = useState<Scenario>('base')
  const [extraDebt, setExtraDebt] = useState('0')
  const [whatIfAmount, setWhatIfAmount] = useState('500')
  const [whatIfDebtId, setWhatIfDebtId] = useState('')

  const { tables } = overview

  const forecast = useMemo(
    () =>
      buildForecast(
        {
          today: overview.today,
          startingBalance: overview.availableMoney,
          incomes: tables.incomes.rows,
          expenses: tables.expenses.rows,
          sources: tables.sources.rows,
          recurring: tables.recurring.rows,
          debts: tables.debts.rows,
          debtPayments: tables.debtPayments.rows,
          extraDebtPayment: parseFloat(extraDebt) || 0,
        },
        scenario,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      overview.availableMoney, tables.incomes.rows, tables.expenses.rows,
      tables.sources.rows, tables.recurring.rows, tables.debts.rows,
      tables.debtPayments.rows, extraDebt, scenario,
    ],
  )

  const monthlySavingsCapacity = forecast.months[0]?.savings ?? 0
  const whatIf = useMemo(
    () =>
      simulateExtraExpense(
        parseFloat(whatIfAmount) || 0,
        overview.spendable.month,
        monthlySavingsCapacity,
      ),
    [whatIfAmount, overview.spendable.month, monthlySavingsCapacity],
  )

  const activeDebts = tables.debts.rows.filter(
    (d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada',
  )
  const selectedDebt = activeDebts.find((d) => d.id === whatIfDebtId) ?? activeDebts[0]
  const debtImpact = useMemo(() => {
    if (!selectedDebt) return null
    const basePayment =
      selectedDebt.minimum_payment ?? selectedDebt.installment_amount ?? 0
    if (basePayment <= 0) return null
    return extraPaymentImpact(
      selectedDebt,
      tables.debtPayments.rows,
      basePayment,
      parseFloat(extraDebt) || 0,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDebt, tables.debtPayments.rows, extraDebt])

  const debtFreeMonth = forecast.months.find((m) => m.debtBalance <= 0)

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Pronóstico" subtitle="¿Qué pasará con mis finanzas?" />

      {forecast.usedDeclaredValues && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-ink-700">
          Aún no hay suficiente historial, así que la proyección usa lo que declaraste (tus fuentes
          de ingreso y gastos recurrentes). Se afinará sola a medida que registres movimientos.
        </div>
      )}

      {/* Escenarios */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.value}
            onClick={() => setScenario(s.value)}
            className={
              scenario === s.value
                ? 'rounded-xl bg-lavender-600 px-4 py-2 text-sm font-medium text-white'
                : 'rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-600'
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="-mt-6 text-xs text-ink-400">
        {SCENARIOS.find((s) => s.value === scenario)?.hint}
      </p>

      {/* Saldo proyectado */}
      <div className="card">
        <p className="text-sm font-medium text-ink-500">Saldo acumulado proyectado (12 meses)</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecast.months}>
              <defs>
                <linearGradient id="saldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8c63d6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8c63d6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#79798d' }} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: '#79798d' }} width={70} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e2e9', fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeBalance"
                stroke="#7247bd"
                strokeWidth={2}
                fill="url(#saldo)"
                name="Saldo"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deuda proyectada */}
      <div className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-ink-500">Deuda proyectada</p>
          {debtFreeMonth ? (
            <p className="text-sm font-medium text-positive">
              🎉 Libre de deuda en {debtFreeMonth.label}
            </p>
          ) : (
            <p className="text-sm text-ink-500">
              Quedarían {formatCurrency(forecast.months[forecast.months.length - 1]?.debtBalance ?? 0)}{' '}
              en 12 meses
            </p>
          )}
        </div>
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecast.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#79798d' }} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: '#79798d' }} width={70} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e2e9', fontSize: 13 }}
              />
              <Line
                type="monotone"
                dataKey="debtBalance"
                stroke="#d13a3a"
                strokeWidth={2}
                dot={false}
                name="Deuda"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Pago extra mensual a deuda (S/)</label>
            <input
              className="input w-36"
              type="number"
              step="50"
              value={extraDebt}
              onChange={(e) => setExtraDebt(e.target.value)}
            />
          </div>
          {activeDebts.length > 0 && (
            <div>
              <label className="label">Aplicado a</label>
              <select
                className="input"
                value={selectedDebt?.id ?? ''}
                onChange={(e) => setWhatIfDebtId(e.target.value)}
              >
                {activeDebts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name ?? d.creditor} ·{' '}
                    {formatCurrency(computeDebtBalance(d, tables.debtPayments.rows))}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {debtImpact && (parseFloat(extraDebt) || 0) > 0 && selectedDebt && (
          <p className="mt-3 text-sm text-ink-600">
            Agregando {formatCurrency(parseFloat(extraDebt))} al mes a{' '}
            {selectedDebt.name ?? selectedDebt.creditor}:{' '}
            {Number.isFinite(debtImpact.monthsSaved) ? (
              <>
                la liquidas <strong>{debtImpact.monthsSaved} meses antes</strong> y te ahorras{' '}
                <strong>{formatCurrency(debtImpact.interestSaved)}</strong> en intereses.
              </>
            ) : (
              <>con el pago mínimo esa deuda nunca terminaría de pagarse; el extra sí la liquida.</>
            )}
          </p>
        )}
      </div>

      {/* Ingresos vs gastos proyectados */}
      <div className="card">
        <p className="text-sm font-medium text-ink-500">Ingresos vs. gastos proyectados</p>
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecast.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#79798d' }} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: '#79798d' }} width={70} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ borderRadius: 12, border: '1px solid #e2e2e9', fontSize: 13 }}
              />
              <Line type="monotone" dataKey="income" stroke="#2f9e6e" strokeWidth={2} dot={false} name="Ingresos" />
              <Line type="monotone" dataKey="expenses" stroke="#c98a1f" strokeWidth={2} dot={false} name="Gastos" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ¿Qué pasa si...? */}
      <section className="card space-y-4">
        <h2 className="font-medium text-ink-900">¿Qué pasa si…?</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Si gasto (S/)</label>
            <input
              className="input w-32"
              type="number"
              step="50"
              value={whatIfAmount}
              onChange={(e) => setWhatIfAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-xl bg-lavender-50 p-4 text-sm text-ink-700">
          <p>{whatIf.description}</p>
          {Number.isFinite(whatIf.savingsDelayMonths) && whatIf.savingsDelayMonths > 0 && (
            <p className="mt-1">
              Al ritmo de ahorro proyectado, ese gasto retrasa tus metas alrededor de{' '}
              <strong>
                {whatIf.savingsDelayMonths.toFixed(1)}{' '}
                {whatIf.savingsDelayMonths === 1 ? 'mes' : 'meses'}
              </strong>
              .
            </p>
          )}
          {whatIf.spendableAfter < 0 && (
            <p className="mt-1 text-critical">
              🔴 Comprometerías obligaciones que ya tienes asumidas este mes.
            </p>
          )}
        </div>
      </section>

      {/* Estadística del historial */}
      {!forecast.usedDeclaredValues && (
        <section className="card">
          <p className="text-sm font-medium text-ink-500">Tu historial en números</p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between">
              <dt className="text-ink-600">Gasto promedio mensual</dt>
              <dd className="font-medium">{formatCurrency(forecast.expenseStats.average)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Gasto mediano</dt>
              <dd className="font-medium">{formatCurrency(forecast.expenseStats.median)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Variabilidad (desv. estándar)</dt>
              <dd className="font-medium">
                {formatCurrency(forecast.expenseStats.standardDeviation)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Tendencia mensual</dt>
              <dd
                className={`font-medium ${
                  forecast.expenseStats.trend > 0 ? 'text-warning' : 'text-positive'
                }`}
              >
                {forecast.expenseStats.trend > 0 ? '+' : ''}
                {formatCurrency(forecast.expenseStats.trend)}/mes
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Meses observados</dt>
              <dd className="font-medium">{forecast.expenseStats.months}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Meses atípicos detectados</dt>
              <dd className="font-medium">{forecast.expenseStats.outliers.length}</dd>
            </div>
          </dl>
          {forecast.expenseStats.outliers.length > 0 && (
            <p className="mt-3 text-xs text-ink-400">
              Se detectaron meses atípicos, así que la proyección usa la mediana para no arrastrar
              un gasto excepcional.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
