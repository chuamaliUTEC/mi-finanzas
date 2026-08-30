import { round2 } from '@/algorithms/accounts/balance'
import type { BudgetCategory, Expense, MonthlyBudget } from '@/types/database'

// Motor de aprendizaje (secc. 45): compara PLANIFICADO vs. REAL a lo largo
// de varios meses y propone ajustes. Nunca modifica un presupuesto solo:
// devuelve sugerencias que la usuaria confirma o descarta.

export interface LearningSuggestion {
  categoryId: string
  /** Desviación media (0.25 = el real supera al plan en 25 %). */
  deviation: number
  monthsObserved: number
  currentPlanned: number
  suggestedPlanned: number
  observation: string
}

interface MonthObservation {
  planned: number
  actual: number
}

/**
 * Detecta categorías cuyo presupuesto se queda sistemáticamente corto (o
 * sobra) y propone un nuevo monto base.
 *
 * Requiere al menos `minMonths` meses cerrados con la misma tendencia:
 * un mes malo no cambia un presupuesto.
 */
export function detectBudgetAdjustments(
  budgets: MonthlyBudget[],
  budgetCategories: BudgetCategory[],
  expenses: Expense[],
  today: Date,
  minMonths = 3,
  minDeviation = 0.15,
): LearningSuggestion[] {
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // Agrupa observaciones por categoría, solo de meses ya cerrados.
  const byCategory = new Map<string, MonthObservation[]>()
  for (const budget of budgets) {
    if (budget.deleted_at !== null) continue
    const key = `${budget.year}-${String(budget.month).padStart(2, '0')}`
    if (key >= currentKey) continue // el mes en curso aún no es evidencia

    for (const bc of budgetCategories.filter((c) => c.budget_id === budget.id)) {
      if (bc.planned_amount <= 0) continue
      const actual = expenses
        .filter(
          (e) =>
            e.deleted_at === null &&
            e.status === 'confirmado' &&
            e.category_id === bc.category_id &&
            e.date.slice(0, 7) === key,
        )
        .reduce((sum, e) => sum + e.amount, 0)
      const list = byCategory.get(bc.category_id) ?? []
      list.push({ planned: bc.planned_amount, actual })
      byCategory.set(bc.category_id, list)
    }
  }

  const suggestions: LearningSuggestion[] = []
  for (const [categoryId, observations] of byCategory) {
    if (observations.length < minMonths) continue

    const deviations = observations.map((o) => (o.actual - o.planned) / o.planned)
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length
    if (Math.abs(avgDeviation) < minDeviation) continue

    // Consistencia: la tendencia debe repetirse, no venir de un solo mes.
    const sameDirection = deviations.filter((d) =>
      avgDeviation > 0 ? d > 0 : d < 0,
    ).length
    if (sameDirection < Math.ceil(observations.length * 0.67)) continue

    const currentPlanned = observations[observations.length - 1].planned
    const avgActual = round2(
      observations.reduce((sum, o) => sum + o.actual, 0) / observations.length,
    )
    // Se sugiere el promedio real redondeado a la decena más cercana:
    // un número que se pueda sostener, no el pico de un mes.
    const suggested = Math.max(0, Math.round(avgActual / 10) * 10)
    if (suggested === currentPlanned) continue

    const pct = Math.abs(avgDeviation * 100).toFixed(0)
    suggestions.push({
      categoryId,
      deviation: round2(avgDeviation),
      monthsObserved: observations.length,
      currentPlanned,
      suggestedPlanned: suggested,
      observation:
        avgDeviation > 0
          ? `Tu presupuesto suele quedarse corto alrededor de ${pct} % (${observations.length} meses observados).`
          : `Sueles gastar ${pct} % menos de lo presupuestado (${observations.length} meses observados).`,
    })
  }

  return suggestions.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
}
