import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useFinancialOverview } from '@/hooks/useFinancialOverview'
import { useTable } from '@/hooks/useTable'
import { computeNextActions, scoreDebtPriorities } from '@/algorithms/rules/nextAction'
import { detectBudgetAdjustments } from '@/algorithms/learning/learning'
import { SEVERITY_ICON, SEVERITY_LABEL } from '@/algorithms/rules/engine'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency } from '@/utils/format'

// "¿QUÉ DEBO HACER?" (secc. 15, 44, 47): una acción principal, su porqué,
// y debajo el resto del contexto. Nunca una lista de datos sin conclusión.

export function Decisiones() {
  const overview = useFinancialOverview()
  const adjustments = useTable('learning_adjustments', { softDelete: false })

  const actions = useMemo(
    () =>
      computeNextActions({
        debts: overview.tables.debts.rows,
        debtPayments: overview.tables.debtPayments.rows,
        cards: overview.tables.cards.rows,
        goals: overview.tables.goals.rows,
        availableMoney: overview.availableMoney,
        spendableMonth: overview.spendable.month,
        upcomingTotal: overview.upcomingTotal,
        emergencyFundCurrent: overview.emergencyFundCurrent,
        today: overview.today,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      overview.tables.debts.rows, overview.tables.debtPayments.rows,
      overview.tables.cards.rows, overview.tables.goals.rows,
      overview.availableMoney, overview.spendable.month, overview.upcomingTotal,
      overview.emergencyFundCurrent,
    ],
  )

  const priorities = useMemo(
    () =>
      scoreDebtPriorities(
        overview.tables.debts.rows,
        overview.tables.debtPayments.rows,
        overview.today,
        Math.max(0, overview.spendable.month),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overview.tables.debts.rows, overview.tables.debtPayments.rows, overview.spendable.month],
  )

  const learningSuggestions = useMemo(
    () =>
      detectBudgetAdjustments(
        overview.tables.budgets.rows,
        overview.tables.budgetCategories.rows,
        overview.tables.expenses.rows,
        overview.today,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overview.tables.budgets.rows, overview.tables.budgetCategories.rows, overview.tables.expenses.rows],
  )

  const categoryName = (id: string) =>
    overview.tables.categories.rows.find((c) => c.id === id)?.name ?? 'esa categoría'

  const [primary, ...rest] = actions

  async function acceptSuggestion(categoryId: string, suggested: number, observation: string, months: number) {
    // La sugerencia se guarda como aceptada y se aplica al presupuesto del
    // mes en curso: solo aquí, con confirmación explícita de la usuaria.
    const budget = overview.tables.budgets.rows.find(
      (b) => b.year === overview.year && b.month === overview.month,
    )
    await adjustments.insert({
      category_id: categoryId,
      kind: 'presupuesto',
      observation,
      suggested_value: suggested,
      months_observed: months,
      status: 'aceptada',
    })
    if (budget) {
      const existing = overview.tables.budgetCategories.rows.find(
        (bc) => bc.budget_id === budget.id && bc.category_id === categoryId,
      )
      if (existing) {
        await overview.tables.budgetCategories.update(existing.id, { planned_amount: suggested })
      } else {
        await overview.tables.budgetCategories.insert({
          budget_id: budget.id,
          category_id: categoryId,
          planned_amount: suggested,
        })
      }
    }
  }

  async function dismissSuggestion(categoryId: string, observation: string, months: number) {
    await adjustments.insert({
      category_id: categoryId,
      kind: 'presupuesto',
      observation,
      months_observed: months,
      status: 'descartada',
    })
  }

  const dismissedKeys = new Set(
    adjustments.rows
      .filter((a) => a.status !== 'pendiente')
      .map((a) => `${a.category_id}:${a.observation}`),
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="¿Qué debo hacer?" subtitle="Tu próxima mejor acción, y por qué." />

      {overview.loading && <p className="text-sm text-ink-400">Analizando tu situación…</p>}

      {/* Una sola acción principal */}
      {primary && (
        <div className="card border-lavender-200 bg-gradient-to-br from-white to-lavender-50">
          <p className="text-sm font-medium text-lavender-600">
            {SEVERITY_ICON[primary.severity]} Prioridad de hoy
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink-900">{primary.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            <span className="font-medium text-ink-800">¿Por qué? </span>
            {primary.why}
          </p>
          {primary.entityType === 'debts' && (
            <Link to="/deudas" className="btn-primary mt-4 inline-flex">
              Ir a registrar el pago
            </Link>
          )}
        </div>
      )}

      {!primary && !overview.loading && (
        <div className="card">
          <p className="text-sm text-ink-600">
            No hay una acción urgente ahora mismo. Registra tus movimientos del día y vuelve: las
            recomendaciones se recalculan con cada cambio.
          </p>
        </div>
      )}

      {/* Resto de acciones */}
      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Después de eso
          </h2>
          {rest.map((action, i) => (
            <div key={i} className="card">
              <p className="font-medium text-ink-900">
                {SEVERITY_ICON[action.severity]} {action.title}
              </p>
              <p className="mt-1 text-sm text-ink-600">{action.why}</p>
            </div>
          ))}
        </section>
      )}

      {/* Alertas del motor de reglas */}
      {overview.alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Alertas</h2>
          {overview.alerts.map((alert, i) => (
            <div key={`${alert.dedupeKey}-${i}`} className="card !p-4">
              <p className="text-sm font-medium text-ink-900">
                {SEVERITY_ICON[alert.severity]} {alert.title}
                <span className="ml-2 text-xs font-normal text-ink-400">
                  {SEVERITY_LABEL[alert.severity]}
                </span>
              </p>
              <p className="mt-1 text-sm text-ink-600">{alert.message}</p>
            </div>
          ))}
        </section>
      )}

      {/* Aprendizaje: sugerencias de ajuste, nunca automáticas */}
      {learningSuggestions.filter(
        (s) => !dismissedKeys.has(`${s.categoryId}:${s.observation}`),
      ).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Lo que hemos aprendido
          </h2>
          {learningSuggestions
            .filter((s) => !dismissedKeys.has(`${s.categoryId}:${s.observation}`))
            .map((s) => (
              <div key={s.categoryId} className="card !p-4">
                <p className="text-sm text-ink-700">
                  <strong>{categoryName(s.categoryId)}:</strong> {s.observation}
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  ¿Quieres ajustar tu presupuesto base de {formatCurrency(s.currentPlanned)} a{' '}
                  {formatCurrency(s.suggestedPlanned)}?
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn-primary !py-1.5"
                    onClick={() =>
                      void acceptSuggestion(
                        s.categoryId, s.suggestedPlanned, s.observation, s.monthsObserved,
                      )
                    }
                  >
                    Sí, ajustar
                  </button>
                  <button
                    className="btn-secondary !py-1.5"
                    onClick={() =>
                      void dismissSuggestion(s.categoryId, s.observation, s.monthsObserved)
                    }
                  >
                    Mantener como está
                  </button>
                </div>
              </div>
            ))}
        </section>
      )}

      {/* Prioridad dinámica de deudas */}
      {priorities.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Orden de ataque recomendado
          </h2>
          <div className="card">
            <ol className="space-y-3">
              {priorities.map((p, i) => (
                <li key={p.debt.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender-100 text-xs font-semibold text-lavender-700">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {p.debt.name ?? p.debt.creditor} · {formatCurrency(p.balance)}
                    </p>
                    <p className="text-xs text-ink-500">{p.reasons.join(' · ')}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-ink-400">
              El orden se recalcula con tu tasa, saldo, vencimientos y compromisos: no es fijo.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
