import { describe, expect, it } from 'vitest'
import {
  findAbnormalExpenses,
  findAtRiskGoals,
  findDuplicateExpenses,
  findOverdueRecurringExpenses,
} from '@/algorithms/audit/rules'
import type { Expense, RecurringExpense, SavingsGoal } from '@/types/database'

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(),
    user_id: 'u1',
    account_id: null,
    category_id: 'cat1',
    amount: 50,
    currency: 'PEN',
    description: 'Gasto',
    spent_at: '2026-08-01',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('findAbnormalExpenses', () => {
  it('flags an amount far above the category average', () => {
    const expenses = [
      makeExpense({ amount: 20, spent_at: '2026-08-01' }),
      makeExpense({ amount: 22, spent_at: '2026-08-02' }),
      makeExpense({ amount: 21, spent_at: '2026-08-03' }),
      makeExpense({ amount: 500, spent_at: '2026-08-04' }),
    ]
    const findings = findAbnormalExpenses(expenses)
    expect(findings).toHaveLength(1)
  })

  it('does not flag anything with too little history', () => {
    const expenses = [makeExpense({ amount: 20 }), makeExpense({ amount: 500 })]
    expect(findAbnormalExpenses(expenses)).toHaveLength(0)
  })
})

describe('findDuplicateExpenses', () => {
  it('flags same amount + category within a day', () => {
    const expenses = [
      makeExpense({ amount: 30, spent_at: '2026-08-01', category_id: 'cat1' }),
      makeExpense({ amount: 30, spent_at: '2026-08-01', category_id: 'cat1' }),
    ]
    expect(findDuplicateExpenses(expenses)).toHaveLength(1)
  })

  it('does not flag different categories', () => {
    const expenses = [
      makeExpense({ amount: 30, spent_at: '2026-08-01', category_id: 'cat1' }),
      makeExpense({ amount: 30, spent_at: '2026-08-01', category_id: 'cat2' }),
    ]
    expect(findDuplicateExpenses(expenses)).toHaveLength(0)
  })
})

describe('findOverdueRecurringExpenses', () => {
  it('flags an active recurring expense past its due date', () => {
    const recurring: RecurringExpense = {
      id: '1', user_id: 'u1', category_id: null, name: 'Netflix', amount: 30,
      frequency: 'monthly', next_due_date: '2026-08-01', is_active: true, created_at: '', updated_at: '',
    }
    const findings = findOverdueRecurringExpenses([recurring], new Date('2026-08-24'))
    expect(findings).toHaveLength(1)
  })

  it('does not flag an inactive recurring expense', () => {
    const recurring: RecurringExpense = {
      id: '1', user_id: 'u1', category_id: null, name: 'Netflix', amount: 30,
      frequency: 'monthly', next_due_date: '2026-08-01', is_active: false, created_at: '', updated_at: '',
    }
    expect(findOverdueRecurringExpenses([recurring], new Date('2026-08-24'))).toHaveLength(0)
  })
})

describe('findAtRiskGoals', () => {
  it('flags an active goal past its target date and still short', () => {
    const goal: SavingsGoal = {
      id: '1', user_id: 'u1', name: 'Meta', target_amount: 1000, current_amount: 400,
      target_date: '2026-08-01', status: 'active', created_at: '', updated_at: '',
    }
    expect(findAtRiskGoals([goal], new Date('2026-08-24'))).toHaveLength(1)
  })

  it('does not flag a completed goal', () => {
    const goal: SavingsGoal = {
      id: '1', user_id: 'u1', name: 'Meta', target_amount: 1000, current_amount: 1000,
      target_date: '2026-08-01', status: 'completed', created_at: '', updated_at: '',
    }
    expect(findAtRiskGoals([goal], new Date('2026-08-24'))).toHaveLength(0)
  })
})
