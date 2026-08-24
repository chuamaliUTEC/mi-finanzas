import type { Debt } from '@/types/database'

export interface PayoffPlanStep {
  debtId: string
  name: string
  balance: number
  order: number
}

/** Snowball method: pay off smallest balances first for quick psychological wins. */
export function snowballOrder(debts: Debt[]): PayoffPlanStep[] {
  return [...debts]
    .filter((d) => d.status === 'active')
    .sort((a, b) => a.current_balance - b.current_balance)
    .map((debt, index) => ({
      debtId: debt.id,
      name: debt.name,
      balance: debt.current_balance,
      order: index + 1,
    }))
}

/** Avalanche method: pay off highest interest rate first to minimize total interest paid. */
export function avalancheOrder(debts: Debt[]): PayoffPlanStep[] {
  return [...debts]
    .filter((d) => d.status === 'active')
    .sort((a, b) => b.interest_rate - a.interest_rate)
    .map((debt, index) => ({
      debtId: debt.id,
      name: debt.name,
      balance: debt.current_balance,
      order: index + 1,
    }))
}

export function totalOutstandingDebt(debts: Debt[]): number {
  return debts
    .filter((d) => d.status === 'active')
    .reduce((sum, debt) => sum + Number(debt.current_balance), 0)
}
