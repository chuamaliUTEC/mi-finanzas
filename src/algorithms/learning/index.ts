export interface BudgetAdjustmentSuggestion {
  categoryId: string
  categoryName: string
  currentPlanned: number
  suggestedPlanned: number
  monthsAnalyzed: number
  reason: string
}

interface MonthlyActualByCategory {
  categoryId: string
  categoryName: string
  monthlyActuals: number[] // one entry per month with budget data, chronological
  currentPlanned: number
}

/**
 * Suggests a new planned amount per category based on the historical
 * average of what was actually spent, but never applies it automatically —
 * the caller must record an explicit approval (learning_adjustments).
 * Only suggests when there's enough history and a meaningful gap.
 */
export function suggestBudgetAdjustments(
  data: MonthlyActualByCategory[],
  options?: { minMonths?: number; thresholdPct?: number },
): BudgetAdjustmentSuggestion[] {
  const minMonths = options?.minMonths ?? 2
  const thresholdPct = options?.thresholdPct ?? 0.1

  const suggestions: BudgetAdjustmentSuggestion[] = []
  for (const item of data) {
    if (item.monthlyActuals.length < minMonths) continue
    const avgActual = item.monthlyActuals.reduce((sum, v) => sum + v, 0) / item.monthlyActuals.length
    const gap = Math.abs(avgActual - item.currentPlanned)
    const gapPct = item.currentPlanned === 0 ? (avgActual > 0 ? 1 : 0) : gap / item.currentPlanned
    if (gapPct < thresholdPct) continue

    suggestions.push({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      currentPlanned: item.currentPlanned,
      suggestedPlanned: Math.round(avgActual * 100) / 100,
      monthsAnalyzed: item.monthlyActuals.length,
      reason:
        avgActual > item.currentPlanned
          ? `En los últimos ${item.monthlyActuals.length} meses gastaste en promedio ${avgActual.toFixed(2)}, más que los ${item.currentPlanned.toFixed(2)} planeados.`
          : `En los últimos ${item.monthlyActuals.length} meses gastaste en promedio ${avgActual.toFixed(2)}, menos que los ${item.currentPlanned.toFixed(2)} planeados.`,
    })
  }
  return suggestions
}
