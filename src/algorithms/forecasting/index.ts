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

export interface MonthlyProjection extends ForecastProjection {
  monthOffset: number // 1 = next month, 2 = month after, etc.
}

/**
 * Flat 12-month projection: repeats the moving-average estimate forward.
 * Intentionally does not assume growth/seasonality — only historical
 * averages, per the "no complex ML" requirement. Each real month that
 * passes should replace these numbers with actuals, which is what
 * calculateForecastError is for.
 */
export function projectNext12Months(
  incomeHistory: DatedAmount[],
  expenseHistory: DatedAmount[],
  windowSize = 3,
): MonthlyProjection[] {
  const base = projectNextPeriod(incomeHistory, expenseHistory, windowSize)
  return Array.from({ length: 12 }, (_, i) => ({ ...base, monthOffset: i + 1 }))
}

export interface ForecastError {
  absoluteError: number
  percentError: number | null // null when the forecast was 0 (division by zero)
}

export function calculateForecastError(forecast: number, actual: number): ForecastError {
  const absoluteError = actual - forecast
  const percentError = forecast === 0 ? null : (absoluteError / forecast) * 100
  return { absoluteError, percentError }
}
