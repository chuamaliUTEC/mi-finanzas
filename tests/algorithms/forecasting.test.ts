import { describe, expect, it } from 'vitest'
import { movingAverageForecast, projectNextPeriod } from '@/algorithms/forecasting'

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
