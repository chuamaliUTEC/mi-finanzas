import type { CategoryVariance } from '@/algorithms/budgeting'

export interface Recommendation {
  category: string
  title: string
  description: string
}

/**
 * Rule-based recommendations derived from budget variance.
 * Intentionally simple (no ML): flags categories over budget by more than 10%.
 */
export function recommendationsFromBudgetVariance(variances: CategoryVariance[]): Recommendation[] {
  return variances
    .filter((v) => v.planned > 0 && v.actual > v.planned * 1.1)
    .map((v) => ({
      category: v.categoryId ?? 'sin-categoria',
      title: 'Gasto por encima del presupuesto',
      description: `Esta categoría superó lo planeado en ${(v.actual - v.planned).toFixed(2)}. Considera ajustar el presupuesto o reducir el gasto el próximo mes.`,
    }))
}
