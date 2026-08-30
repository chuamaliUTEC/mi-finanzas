import { describe, expect, it } from 'vitest'
import {
  committedMonthlySavings,
  emergencyFundStages,
  goalCurrentAmount,
  goalProgress,
  monthsToGoal,
} from '@/algorithms/savings/savings'
import { computeNetWorth, receivableBalance } from '@/algorithms/networth/networth'
import type {
  Account,
  Asset,
  Debt,
  Receivable,
  ReceivablePayment,
  SavingsContribution,
  SavingsGoal,
} from '@/types/database'

function goal(overrides: Partial<SavingsGoal>): SavingsGoal {
  return {
    id: 'g1', user_id: 'u1', name: 'Meta', kind: 'otro', target_amount: 1600,
    currency: 'PEN', target_date: null, monthly_contribution: null,
    priority: 'media', status: 'activa', notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function contribution(overrides: Partial<SavingsContribution>): SavingsContribution {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', goal_id: 'g1',
    account_id: null, date: '2026-09-01', amount: 100, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function account(overrides: Partial<Account>): Account {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'C',
    type: 'bancaria', institution: null, currency: 'PEN', initial_balance: 0,
    is_verified: true, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function receivable(overrides: Partial<Receivable>): Receivable {
  return {
    id: 'r1', user_id: 'u1', person: 'P', original_amount: 500,
    currency: 'PEN', expected_date: null, status: 'pendiente', notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function rPayment(overrides: Partial<ReceivablePayment>): ReceivablePayment {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', receivable_id: 'r1',
    account_id: null, date: '2026-09-01', amount: 100, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

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

function asset(overrides: Partial<Asset>): Asset {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'A',
    kind: 'otro', value: 100, currency: 'PEN', is_verified: false,
    notes: null, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

describe('metas de ahorro', () => {
  it('monto actual = suma de aportes (retiros negativos incluidos)', () => {
    const g = goal({})
    const contribs = [
      contribution({ amount: 300 }),
      contribution({ amount: 200 }),
      contribution({ amount: -100 }),
      contribution({ amount: 500, deleted_at: 'x' }),
    ]
    expect(goalCurrentAmount(g, contribs)).toBe(400)
    expect(goalProgress(g, contribs)).toBe(0.25)
  })

  it('meses a la meta con aporte mensual', () => {
    const g = goal({ target_amount: 1600, monthly_contribution: 200 })
    expect(monthsToGoal(g, [contribution({ amount: 600 })])).toBe(5)
    expect(monthsToGoal(g, [contribution({ amount: 1600 })])).toBe(0)
    expect(monthsToGoal(goal({ monthly_contribution: null }), [])).toBe(Infinity)
  })

  it('ahorro comprometido suma solo metas activas', () => {
    expect(
      committedMonthlySavings([
        goal({ monthly_contribution: 200 }),
        goal({ monthly_contribution: 100, status: 'pausada' }),
        goal({ monthly_contribution: 50, deleted_at: 'x' }),
      ]),
    ).toBe(200)
  })
})

describe('emergencyFundStages', () => {
  it('etapas fijas + 3 y 6 meses del gasto esencial', () => {
    const stages = emergencyFundStages(1200, 800)
    expect(stages.map((s) => s.target)).toEqual([500, 1000, 1600, 2400, 4800])
    expect(stages.map((s) => s.reached)).toEqual([true, true, false, false, false])
  })

  it('sin gasto esencial conocido solo muestra los hitos fijos', () => {
    expect(emergencyFundStages(0, 0)).toHaveLength(3)
  })
})

describe('receivableBalance', () => {
  it('saldo = original − cobros', () => {
    const r = receivable({ original_amount: 500 })
    expect(receivableBalance(r, [rPayment({ amount: 100 }), rPayment({ amount: 150 })])).toBe(250)
    expect(receivableBalance(r, [rPayment({ amount: 600 })])).toBe(0)
  })
})

describe('computeNetWorth', () => {
  it('reproduce el perfil inicial: activos ~3,535 − pasivos ~9,953 (sin UTEC)', () => {
    // Aproximación del perfil: 3,000 trading (no verificado) + 535 por cobrar
    const result = computeNetWorth({
      accounts: [account({ initial_balance: 3000, is_verified: false })],
      incomes: [], expenses: [], transfers: [],
      assets: [],
      receivables: [
        receivable({ id: 'p', original_amount: 500 }),
        receivable({ id: 'l', original_amount: 35 }),
      ],
      receivablePayments: [],
      debts: [
        debt({ initial_balance: 980.99 }),
        debt({ initial_balance: 3194.84 }),
        debt({ initial_balance: 810 }),
        debt({ initial_balance: 4967 }),
        debt({ initial_balance: 84633.6, status: 'no_activada' }), // UTEC fuera
      ],
      debtPayments: [],
    })
    expect(result.unverifiedAssets).toBe(3000)
    expect(result.receivablesPending).toBe(535)
    expect(result.totalAssets).toBe(3535)
    expect(result.totalLiabilities).toBeCloseTo(9952.83, 2)
    expect(result.netWorth).toBeCloseTo(3535 - 9952.83, 2)
  })

  it('separa activos verificados de no verificados y excluye incobrables', () => {
    const result = computeNetWorth({
      accounts: [account({ initial_balance: 600 })],
      incomes: [], expenses: [], transfers: [],
      assets: [asset({ value: 1000, is_verified: false })],
      receivables: [receivable({ status: 'incobrable' })],
      receivablePayments: [],
      debts: [],
      debtPayments: [],
    })
    expect(result.verifiedAssets).toBe(600)
    expect(result.unverifiedAssets).toBe(1000)
    expect(result.receivablesPending).toBe(0)
    expect(result.netWorth).toBe(1600)
  })
})
