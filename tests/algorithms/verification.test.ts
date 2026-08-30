import { describe, expect, it } from 'vitest'
import {
  accountsMissingBalance,
  computeAccountBalanceOrNull,
  computeAvailableMoney,
  hasKnownBalance,
} from '@/algorithms/accounts/balance'
import { anyGoalProgress, debtGoalProgress } from '@/algorithms/savings/savings'
import type { Account, Debt, DebtPayment, SavingsContribution, SavingsGoal } from '@/types/database'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'Cuenta',
    type: 'bancaria', institution: null, currency: 'PEN', initial_balance: 0,
    is_verified: true, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'd1', user_id: 'u1', creditor: 'X', name: null, type: 'otro',
    credit_card_id: null, initial_balance: 1000, currency: 'PEN',
    tea: null, tcea: null, rate_type: 'tea', installment_amount: null,
    minimum_payment: null, num_installments: null, installments_paid: 0,
    insurance_monthly: 0, fees_monthly: 0, due_day: null,
    target_payoff_date: null, priority: 'media', status: 'activa',
    allows_early_payoff: 'desconocido', payment_strategy: null, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function payment(overrides: Partial<DebtPayment> = {}): DebtPayment {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', debt_id: 'd1',
    account_id: null, date: '2026-09-01', amount: 100, principal_amount: 100,
    interest_amount: 0, insurance_amount: 0, fees_amount: 0, penalty_amount: 0,
    is_extra_payment: false, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'g1', user_id: 'u1', name: 'Meta', kind: 'otro', target_amount: 1000,
    currency: 'PEN', target_date: null, monthly_contribution: null,
    priority: 'media', status: 'activa', debt_id: null, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

const empty = { incomes: [], expenses: [], transfers: [] }

describe('saldo desconocido ≠ saldo cero', () => {
  it('distingue una cuenta sin saldo registrado de una cuenta en cero', () => {
    expect(hasKnownBalance(account({ initial_balance: 0 }))).toBe(true)
    expect(hasKnownBalance(account({ initial_balance: null }))).toBe(false)
  })

  it('devuelve null en vez de un número inventado', () => {
    expect(computeAccountBalanceOrNull(account({ initial_balance: null }), empty)).toBeNull()
    expect(computeAccountBalanceOrNull(account({ initial_balance: 0 }), empty)).toBe(0)
    expect(computeAccountBalanceOrNull(account({ initial_balance: 161 }), empty)).toBe(161)
  })

  it('el dinero disponible excluye las cuentas de saldo desconocido', () => {
    const accounts = [
      account({ name: 'Ahorro BCP', initial_balance: 161 }),
      account({ name: 'Interbank', initial_balance: null }),
      account({ name: 'Efectivo', initial_balance: null }),
    ]
    // Solo cuenta lo que de verdad se sabe: 161, no 161 + 0 + 0.
    expect(computeAvailableMoney(accounts, empty)).toBe(161)
  })

  it('reporta qué cuentas necesitan que se registre su saldo', () => {
    const accounts = [
      account({ name: 'Ahorro BCP', initial_balance: 161 }),
      account({ name: 'Interbank', initial_balance: null }),
      account({ name: 'Trading', initial_balance: null, is_verified: false }),
      account({ name: 'Vieja', initial_balance: null, deleted_at: 'x' }),
    ]
    const missing = accountsMissingBalance(accounts).map((a) => a.name)
    expect(missing).toEqual(['Interbank']) // no verificadas y borradas quedan fuera
  })

  it('los movimientos se suman igual sobre una cuenta de saldo desconocido', () => {
    // Sin saldo de partida, el cálculo arranca de cero pero la cuenta sigue
    // marcada como "sin saldo conocido" para la interfaz.
    const acc = account({ id: 'a1', initial_balance: null })
    expect(computeAccountBalanceOrNull(acc, empty)).toBeNull()
    expect(hasKnownBalance(acc)).toBe(false)
  })
})

describe('progreso de metas vinculadas a una deuda', () => {
  const sip = debt({ id: 'sip', creditor: 'SIP', initial_balance: 1042.37 })

  it('mide el avance por lo que bajó la deuda, no por aportes', () => {
    const metaSip = goal({ target_amount: 1042.37, debt_id: 'sip' })
    const pagos = [payment({ debt_id: 'sip', amount: 500, principal_amount: 500 })]
    const progress = debtGoalProgress(metaSip, [sip], pagos)
    expect(progress).not.toBeNull()
    expect(progress!.paid).toBe(500)
    expect(progress!.remaining).toBe(542.37)
    expect(progress!.ratio).toBeCloseTo(0.48, 2)
  })

  it('el ejemplo de Rody: 1,110 originales − 300 pagados = 27 % de avance', () => {
    const rody = debt({ id: 'rody', creditor: 'Rody', initial_balance: 1110, rate_type: 'sin_interes' })
    const metaRody = goal({ target_amount: 810, debt_id: 'rody' })
    const progress = debtGoalProgress(metaRody, [rody], [
      payment({ debt_id: 'rody', amount: 300, principal_amount: 300 }),
    ])
    expect(progress!.remaining).toBe(810)
    expect(progress!.ratio).toBeCloseTo(0.27, 2)
  })

  it('devuelve null si la meta no apunta a ninguna deuda', () => {
    expect(debtGoalProgress(goal({ debt_id: null }), [sip], [])).toBeNull()
    expect(debtGoalProgress(goal({ debt_id: 'inexistente' }), [sip], [])).toBeNull()
  })

  it('una meta liquidada llega al 100 %', () => {
    const metaSip = goal({ target_amount: 1042.37, debt_id: 'sip' })
    const progress = debtGoalProgress(metaSip, [sip], [
      payment({ debt_id: 'sip', amount: 1042.37, principal_amount: 1042.37 }),
    ])
    expect(progress!.remaining).toBe(0)
    expect(progress!.ratio).toBe(1)
  })
})

describe('anyGoalProgress', () => {
  it('usa la deuda cuando la meta está vinculada', () => {
    const sip = debt({ id: 'sip', initial_balance: 1000 })
    const result = anyGoalProgress(
      goal({ debt_id: 'sip' }), [], [sip],
      [payment({ debt_id: 'sip', amount: 250, principal_amount: 250 })],
    )
    expect(result.fromDebt).toBe(true)
    expect(result.current).toBe(250)
    expect(result.ratio).toBe(0.25)
  })

  it('usa los aportes cuando no lo está', () => {
    const contribs: SavingsContribution[] = [
      {
        id: 'c1', user_id: 'u1', goal_id: 'g1', account_id: null,
        date: '2026-09-01', amount: 400, notes: null,
        created_at: '', updated_at: '', deleted_at: null,
      },
    ]
    const result = anyGoalProgress(goal({ target_amount: 1600 }), contribs, [], [])
    expect(result.fromDebt).toBe(false)
    expect(result.current).toBe(400)
    expect(result.ratio).toBe(0.25)
  })
})
