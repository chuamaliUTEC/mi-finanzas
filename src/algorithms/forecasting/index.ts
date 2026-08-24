interface DatedAmount {
  amount: number
}

/** Simple moving-average forecast: average of the last N periods, projected forward. */
export function movingAverageForecast(history: DatedAmount[], windowSize = 3): number {
  if (history.length === 0) return 0
  const window = history.slice(-windowSize)
  const total = window.reduce((sum, item) => sum + item.amount, 0)
  return total / window.length
}

export interface ForecastProjection {
  projectedIncome: number
  projectedExpenses: number
  projectedBalance: number
}

export function projectNextPeriod(
  incomeHistory: DatedAmount[],
  expenseHistory: DatedAmount[],
  windowSize = 3,
): ForecastProjection {
  const projectedIncome = movingAverageForecast(incomeHistory, windowSize)
  const projectedExpenses = movingAverageForecast(expenseHistory, windowSize)
  return {
    projectedIncome,
    projectedExpenses,
    projectedBalance: projectedIncome - projectedExpenses,
  }
}
