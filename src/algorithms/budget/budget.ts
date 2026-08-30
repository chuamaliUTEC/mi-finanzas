import { round2 } from '@/algorithms/accounts/balance'
import type { BudgetCategory, Expense, RecurringExpense } from '@/types/database'

// Presupuesto (secc. 11): nunca solo "gasto máximo", siempre
// planificado vs. real vs. diferencia vs. proyección al cierre del mes.

export interface CategoryBudgetStatus {
  categoryId: string
  planned: number
  spent: number
  difference: number
  /** Gasto proyectado al cierre del mes al ritmo actual. */
  projected: number
  /** 'ok' | 'camino_a_exceder' | 'excedido' */
  status: 'ok' | 'camino_a_exceder' | 'excedido'
  isProtected: boolean
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isInMonth(dateIso: string, year: number, month: number): boolean {
  const [y, m] = dateIso.split('-').map(Number)
  return y === year && m === month
}

/**
 * Estado de cada categoría presupuestada para un mes dado.
 * `today` permite proyectar: si va la mitad del mes y ya gastaste X, la
 * proyección al cierre es X * (días del mes / días transcurridos).
 */
export function computeBudgetStatus(
  budgetCategories: BudgetCategory[],
  expenses: Expense[],
  year: number,
  month: number,
  today: Date,
): CategoryBudgetStatus[] {
  const totalDays = daysInMonth(year, month)
  const sameMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const elapsed = sameMonth ? Math.max(1, today.getDate()) : totalDays

  return budgetCategories.map((bc) => {
    const spent = round2(
      expenses
        .filter(
          (e) =>
            e.deleted_at === null &&
            e.status === 'confirmado' &&
            e.category_id === bc.category_id &&
            isInMonth(e.date, year, month),
        )
        .reduce((sum, e) => sum + e.amount, 0),
    )
    const projected = round2((spent / elapsed) * totalDays)
    const status: CategoryBudgetStatus['status'] =
      spent > bc.planned_amount
        ? 'excedido'
        : projected > bc.planned_amount
          ? 'camino_a_exceder'
          : 'ok'
    return {
      categoryId: bc.category_id,
      planned: bc.planned_amount,
      spent,
      difference: round2(bc.planned_amount - spent),
      projected,
      status,
      isProtected: bc.is_protected,
    }
  })
}

/** Total mensual comprometido en gastos recurrentes activos. */
export function recurringMonthlyTotal(recurring: RecurringExpense[]): number {
  return round2(
    recurring
      .filter((r) => r.deleted_at === null && r.is_active)
      .reduce((sum, r) => sum + r.amount, 0),
  )
}

export interface RecurringCandidate {
  key: string
  label: string
  averageAmount: number
  occurrences: number
  months: number
}

/**
 * Detección de gastos recurrentes (secc. 10): un gasto con el mismo
 * comercio/descripcion que aparece en ≥ minMonths meses distintos con
 * montos similares se propone como recurrente. No convierte nada solo:
 * genera la sugerencia "¿Quieres convertirlo en gasto recurrente?".
 */
export function detectRecurringCandidates(
  expenses: Expense[],
  existingRecurring: RecurringExpense[],
  minMonths = 3,
): RecurringCandidate[] {
  const groups = new Map<string, { amounts: number[]; months: Set<string>; label: string }>()
  for (const e of expenses) {
    if (e.deleted_at !== null || e.status !== 'confirmado' || e.is_recurring) continue
    const label = (e.merchant ?? e.description ?? '').trim()
    if (!label) continue
    const key = label.toLowerCase()
    const month = e.date.slice(0, 7)
    const group = groups.get(key) ?? { amounts: [], months: new Set<string>(), label }
    group.amounts.push(e.amount)
    group.months.add(month)
    groups.set(key, group)
  }

  const knownNames = new Set(
    existingRecurring.filter((r) => r.deleted_at === null).map((r) => r.name.toLowerCase()),
  )

  const candidates: RecurringCandidate[] = []
  for (const [key, group] of groups) {
    if (group.months.size < minMonths || knownNames.has(key)) continue
    const avg = group.amounts.reduce((a, b) => a + b, 0) / group.amounts.length
    const maxDeviation = Math.max(...group.amounts.map((a) => Math.abs(a - avg)))
    // montos "similares": desviación máxima ≤ 25 % del promedio
    if (maxDeviation > avg * 0.25) continue
    candidates.push({
      key,
      label: group.label,
      averageAmount: round2(avg),
      occurrences: group.amounts.length,
      months: group.months.size,
    })
  }
  return candidates.sort((a, b) => b.averageAmount - a.averageAmount)
}
