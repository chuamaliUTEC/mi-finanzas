import { describe, expect, it } from 'vitest'
import { computeAccountBalance, computeAvailableMoney } from '@/algorithms/accounts/balance'
import type { Account, Expense, IncomeTransaction, Transfer } from '@/types/database'

function account(overrides: Partial<Account>): Account {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Cuenta',
    type: 'bancaria',
    institution: null,
    currency: 'PEN',
    initial_balance: 0,
    is_verified: true,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    ...overrides,
  }
}

function income(overrides: Partial<IncomeTransaction>): IncomeTransaction {
  return {
    id: 'i1',
    user_id: 'u1',
    source_id: null,
    account_id: 'a1',
    amount: 100,
    currency: 'PEN',
    date: '2026-08-01',
    status: 'realizado',
    description: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    ...overrides,
  }
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'e1',
    user_id: 'u1',
    account_id: 'a1',
    category_id: null,
    subcategory_id: null,
    amount: 50,
    currency: 'PEN',
    date: '2026-08-02',
    payment_method: 'efectivo',
    merchant: null,
    description: null,
    tags: [],
    is_recurring: false,
    necessity: 'necesario',
    is_emotional: false,
    status: 'confirmado',
    receipt_url: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    ...overrides,
  }
}

function transfer(overrides: Partial<Transfer>): Transfer {
  return {
    id: 't1',
    user_id: 'u1',
    from_account_id: 'a1',
    to_account_id: 'a2',
    amount: 30,
    currency: 'PEN',
    date: '2026-08-03',
    description: null,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    ...overrides,
  }
}

const empty = { incomes: [], expenses: [], transfers: [] }

describe('computeAccountBalance', () => {
  it('parte del saldo inicial', () => {
    expect(computeAccountBalance(account({ initial_balance: 500 }), empty)).toBe(500)
  })

  it('suma ingresos realizados y resta gastos confirmados', () => {
    const result = computeAccountBalance(account({}), {
      incomes: [income({ amount: 2405 })],
      expenses: [expense({ amount: 405 })],
      transfers: [],
    })
    expect(result).toBe(2000)
  })

  it('NO suma ingresos esperados, estimados, pendientes ni no verificados', () => {
    const result = computeAccountBalance(account({}), {
      incomes: [
        income({ amount: 100, status: 'realizado' }),
        income({ id: 'i2', amount: 999, status: 'esperado' }),
        income({ id: 'i3', amount: 999, status: 'estimado' }),
        income({ id: 'i4', amount: 999, status: 'pendiente' }),
        income({ id: 'i5', amount: 999, status: 'no_verificado' }),
      ],
      expenses: [],
      transfers: [],
    })
    expect(result).toBe(100)
  })

  it('las transferencias mueven dinero entre cuentas sin crear ni destruir valor', () => {
    const data = {
      incomes: [income({ amount: 200 })],
      expenses: [],
      transfers: [transfer({ amount: 80 })],
    }
    const a1 = computeAccountBalance(account({ id: 'a1' }), data)
    const a2 = computeAccountBalance(account({ id: 'a2' }), data)
    expect(a1).toBe(120)
    expect(a2).toBe(80)
    expect(a1 + a2).toBe(200) // ni ingreso ni gasto neto
  })

  it('ignora movimientos con soft delete y gastos anulados', () => {
    const result = computeAccountBalance(account({ initial_balance: 100 }), {
      incomes: [income({ amount: 50, deleted_at: '2026-08-05' })],
      expenses: [expense({ amount: 40, status: 'anulado' })],
      transfers: [transfer({ amount: 10, deleted_at: '2026-08-05' })],
    })
    expect(result).toBe(100)
  })
})

describe('computeAvailableMoney', () => {
  it('excluye cuentas no verificadas (activo declarado ≠ dinero disponible)', () => {
    const accounts = [
      account({ id: 'a1', initial_balance: 600 }),
      account({ id: 'a2', name: 'Trading', initial_balance: 3000, is_verified: false }),
    ]
    expect(computeAvailableMoney(accounts, empty)).toBe(600)
  })

  it('excluye cuentas eliminadas y otras monedas', () => {
    const accounts = [
      account({ id: 'a1', initial_balance: 100 }),
      account({ id: 'a2', initial_balance: 100, deleted_at: '2026-08-01' }),
      account({ id: 'a3', initial_balance: 100, currency: 'USD' }),
    ]
    expect(computeAvailableMoney(accounts, empty)).toBe(100)
  })
})
