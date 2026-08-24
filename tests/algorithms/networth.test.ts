import { describe, expect, it } from 'vitest'
import { calculateNetWorth } from '@/algorithms/networth'
import type { Account, CreditCard, Debt, Receivable, SavingsGoal } from '@/types/database'

const account: Account = {
  id: 'a1',
  user_id: 'u1',
  name: 'Cuenta principal',
  type: 'checking',
  currency: 'PEN',
  opening_balance: 500,
  is_active: true,
  created_at: '',
  updated_at: '',
}

const receivable: Receivable = {
  id: 'r1',
  user_id: 'u1',
  debtor_name: 'Alguien',
  original_amount: 300,
  outstanding_amount: 300,
  due_date: null,
  status: 'pending',
  currency: 'PEN',
  status_detail: 'confirmado',
  notes: null,
  created_at: '',
  updated_at: '',
}

const goal: SavingsGoal = {
  id: 'g1',
  user_id: 'u1',
  name: 'Emergencia',
  target_amount: 1000,
  current_amount: 200,
  target_date: null,
  status: 'active',
  created_at: '',
  updated_at: '',
}

const knownDebt: Debt = {
  id: 'd1',
  user_id: 'u1',
  name: 'Deuda conocida',
  creditor: null,
  original_amount: 400,
  current_balance: 400,
  interest_rate: 0,
  minimum_payment: null,
  due_day: null,
  currency: 'PEN',
  status: 'active',
  status_detail: 'confirmado',
  created_at: '',
  updated_at: '',
}

const unknownDebt: Debt = {
  ...knownDebt,
  id: 'd2',
  name: 'Deuda desconocida',
  current_balance: null,
  status_detail: 'por_confirmar',
}

const card: CreditCard = {
  id: 'c1',
  user_id: 'u1',
  name: 'Tarjeta',
  issuer: null,
  last_four: null,
  credit_limit: 1000,
  current_balance: 100,
  statement_day: null,
  payment_due_day: null,
  interest_rate: 0,
  currency: 'PEN',
  status_detail: 'confirmado',
  created_at: '',
  updated_at: '',
}

describe('calculateNetWorth', () => {
  it('sums assets minus known liabilities and flags unknown balances', () => {
    const result = calculateNetWorth([account], [receivable], [goal], [knownDebt, unknownDebt], [card])
    // assets: 500 + 300 + 200 = 1000; liabilities (known only): 400 + 100 = 500
    expect(result.totalAssets).toBe(1000)
    expect(result.totalLiabilities).toBe(500)
    expect(result.netWorth).toBe(500)
    expect(result.hasUnknownValues).toBe(true)
  })

  it('does not flag unknown values when all balances are known', () => {
    const result = calculateNetWorth([account], [receivable], [goal], [knownDebt], [card])
    expect(result.hasUnknownValues).toBe(false)
  })
})
