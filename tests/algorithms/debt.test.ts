import { describe, expect, it } from 'vitest'
import { avalancheOrder, snowballOrder, totalOutstandingDebt } from '@/algorithms/debt'
import type { Debt } from '@/types/database'

const baseDebt: Debt = {
  id: '1',
  user_id: 'u1',
  name: 'Tarjeta A',
  creditor: null,
  original_amount: 1000,
  current_balance: 1000,
  interest_rate: 0,
  minimum_payment: null,
  due_day: null,
  status: 'active',
  created_at: '',
  updated_at: '',
}

const debts: Debt[] = [
  { ...baseDebt, id: '1', name: 'Grande', current_balance: 5000, interest_rate: 10 },
  { ...baseDebt, id: '2', name: 'Chica', current_balance: 200, interest_rate: 25 },
  { ...baseDebt, id: '3', name: 'Pagada', current_balance: 0, interest_rate: 5, status: 'paid_off' },
]

describe('snowballOrder', () => {
  it('orders active debts by smallest balance first', () => {
    const result = snowballOrder(debts)
    expect(result.map((r) => r.name)).toEqual(['Chica', 'Grande'])
  })
})

describe('avalancheOrder', () => {
  it('orders active debts by highest interest rate first', () => {
    const result = avalancheOrder(debts)
    expect(result.map((r) => r.name)).toEqual(['Chica', 'Grande'])
  })
})

describe('totalOutstandingDebt', () => {
  it('sums only active debts', () => {
    expect(totalOutstandingDebt(debts)).toBe(5200)
  })
})
