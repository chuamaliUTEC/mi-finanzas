import { describe, expect, it } from 'vitest'
import { calculateForecastError, movingAverageForecast, projectNext12Months, projectNextPeriod } from '@/algorithms/forecasting'

describe('movingAverageForecast', () => {
  it('returns 0 for empty history', () => {
    expect(movingAverageForecast([])).toBe(0)
  })

  it('averages the last N entries', () => {
    const history = [{ amount: 100 }, { amount: 200 }, { amount: 300 }]
    expect(movingAverageForecast(history, 3)).toBe(200)
  })

  it('only considers the trailing window', () => {
    const history = [{ amount: 1000 }, { amount: 100 }, { amount: 200 }]
    expect(movingAverageForecast(history, 2)).toBe(150)
  })
})

describe('projectNextPeriod', () => {
  it('projects balance as income minus expenses', () => {
    const income = [{ amount: 1000 }, { amount: 1000 }]
    const expenses = [{ amount: 400 }, { amount: 600 }]
    const result = projectNextPeriod(income, expenses, 2)
    expect(result.projectedIncome).toBe(1000)
    expect(result.projectedExpenses).toBe(500)
    expect(result.projectedBalance).toBe(500)
  })
})

describe('projectNext12Months', () => {
  it('repeats the same moving-average projection for 12 months, numbered 1-12', () => {
    const income = [{ amount: 1000 }]
    const expenses = [{ amount: 400 }]
    const result = projectNext12Months(income, expenses)
    expect(result).toHaveLength(12)
    expect(result[0].monthOffset).toBe(1)
    expect(result[11].monthOffset).toBe(12)
    expect(result.every((m) => m.projectedIncome === 1000)).toBe(true)
  })
})

describe('calculateForecastError', () => {
  it('computes absolute and percent error', () => {
    const result = calculateForecastError(500, 600)
    expect(result.absoluteError).toBe(100)
    expect(result.percentError).toBe(20)
  })

  it('returns null percent error when forecast is 0', () => {
    const result = calculateForecastError(0, 100)
    expect(result.percentError).toBeNull()
  })
})
