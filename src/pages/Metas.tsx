import { useMemo, useState } from 'react'
import { useTable } from '@/hooks/useTable'
import {
  anyGoalProgress,
  emergencyFundStages,
  goalCurrentAmount,
  goalProgress,
  monthsToGoal,
} from '@/algorithms/savings/savings'
import { recurringMonthlyTotal } from '@/algorithms/budget/budget'
import { computeNetWorth } from '@/algorithms/networth/networth'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatPercent } from '@/utils/format'
import type { SavingsGoal } from '@/types/database'

const GOAL_KINDS: { value: SavingsGoal['kind']; label: string }[] = [
  { value: 'fondo_emergencia', label: 'Fondo de emergencia' },
  { value: 'eliminar_deuda', label: 'Eliminar deuda' },
  { value: 'viaje', label: 'Viaje' },
  { value: 'vivienda', label: 'Compra de vivienda' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'retiro', label: 'Retiro' },
  { value: 'mudanza', label: 'Mudanza' },
  { value: 'extranjero', label: 'Vivir en el extranjero' },
  { value: 'otro', label: 'Otro' },
]

export function Metas() {
  const goals = useTable('savings_goals')
  const contributions = useTable('savings_contributions')
  const recurring = useTable('recurring_expenses')
  const accounts = useTable('accounts')
  const incomes = useTable('income_transactions')
  const expenses = useTable('expenses')
  const transfers = useTable('transfers')
  const assets = useTable('assets')
  const receivables = useTable('receivables')
  const receivablePayments = useTable('receivable_payments')
  const debts = useTable('debts')
  const debtPayments = useTable('debt_payments')

  const [contribDrafts, setContribDrafts] = useState<Record<string, string>>({})
  const [newGoal, setNewGoal] = useState({
    name: '', kind: 'otro' as SavingsGoal['kind'], target: '', monthly: '', target_date: '',
  })

  const netWorth = useMemo(
    () =>
      computeNetWorth({
        accounts: accounts.rows,
        incomes: incomes.rows,
        expenses: expenses.rows,
        transfers: transfers.rows,
        assets: assets.rows,
        receivables: receivables.rows,
        receivablePayments: receivablePayments.rows,
        debts: debts.rows,
        debtPayments: debtPayments.rows,
      }),
    [
      accounts.rows, incomes.rows, expenses.rows, transfers.rows, assets.rows,
      receivables.rows, receivablePayments.rows, debts.rows, debtPayments.rows,
    ],
  )

  // Proxy del gasto esencial mensual para las etapas del fondo: el total de
  // recurrentes activos (se refina cuando hay más historial de gastos).
  const essentialMonthly = recurringMonthlyTotal(recurring.rows)
  const emergencyGoal = goals.rows.find((g) => g.kind === 'fondo_emergencia' && g.status === 'activa')
  const emergencyCurrent = emergencyGoal
    ? goalCurrentAmount(emergencyGoal, contributions.rows)
    : 0
  const stages = emergencyFundStages(emergencyCurrent, essentialMonthly)

  async function addGoal() {
    const target = parseFloat(newGoal.target)
    if (!newGoal.name || !(target > 0)) return
    await goals.insert({
      name: newGoal.name,
      kind: newGoal.kind,
      target_amount: target,
      monthly_contribution: newGoal.monthly ? parseFloat(newGoal.monthly) : null,
      target_date: newGoal.target_date || null,
    })
    setNewGoal({ name: '', kind: 'otro', target: '', monthly: '', target_date: '' })
  }

  async function addContribution(goalId: string) {
    const amount = parseFloat(contribDrafts[goalId] ?? '')
    if (!(amount !== 0) || Number.isNaN(amount)) return
    await contributions.insert({ goal_id: goalId, amount })
    setContribDrafts((d) => ({ ...d, [goalId]: '' }))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Metas" subtitle="¿Cómo voy y cuándo llego?" />

      {/* Fondo de emergencia */}
      {emergencyGoal && (
        <div className="card space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="font-medium text-ink-900">🛟 {emergencyGoal.name}</p>
            <p className="text-sm text-ink-500">
              {formatCurrency(emergencyCurrent)} de {formatCurrency(emergencyGoal.target_amount)} (
              {formatPercent(goalProgress(emergencyGoal, contributions.rows))})
            </p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-lavender-500"
              style={{ width: `${goalProgress(emergencyGoal, contributions.rows) * 100}%` }}
            />
          </div>
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {stages.map((s) => (
              <li
                key={s.label}
                className={`flex items-center gap-2 ${s.reached ? 'text-positive' : 'text-ink-500'}`}
              >
                {s.reached ? '✅' : '○'} {s.label} ({formatCurrency(s.target)})
              </li>
            ))}
          </ol>
          {essentialMonthly > 0 && (
            <p className="text-xs text-ink-400">
              Etapas de 3 y 6 meses calculadas con tu gasto esencial actual (~
              {formatCurrency(essentialMonthly)}/mes en recurrentes); se recalculan solas.
            </p>
          )}
        </div>
      )}

      {/* Metas */}
      <section className="space-y-3">
        {goals.rows
          .filter((g) => g.kind !== 'fondo_emergencia' || g.id !== emergencyGoal?.id)
          .map((goal) => {
            const { current, ratio: progress, fromDebt } = anyGoalProgress(
              goal, contributions.rows, debts.rows, debtPayments.rows,
            )
            const months = monthsToGoal(goal, contributions.rows)
            return (
              <div key={goal.id} className="card space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-ink-900">
                    {goal.name}
                    <span className="ml-2 text-xs text-ink-400">
                      {GOAL_KINDS.find((k) => k.value === goal.kind)?.label}
                      {goal.status !== 'activa' ? ` · ${goal.status}` : ''}
                    </span>
                  </p>
                  <p className="text-sm text-ink-500">
                    {formatCurrency(current)} / {formatCurrency(goal.target_amount)}
                  </p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-lavender-500"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <p className="text-xs text-ink-500">
                  {formatPercent(progress)}
                  {fromDebt && ' pagado de esta deuda · avanza sola cuando registras un pago'}
                  {!fromDebt && goal.monthly_contribution
                    ? months === 0
                      ? ' · ¡meta alcanzada!'
                      : Number.isFinite(months)
                        ? ` · a ${formatCurrency(goal.monthly_contribution)}/mes la alcanzas en ~${months} meses`
                        : ''
                    : ' · define un aporte mensual para proyectar la fecha'}
                  {goal.target_date ? ` · fecha objetivo: ${goal.target_date}` : ''}
                </p>
                <div className="flex items-center gap-2">
                  {fromDebt ? (
                    <p className="text-xs text-ink-400">
                      Registra los pagos en “Deudas y tarjetas”: esta meta se actualiza sola.
                    </p>
                  ) : (
                    <>
                      <input
                        className="input w-32 !py-1.5"
                        type="number"
                        step="0.01"
                        placeholder="Aporte S/"
                        value={contribDrafts[goal.id] ?? ''}
                        onChange={(e) =>
                          setContribDrafts((d) => ({ ...d, [goal.id]: e.target.value }))
                        }
                      />
                      <button
                        className="text-sm text-lavender-700"
                        onClick={() => void addContribution(goal.id)}
                      >
                        Aportar
                      </button>
                    </>
                  )}
                  <button
                    className="ml-auto text-sm text-critical"
                    onClick={() => void goals.remove(goal.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        {emergencyGoal && (
          <div className="card flex items-center gap-2 !p-4">
            <input
              className="input w-32 !py-1.5"
              type="number"
              step="0.01"
              placeholder="Aporte S/"
              value={contribDrafts[emergencyGoal.id] ?? ''}
              onChange={(e) =>
                setContribDrafts((d) => ({ ...d, [emergencyGoal.id]: e.target.value }))
              }
            />
            <button
              className="text-sm text-lavender-700"
              onClick={() => void addContribution(emergencyGoal.id)}
            >
              Aportar al fondo de emergencia
            </button>
          </div>
        )}
      </section>

      {/* Nueva meta */}
      <div className="card flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label className="label">Nueva meta</label>
          <input
            className="input"
            placeholder="Nombre"
            value={newGoal.name}
            onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select
            className="input"
            value={newGoal.kind}
            onChange={(e) => setNewGoal({ ...newGoal, kind: e.target.value as SavingsGoal['kind'] })}
          >
            {GOAL_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Objetivo (S/)</label>
          <input
            className="input w-28"
            type="number"
            value={newGoal.target}
            onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Aporte/mes</label>
          <input
            className="input w-28"
            type="number"
            value={newGoal.monthly}
            onChange={(e) => setNewGoal({ ...newGoal, monthly: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Fecha objetivo</label>
          <input
            className="input"
            type="date"
            value={newGoal.target_date}
            onChange={(e) => setNewGoal({ ...newGoal, target_date: e.target.value })}
          />
        </div>
        <button className="btn-primary" onClick={() => void addGoal()}>
          Crear
        </button>
      </div>

      {/* Patrimonio */}
      <div className="card">
        <p className="text-sm font-medium text-ink-500">🏛️ Patrimonio neto</p>
        <p
          className={`mt-1 text-3xl font-semibold ${
            netWorth.netWorth < 0 ? 'text-critical' : 'text-ink-900'
          }`}
        >
          {formatCurrency(netWorth.netWorth)}
        </p>
        <dl className="mt-3 space-y-1 text-sm text-ink-600">
          <div className="flex justify-between">
            <dt>Activos verificados</dt>
            <dd>{formatCurrency(netWorth.verifiedAssets)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Activos no verificados ⚠️</dt>
            <dd>{formatCurrency(netWorth.unverifiedAssets)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Por cobrar</dt>
            <dd>{formatCurrency(netWorth.receivablesPending)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>− Pasivos</dt>
            <dd>−{formatCurrency(netWorth.totalLiabilities)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-400">
          Se recalcula automáticamente con cada movimiento. Lo no verificado se muestra pero no
          cuenta como dinero disponible.
        </p>
      </div>
    </div>
  )
}
