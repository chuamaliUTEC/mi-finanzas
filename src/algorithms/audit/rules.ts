import type { AlertSeverity, AlertType, Debt, Expense, RecurringExpense, SavingsGoal } from '@/types/database'
import type { CategoryVariance } from '@/algorithms/budgeting'

export interface AuditFinding {
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  relatedTable?: string
  relatedId?: string
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const variance = mean(values.map((v) => (v - avg) ** 2))
  return Math.sqrt(variance)
}

/** Flags expenses that are statistical outliers within their own category's history. */
export function findAbnormalExpenses(expenses: Expense[]): AuditFinding[] {
  const byCategory = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const key = expense.category_id ?? 'sin-categoria'
    const list = byCategory.get(key) ?? []
    list.push(expense)
    byCategory.set(key, list)
  }

  const findings: AuditFinding[] = []
  for (const categoryExpenses of byCategory.values()) {
    if (categoryExpenses.length < 4) continue // not enough history to judge "abnormal"
    for (const expense of categoryExpenses) {
      // Leave-one-out: compare each expense against the OTHERS in its category,
      // so one huge outlier doesn't inflate its own threshold and hide itself.
      const others = categoryExpenses.filter((e) => e.id !== expense.id).map((e) => Number(e.amount))
      const avg = mean(others)
      const sd = stdDev(others)
      if (sd === 0) continue
      const amount = Number(expense.amount)
      if (amount > avg + 2 * sd) {
        findings.push({
          type: 'anomaly',
          severity: 'warning',
          title: 'Gasto inusualmente alto',
          message: `"${expense.description ?? 'Gasto'}" de ${amount.toFixed(2)} es mucho mayor que tu promedio habitual (${avg.toFixed(2)}) en esta categoría.`,
          relatedTable: 'expenses',
          relatedId: expense.id,
        })
      }
    }
  }
  return findings
}

/** Same amount, same category, within 1 day — likely a duplicate entry. */
export function findDuplicateExpenses(expenses: Expense[]): AuditFinding[] {
  const findings: AuditFinding[] = []
  const sorted = [...expenses].sort((a, b) => a.spent_at.localeCompare(b.spent_at))
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      const daysApart = Math.abs(new Date(a.spent_at).getTime() - new Date(b.spent_at).getTime()) / 86_400_000
      if (daysApart > 1) break
      if (a.category_id === b.category_id && Number(a.amount) === Number(b.amount)) {
        findings.push({
          type: 'anomaly',
          severity: 'warning',
          title: 'Posible gasto duplicado',
          message: `Dos gastos de ${Number(a.amount).toFixed(2)} en la misma categoría, con un día o menos de diferencia.`,
          relatedTable: 'expenses',
          relatedId: b.id,
        })
      }
    }
  }
  return findings
}

export function findOverBudgetCategories(variances: CategoryVariance[]): AuditFinding[] {
  return variances
    .filter((v) => v.overBudget)
    .map((v) => ({
      type: 'overspend' as const,
      severity: 'warning' as const,
      title: 'Sobre acostado en un sobre',
      message: `Gastaste ${v.actual.toFixed(2)} contra ${v.planned.toFixed(2)} planeado (excedido en ${(v.actual - v.planned).toFixed(2)}).`,
      relatedTable: 'budget_categories',
    }))
}

export function findOverdueRecurringExpenses(recurring: RecurringExpense[], today = new Date()): AuditFinding[] {
  const todayISO = today.toISOString().slice(0, 10)
  return recurring
    .filter((r) => r.is_active && r.next_due_date < todayISO)
    .map((r) => ({
      type: 'due_date' as const,
      severity: 'warning' as const,
      title: 'Gasto recurrente vencido',
      message: `"${r.name}" (${Number(r.amount).toFixed(2)}) tenía vencimiento el ${r.next_due_date} y no se actualizó.`,
      relatedTable: 'recurring_expenses',
      relatedId: r.id,
    }))
}

export function findAtRiskGoals(goals: SavingsGoal[], today = new Date()): AuditFinding[] {
  const todayISO = today.toISOString().slice(0, 10)
  return goals
    .filter((g) => g.status === 'active' && g.target_date && g.target_date < todayISO && g.current_amount < g.target_amount)
    .map((g) => ({
      type: 'goal_at_risk' as const,
      severity: 'critical' as const,
      title: 'Meta atrasada',
      message: `"${g.name}" tenía fecha objetivo ${g.target_date} y aún le faltan ${(g.target_amount - g.current_amount).toFixed(2)}.`,
      relatedTable: 'savings_goals',
      relatedId: g.id,
    }))
}

export function findRecentNewDebts(debts: Debt[], today = new Date()): AuditFinding[] {
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return debts
    .filter((d) => new Date(d.created_at) >= sevenDaysAgo && d.status === 'active')
    .map((d) => ({
      type: 'other' as const,
      severity: 'info' as const,
      title: 'Deuda nueva registrada',
      message: `Se registró "${d.name}" esta semana.`,
      relatedTable: 'debts',
      relatedId: d.id,
    }))
}

export function runFullAudit(input: {
  expenses: Expense[]
  budgetVariances: CategoryVariance[]
  recurringExpenses: RecurringExpense[]
  savingsGoals: SavingsGoal[]
  debts: Debt[]
}): AuditFinding[] {
  return [
    ...findAbnormalExpenses(input.expenses),
    ...findDuplicateExpenses(input.expenses),
    ...findOverBudgetCategories(input.budgetVariances),
    ...findOverdueRecurringExpenses(input.recurringExpenses),
    ...findAtRiskGoals(input.savingsGoals),
    ...findRecentNewDebts(input.debts),
  ]
}
