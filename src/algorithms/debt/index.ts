import type { Debt } from '@/types/database'

export interface PayoffPlanStep {
  debtId: string
  name: string
  balance: number
  order: number
}

/** Active debts whose balance is unknown ("por confirmar") — cannot be ranked. */
export function debtsPendingConfirmation(debts: Debt[]): Debt[] {
  return debts.filter((d) => d.status === 'active' && d.current_balance === null)
}

function activeWithKnownBalance(debts: Debt[]): (Debt & { current_balance: number })[] {
  return debts.filter(
    (d): d is Debt & { current_balance: number } => d.status === 'active' && d.current_balance !== null,
  )
}

/** Snowball method: pay off smallest balances first for quick psychological wins. */
export function snowballOrder(debts: Debt[]): PayoffPlanStep[] {
  return activeWithKnownBalance(debts)
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
  return activeWithKnownBalance(debts)
    .sort((a, b) => b.interest_rate - a.interest_rate)
    .map((debt, index) => ({
      debtId: debt.id,
      name: debt.name,
      balance: debt.current_balance,
      order: index + 1,
    }))
}

/** Sum of known balances only. Check debtsPendingConfirmation() to know if this is incomplete. */
export function totalOutstandingDebt(debts: Debt[]): number {
  return activeWithKnownBalance(debts).reduce((sum, debt) => sum + debt.current_balance, 0)
}
