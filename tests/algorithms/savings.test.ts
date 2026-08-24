import { describe, expect, it } from 'vitest'
import { calculateGoalProgress } from '@/algorithms/savings'
import type { SavingsGoal } from '@/types/database'

const goal: SavingsGoal = {
  id: '1',
  user_id: 'u1',
  name: 'Vacaciones',
  target_amount: 1000,
  current_amount: 250,
  target_date: '2026-12-24',
  status: 'active',
  created_at: '',
  updated_at: '',
}

describe('calculateGoalProgress', () => {
  it('calculates progress percent and remaining amount', () => {
    const result = calculateGoalProgress(goal, new Date('2026-08-24'))
    expect(result.progressPercent).toBe(25)
    expect(result.remaining).toBe(750)
    expect(result.monthsToTarget).toBe(4)
    expect(result.requiredMonthlyContribution).toBeCloseTo(187.5)
  })
})
