import type { Account, CreditCard, Debt, Receivable, SavingsGoal } from '@/types/database'

export interface NetWorthBreakdown {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  hasUnknownValues: boolean
}

/**
 * Assets minus liabilities. Debts/cards with an unknown ("por confirmar")
 * balance are excluded from the sum rather than treated as 0, and flagged
 * via hasUnknownValues so the UI can warn the number is incomplete.
 */
export function calculateNetWorth(
  accounts: Account[],
  receivables: Receivable[],
  savingsGoals: SavingsGoal[],
  debts: Debt[],
  creditCards: CreditCard[],
): NetWorthBreakdown {
  const totalAssets =
    accounts.reduce((sum, a) => sum + Number(a.opening_balance), 0) +
    receivables.reduce((sum, r) => sum + Number(r.outstanding_amount), 0) +
    savingsGoals.reduce((sum, g) => sum + Number(g.current_amount), 0)

  let hasUnknownValues = false
  const debtLiability = debts
    .filter((d) => d.status === 'active')
    .reduce((sum, d) => {
      if (d.current_balance === null) {
        hasUnknownValues = true
        return sum
      }
      return sum + Number(d.current_balance)
    }, 0)
  const cardLiability = creditCards.reduce((sum, c) => {
    if (c.current_balance === null) {
      hasUnknownValues = true
      return sum
    }
    return sum + Number(c.current_balance)
  }, 0)

  const totalLiabilities = debtLiability + cardLiability

  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, hasUnknownValues }
}

export interface LiquidityBreakdown {
  disponible: number
  comprometido: number
  reservado: number
  invertido: number
  porCobrar: number
}

/**
 * Splits "money" into buckets so the UI never shows a single misleading
 * total. `disponible` is what's left after committed obligations, reserves
 * (savings goals) and money that's already out on loan to others.
 */
export function calculateLiquidity(params: {
  cashOnHand: number
  committedThisMonth: number
  savingsGoals: SavingsGoal[]
  receivables: Receivable[]
  invested: number
}): LiquidityBreakdown {
  const reservado = params.savingsGoals.reduce((sum, g) => sum + Number(g.current_amount), 0)
  const porCobrar = params.receivables.reduce((sum, r) => sum + Number(r.outstanding_amount), 0)
  const disponible = Math.max(params.cashOnHand - params.committedThisMonth - reservado, 0)

  return {
    disponible,
    comprometido: params.committedThisMonth,
    reservado,
    invertido: params.invested,
    porCobrar,
  }
}
