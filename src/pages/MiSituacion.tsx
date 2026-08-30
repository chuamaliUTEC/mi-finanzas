import { useMemo } from 'react'
import { useFinancialOverview } from '@/hooks/useFinancialOverview'
import { useTable } from '@/hooks/useTable'
import { computeHealth } from '@/algorithms/health/health'
import { computeNetWorth } from '@/algorithms/networth/networth'
import { recurringMonthlyTotal } from '@/algorithms/budget/budget'
import { monthlyExpectedIncome } from '@/algorithms/spendable/spendable'
import { computeDebtBalance } from '@/algorithms/debt/debts'
import { goalCurrentAmount } from '@/algorithms/savings/savings'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency } from '@/utils/format'

// MI SITUACIÓN (secc. 42-43): seis indicadores con barra, qué significa
// cada uno y cómo mejora. La puntuación es orientativa, y se dice.

export function MiSituacion() {
  const overview = useFinancialOverview()
  const assets = useTable('assets')
  const receivables = useTable('receivables')
  const receivablePayments = useTable('receivable_payments')
  const { tables } = overview

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

  const health = useMemo(() => {
    const monthlyIncome = tables.sources.rows.reduce((s, src) => s + monthlyExpectedIncome(src), 0)
    const essential = recurringMonthlyTotal(tables.recurring.rows)
    const monthlyExpenses = overview.monthExpenses
      .filter((e) => e.deleted_at === null && e.status === 'confirmado')
      .reduce((s, e) => s + e.amount, 0)
    const monthlyDebtPayments = tables.debts.rows
      .filter(
        (d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada',
      )
      .filter((d) => computeDebtBalance(d, tables.debtPayments.rows) > 0)
      .reduce((s, d) => s + (d.minimum_payment ?? d.installment_amount ?? 0), 0)
    const activeGoals = tables.goals.rows.filter((g) => g.deleted_at === null)

    return computeHealth({
      availableMoney: overview.availableMoney,
      monthlyEssentialSpend: essential,
      monthlyIncome,
      monthlyExpenses: Math.max(monthlyExpenses, essential),
      totalDebt: overview.totalDebt,
      monthlyDebtPayments,
      netWorth: netWorth.netWorth,
      totalAssets: netWorth.totalAssets,
      emergencyFundCurrent: overview.emergencyFundCurrent,
      emergencyFundTarget: overview.emergencyGoal?.target_amount ?? 0,
      goalsTotal: activeGoals.length,
      goalsAchieved: activeGoals.filter((g) => g.status === 'lograda').length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    overview.availableMoney, overview.totalDebt, overview.monthExpenses,
    overview.emergencyFundCurrent, overview.emergencyGoal, netWorth,
    tables.sources.rows, tables.recurring.rows, tables.debts.rows,
    tables.debtPayments.rows, tables.goals.rows,
  ])

  const goalsWithProgress = tables.goals.rows.filter((g) => g.deleted_at === null)

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Mi situación" subtitle="Dónde estás parada hoy, en seis lecturas." />

      {/* Puntuación orientativa */}
      <div className="card border-lavender-200 bg-gradient-to-br from-white to-lavender-50">
        <p className="text-sm font-medium text-ink-500">Tu situación financiera</p>
        <p className="mt-1 text-4xl font-semibold text-ink-900">
          {health.label}
          <span className="ml-3 text-2xl font-normal text-ink-400">
            {health.score.toFixed(0)}/100
          </span>
        </p>
        <p className="mt-2 text-xs text-ink-400">
          Puntuación orientativa calculada solo con tus datos. No es un diagnóstico ni un score
          crediticio oficial: sirve para ver si vas mejorando mes a mes.
        </p>
      </div>

      {/* Indicadores */}
      <div className="space-y-4">
        {health.indicators.map((indicator) => (
          <div key={indicator.key} className="card space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-ink-900">{indicator.label}</p>
              <p className="text-sm text-ink-600">{indicator.value}</p>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className={`h-full rounded-full ${
                  indicator.ratio >= 0.7
                    ? 'bg-positive'
                    : indicator.ratio >= 0.4
                      ? 'bg-warning'
                      : 'bg-critical'
                }`}
                style={{ width: `${Math.max(2, indicator.ratio * 100)}%` }}
              />
            </div>
            <p className="text-sm text-ink-600">{indicator.meaning}</p>
            <p className="text-xs text-ink-400">{indicator.howToImprove}</p>
          </div>
        ))}
      </div>

      {/* Metas en curso */}
      {goalsWithProgress.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-medium text-ink-900">Tus metas</h2>
          {goalsWithProgress.map((goal) => {
            const current = goalCurrentAmount(goal, tables.contributions.rows)
            const ratio = goal.target_amount > 0 ? current / goal.target_amount : 0
            return (
              <div key={goal.id}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-700">{goal.name}</span>
                  <span className="text-ink-500">
                    {formatCurrency(current)} / {formatCurrency(goal.target_amount)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-lavender-500"
                    style={{ width: `${Math.min(100, ratio * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
