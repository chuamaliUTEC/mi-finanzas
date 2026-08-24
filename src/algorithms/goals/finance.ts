/** Future value of a lump sum plus a monthly contribution annuity. */
export function futureValue(principal: number, monthlyContribution: number, monthlyRate: number, months: number): number {
  if (months <= 0) return principal
  const growthFactor = Math.pow(1 + monthlyRate, months)
  const principalGrowth = principal * growthFactor
  const annuityGrowth =
    monthlyRate === 0 ? monthlyContribution * months : monthlyContribution * ((growthFactor - 1) / monthlyRate)
  return principalGrowth + annuityGrowth
}

/** Deflates a future nominal amount to today's purchasing power. */
export function realValue(nominalAmount: number, annualInflation: number, years: number): number {
  return nominalAmount / Math.pow(1 + annualInflation, years)
}

export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1
}

/** Standard fixed-rate loan payment (French amortization system). */
export function loanMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0) return principal
  const monthlyRate = annualToMonthlyRate(annualRate)
  if (monthlyRate === 0) return principal / termMonths
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
}

/** Months of saving `monthlyContribution` (from `principal`) needed to reach `target`. */
export function monthsToReach(target: number, principal: number, monthlyContribution: number, monthlyRate: number): number | null {
  if (principal >= target) return 0
  if (monthlyContribution <= 0 && monthlyRate <= 0) return null
  let months = 0
  let balance = principal
  const maxMonths = 1200 // 100 years safety cap
  while (balance < target && months < maxMonths) {
    balance = balance * (1 + monthlyRate) + monthlyContribution
    months += 1
  }
  return balance >= target ? months : null
}
