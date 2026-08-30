import { round2 } from '@/algorithms/accounts/balance'
import { computeDebtBalance } from '@/algorithms/debt/debts'
import type { Debt, DebtPayment, SavingsContribution, SavingsGoal } from '@/types/database'

// Metas de ahorro y fondo de emergencia (secc. 19-20).

export function goalCurrentAmount(goal: SavingsGoal, contributions: SavingsContribution[]): number {
  return round2(
    contributions
      .filter((c) => c.goal_id === goal.id && c.deleted_at === null)
      .reduce((sum, c) => sum + c.amount, 0),
  )
}

export function goalProgress(goal: SavingsGoal, contributions: SavingsContribution[]): number {
  if (goal.target_amount <= 0) return 0
  return Math.min(1, goalCurrentAmount(goal, contributions) / goal.target_amount)
}

/**
 * Progreso de una meta de ELIMINAR DEUDA: no se mide por aportes a una
 * alcancía, sino por cuánto ha bajado el saldo de la deuda. Así, pagar la
 * deuda hace avanzar la meta sola, sin registrar nada dos veces.
 */
export function debtGoalProgress(
  goal: SavingsGoal,
  debts: Debt[],
  payments: DebtPayment[],
): { paid: number; remaining: number; ratio: number } | null {
  if (!goal.debt_id) return null
  const debt = debts.find((d) => d.id === goal.debt_id)
  if (!debt) return null
  const remaining = computeDebtBalance(debt, payments)
  const paid = round2(Math.max(0, debt.initial_balance - remaining))
  const ratio = debt.initial_balance > 0 ? Math.min(1, paid / debt.initial_balance) : 1
  return { paid, remaining, ratio }
}

/**
 * Progreso de cualquier meta: usa el saldo de la deuda si está vinculada,
 * y los aportes en caso contrario.
 */
export function anyGoalProgress(
  goal: SavingsGoal,
  contributions: SavingsContribution[],
  debts: Debt[],
  payments: DebtPayment[],
): { current: number; ratio: number; fromDebt: boolean } {
  const fromDebt = debtGoalProgress(goal, debts, payments)
  if (fromDebt) return { current: fromDebt.paid, ratio: fromDebt.ratio, fromDebt: true }
  return {
    current: goalCurrentAmount(goal, contributions),
    ratio: goalProgress(goal, contributions),
    fromDebt: false,
  }
}

/** Meses estimados para alcanzar la meta al ritmo de aporte dado. */
export function monthsToGoal(
  goal: SavingsGoal,
  contributions: SavingsContribution[],
  monthlyContribution?: number,
): number {
  const monthly = monthlyContribution ?? goal.monthly_contribution ?? 0
  if (monthly <= 0) return Infinity
  const remaining = goal.target_amount - goalCurrentAmount(goal, contributions)
  if (remaining <= 0) return 0
  return Math.ceil(remaining / monthly)
}

export interface EmergencyStage {
  label: string
  target: number
  reached: boolean
}

/**
 * Etapas del fondo de emergencia (secc. 19): hitos fijos iniciales y luego
 * 3 y 6 meses del gasto esencial promedio. El objetivo se recalcula con el
 * gasto esencial real, nunca queda clavado en un número.
 */
export function emergencyFundStages(
  currentAmount: number,
  essentialMonthlySpend: number,
): EmergencyStage[] {
  const stages: EmergencyStage[] = [
    { label: 'Primer S/ 500', target: 500, reached: false },
    { label: 'S/ 1,000', target: 1000, reached: false },
    { label: 'S/ 1,600', target: 1600, reached: false },
  ]
  if (essentialMonthlySpend > 0) {
    stages.push(
      { label: '3 meses de gastos', target: round2(essentialMonthlySpend * 3), reached: false },
      { label: '6 meses de gastos', target: round2(essentialMonthlySpend * 6), reached: false },
    )
  }
  return stages.map((s) => ({ ...s, reached: currentAmount >= s.target }))
}

/** Ahorro mensual comprometido: aportes declarados de metas activas. */
export function committedMonthlySavings(goals: SavingsGoal[]): number {
  return round2(
    goals
      .filter((g) => g.deleted_at === null && g.status === 'activa')
      .reduce((sum, g) => sum + (g.monthly_contribution ?? 0), 0),
  )
}
