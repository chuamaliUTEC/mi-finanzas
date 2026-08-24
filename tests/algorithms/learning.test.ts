import { describe, expect, it } from 'vitest'
import { suggestBudgetAdjustments } from '@/algorithms/learning'

describe('suggestBudgetAdjustments', () => {
  it('suggests a higher planned amount when actual spend consistently exceeds it', () => {
    const suggestions = suggestBudgetAdjustments([
      { categoryId: 'c1', categoryName: 'Comida', monthlyActuals: [550, 590, 570], currentPlanned: 500 },
    ])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].suggestedPlanned).toBeCloseTo(570, 0)
  })

  it('does not suggest anything when there is not enough history', () => {
    const suggestions = suggestBudgetAdjustments([
      { categoryId: 'c1', categoryName: 'Comida', monthlyActuals: [550], currentPlanned: 500 },
    ])
    expect(suggestions).toHaveLength(0)
  })

  it('does not suggest anything when the gap is below the threshold', () => {
    const suggestions = suggestBudgetAdjustments([
      { categoryId: 'c1', categoryName: 'Comida', monthlyActuals: [505, 502], currentPlanned: 500 },
    ])
    expect(suggestions).toHaveLength(0)
  })
})
