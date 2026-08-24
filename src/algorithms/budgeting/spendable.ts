export interface SpendableInputs {
  liquidity: number
  reliableIncome: number
  essentialExpenses: number
  debtPayments: number
  savingsTarget: number
  goalContributions: number
  safetyMargin: number
}

export interface SpendableResult {
  amount: number
  breakdown: SpendableInputs
}

/**
 * "¿Cuánto puedo gastar?" — liquidity plus income you can actually count on,
 * minus everything already spoken for. Never treats gross income as free cash.
 */
export function calculateSpendable(inputs: SpendableInputs): SpendableResult {
  const amount = Math.max(
    inputs.liquidity +
      inputs.reliableIncome -
      inputs.essentialExpenses -
      inputs.debtPayments -
      inputs.savingsTarget -
      inputs.goalContributions -
      inputs.safetyMargin,
    0,
  )
  return { amount, breakdown: inputs }
}
