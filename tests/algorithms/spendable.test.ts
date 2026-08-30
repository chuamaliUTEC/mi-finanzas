import { describe, expect, it } from 'vitest'
import {
  computeSpendable,
  monthlyExpectedIncome,
  nextOccurrence,
  upcomingPayments,
} from '@/algorithms/spendable/spendable'
import type {
  BudgetCategory,
  CreditCard,
  Debt,
  Expense,
  IncomeSource,
  RecurringExpense,
} from '@/types/database'

function debt(overrides: Partial<Debt>): Debt {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', creditor: 'X',
    name: null, type: 'otro', credit_card_id: null, initial_balance: 1000,
    currency: 'PEN', tea: null, tcea: null, rate_type: 'tea',
    installment_amount: null, minimum_payment: null, num_installments: null,
    installments_paid: 0, insurance_monthly: 0, fees_monthly: 0,
    due_day: null, target_payoff_date: null, priority: 'media',
    status: 'activa', allows_early_payoff: 'desconocido',
    payment_strategy: null, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function recurring(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'R',
    amount: 50, currency: 'PEN', category_id: null, due_day: null,
    is_active: true, needs_verification: false, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function budgetCat(overrides: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', budget_id: 'b1',
    category_id: 'cat1', planned_amount: 0, is_protected: false,
    created_at: '', updated_at: '',
    ...overrides,
  }
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', account_id: null,
    credit_card_id: null, category_id: 'cat1', subcategory_id: null,
    amount: 0, currency: 'PEN', date: '2026-09-05',
    payment_method: 'efectivo', merchant: null, description: null, tags: [],
    is_recurring: false, necessity: 'necesario', is_emotional: false,
    status: 'confirmado', receipt_url: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function source(overrides: Partial<IncomeSource>): IncomeSource {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'S',
    kind: 'fijo', recurrence: 'mensual', expected_amount: 100,
    currency: 'PEN', reliability: 'alta', is_verified: true,
    verification_status: 'confirmado', verification_note: null,
    expected_day: null, is_active: true, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function card(overrides: Partial<CreditCard>): CreditCard {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'Card',
    issuer: null, credit_line: 1000, cash_line: 0, currency: 'PEN',
    tea_purchases: null, tea_cash: null, tea_usd: null, tea_cash_advance: null, membership_charge_date: null, membership_fee: 0,
    insurance_monthly: 0, closing_day: null, payment_day: null,
    benefits: null, notes: null, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

// 10 de septiembre de 2026 (30 días el mes → 21 días restantes).
const TODAY = new Date(2026, 8, 10)

describe('nextOccurrence', () => {
  it('este mes si el día aún no pasa; el próximo si ya pasó', () => {
    expect(nextOccurrence(20, TODAY)).toBe('2026-09-20')
    expect(nextOccurrence(5, TODAY)).toBe('2026-10-05')
    expect(nextOccurrence(10, TODAY)).toBe('2026-09-10') // hoy cuenta
  })

  it('ajusta el día 31 a meses cortos', () => {
    expect(nextOccurrence(31, TODAY)).toBe('2026-09-30')
  })
})

describe('computeSpendable', () => {
  it('resta obligaciones de deuda, recurrentes y presupuesto protegido', () => {
    const result = computeSpendable({
      availableMoney: 2000,
      debts: [debt({ minimum_payment: 348.44, due_day: 20 })],
      debtPayments: [],
      recurring: [recurring({ amount: 32.9, due_day: 15 }), recurring({ amount: 100 })],
      budgetCategories: [budgetCat({ planned_amount: 300, is_protected: true })],
      monthExpenses: [expense({ amount: 120 })],
      today: TODAY,
    })
    // 2000 − 348.44 − (32.90 + 100) − (300 − 120) = 1338.66
    expect(result.breakdown.debtObligations).toBeCloseTo(348.44, 2)
    expect(result.breakdown.recurringPending).toBeCloseTo(132.9, 2)
    expect(result.breakdown.protectedBudgetRemaining).toBe(180)
    expect(result.month).toBeCloseTo(1338.66, 2)
    expect(result.daysRemaining).toBe(21)
    expect(result.today).toBeCloseTo(1338.66 / 21, 2)
    expect(result.week).toBeCloseTo((1338.66 / 21) * 7, 1)
  })

  it('no resta deudas ya vencidas este mes (siguiente ocurrencia el mes próximo)', () => {
    const result = computeSpendable({
      availableMoney: 1000,
      debts: [debt({ minimum_payment: 200, due_day: 5 })], // ya pasó el 5
      debtPayments: [],
      recurring: [],
      budgetCategories: [],
      monthExpenses: [],
      today: TODAY,
    })
    expect(result.breakdown.debtObligations).toBe(0)
    expect(result.month).toBe(1000)
  })

  it('puede ser negativo y lo dice sin dividir en días', () => {
    const result = computeSpendable({
      availableMoney: 100,
      debts: [debt({ minimum_payment: 500, due_day: 25 })],
      debtPayments: [],
      recurring: [],
      budgetCategories: [],
      monthExpenses: [],
      today: TODAY,
    })
    expect(result.month).toBe(-400)
    expect(result.today).toBe(-400)
    expect(result.week).toBe(-400)
  })

  it('resta el ahorro comprometido', () => {
    const result = computeSpendable({
      availableMoney: 1000,
      debts: [], debtPayments: [], recurring: [],
      budgetCategories: [], monthExpenses: [],
      committedSavings: 250,
      today: TODAY,
    })
    expect(result.month).toBe(750)
  })
})

describe('upcomingPayments', () => {
  it('ordena por fecha deudas, recurrentes y tarjetas', () => {
    const debts = [
      debt({ id: 'bcp', name: 'BCP', minimum_payment: 348.44, due_day: 20 }),
      debt({ id: 'sip', name: 'SIP', minimum_payment: 60, due_day: 25 }),
    ]
    const recs = [recurring({ name: 'Spotify', amount: 32.9, due_day: 15 })]
    const result = upcomingPayments(debts, [], recs, [], TODAY, 31)
    expect(result.map((p) => p.label)).toEqual(['Spotify', 'Pago BCP', 'Pago SIP'])
    expect(result[0].date).toBe('2026-09-15')
  })

  it('excluye deudas pagadas, no activadas y con saldo 0', () => {
    const debts = [
      debt({ minimum_payment: 100, due_day: 20, status: 'pagada' }),
      debt({ minimum_payment: 100, due_day: 20, status: 'no_activada' }),
    ]
    expect(upcomingPayments(debts, [], [], [], TODAY, 31)).toHaveLength(0)
  })

  it('la fecha de pago de una tarjeta sin deuda vinculada aparece como recordatorio', () => {
    const cards = [card({ name: 'Visa', payment_day: 18 })]
    const result = upcomingPayments([], [], [], cards, TODAY, 31)
    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('tarjeta')
  })
})

describe('monthlyExpectedIncome', () => {
  it('normaliza recurrencias (semanal ≈ ×4.33)', () => {
    expect(monthlyExpectedIncome(source({ expected_amount: 100, recurrence: 'semanal' }))).toBeCloseTo(433.33, 1)
    expect(monthlyExpectedIncome(source({ expected_amount: 2405, recurrence: 'mensual' }))).toBe(2405)
    expect(monthlyExpectedIncome(source({ expected_amount: 500, recurrence: 'eventual' }))).toBe(0)
    expect(monthlyExpectedIncome(source({ expected_amount: 100, is_active: false }))).toBe(0)
  })
})
