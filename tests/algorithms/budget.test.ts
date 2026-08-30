import { describe, expect, it } from 'vitest'
import {
  computeBudgetStatus,
  daysInMonth,
  detectRecurringCandidates,
  recurringMonthlyTotal,
} from '@/algorithms/budget/budget'
import type { BudgetCategory, Expense, RecurringExpense } from '@/types/database'

function budgetCat(overrides: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: 'bc1', user_id: 'u1', budget_id: 'b1', category_id: 'cat1',
    planned_amount: 300, is_protected: false, created_at: '', updated_at: '',
    ...overrides,
  }
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', account_id: null,
    credit_card_id: null, category_id: 'cat1', subcategory_id: null,
    amount: 100, currency: 'PEN', date: '2026-09-10',
    payment_method: 'efectivo', merchant: null, description: null, tags: [],
    is_recurring: false, necessity: 'necesario', is_emotional: false,
    status: 'confirmado', receipt_url: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function recurring(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'Spotify',
    amount: 32.9, currency: 'PEN', category_id: null, due_day: null,
    is_active: true, needs_verification: false, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

describe('computeBudgetStatus', () => {
  it('ejemplo del prompt: S/ 300 de presupuesto, S/ 220 gastados a mitad de mes → proyección excede', () => {
    // 15 de septiembre de 2026, gastados 220 de 300
    const [status] = computeBudgetStatus(
      [budgetCat({ planned_amount: 300 })],
      [expense({ amount: 220, date: '2026-09-10' })],
      2026, 9,
      new Date(2026, 8, 15),
    )
    expect(status.spent).toBe(220)
    expect(status.difference).toBe(80)
    expect(status.projected).toBe(440) // 220/15 * 30
    expect(status.status).toBe('camino_a_exceder')
  })

  it('excedido cuando el gasto ya superó lo planificado', () => {
    const [status] = computeBudgetStatus(
      [budgetCat({ planned_amount: 300 })],
      [expense({ amount: 350 })],
      2026, 9,
      new Date(2026, 8, 20),
    )
    expect(status.status).toBe('excedido')
  })

  it('ok cuando el ritmo se mantiene dentro del plan', () => {
    const [status] = computeBudgetStatus(
      [budgetCat({ planned_amount: 300 })],
      [expense({ amount: 100 })],
      2026, 9,
      new Date(2026, 8, 20),
    )
    expect(status.projected).toBe(150)
    expect(status.status).toBe('ok')
  })

  it('ignora gastos de otros meses, otras categorías, anulados y eliminados', () => {
    const [status] = computeBudgetStatus(
      [budgetCat({ planned_amount: 300 })],
      [
        expense({ amount: 50, date: '2026-08-10' }),
        expense({ amount: 50, category_id: 'other' }),
        expense({ amount: 50, status: 'anulado' }),
        expense({ amount: 50, deleted_at: 'x' }),
        expense({ amount: 60 }),
      ],
      2026, 9,
      new Date(2026, 8, 15),
    )
    expect(status.spent).toBe(60)
  })

  it('para meses pasados no proyecta más allá de lo gastado', () => {
    const [status] = computeBudgetStatus(
      [budgetCat({ planned_amount: 300 })],
      [expense({ amount: 200, date: '2026-07-10' })],
      2026, 7,
      new Date(2026, 8, 15),
    )
    expect(status.projected).toBe(200)
  })
})

describe('recurringMonthlyTotal', () => {
  it('suma solo recurrentes activos y no eliminados', () => {
    const total = recurringMonthlyTotal([
      recurring({ amount: 32.9 }),
      recurring({ amount: 6 }),
      recurring({ amount: 88, is_active: false }),
      recurring({ amount: 100, deleted_at: 'x' }),
    ])
    expect(total).toBeCloseTo(38.9, 2)
  })
})

describe('detectRecurringCandidates', () => {
  it('propone un gasto que se repite en 3 meses con montos similares', () => {
    const candidates = detectRecurringCandidates(
      [
        expense({ merchant: 'Netflix', amount: 35, date: '2026-06-05' }),
        expense({ merchant: 'Netflix', amount: 35, date: '2026-07-05' }),
        expense({ merchant: 'Netflix', amount: 36, date: '2026-08-05' }),
      ],
      [],
    )
    expect(candidates).toHaveLength(1)
    expect(candidates[0].label).toBe('Netflix')
    expect(candidates[0].months).toBe(3)
  })

  it('no propone si ya existe como recurrente ni con montos muy dispares', () => {
    const netflix = [
      expense({ merchant: 'Netflix', amount: 35, date: '2026-06-05' }),
      expense({ merchant: 'Netflix', amount: 35, date: '2026-07-05' }),
      expense({ merchant: 'Netflix', amount: 35, date: '2026-08-05' }),
    ]
    expect(detectRecurringCandidates(netflix, [recurring({ name: 'Netflix' })])).toHaveLength(0)

    const variable = [
      expense({ merchant: 'Mercado', amount: 20, date: '2026-06-05' }),
      expense({ merchant: 'Mercado', amount: 90, date: '2026-07-05' }),
      expense({ merchant: 'Mercado', amount: 300, date: '2026-08-05' }),
    ]
    expect(detectRecurringCandidates(variable, [])).toHaveLength(0)
  })
})

describe('daysInMonth', () => {
  it('conoce los días de cada mes, incluidos bisiestos', () => {
    expect(daysInMonth(2026, 9)).toBe(30)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
  })
})
