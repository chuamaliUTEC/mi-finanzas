import { round2 } from '@/algorithms/accounts/balance'

// Motor de amortización (sistema francés) usado por el simulador de deudas
// (secc. 17). Todas las tasas se expresan en porcentaje anual efectivo
// (TEA o TCEA, ej. 87.5 = 87.5 % anual).

/** Tasa mensual efectiva equivalente a una tasa anual efectiva. */
export function monthlyRateFromAnnual(annualPercent: number): number {
  if (annualPercent <= 0) return 0
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1
}

/** Cuota fija (sistema francés) sin seguros ni comisiones. */
export function frenchInstallment(principal: number, annualPercent: number, months: number): number {
  if (months <= 0) return 0
  const r = monthlyRateFromAnnual(annualPercent)
  if (r === 0) return round2(principal / months)
  return round2((principal * r) / (1 - Math.pow(1 + r, -months)))
}

export interface ScheduleRow {
  month: number
  payment: number
  interest: number
  principal: number
  insurance: number
  balance: number
}

export interface PayoffResult {
  months: number
  totalInterest: number
  totalPaid: number
  schedule: ScheduleRow[]
  /** true si el pago no cubre ni el interés mensual: la deuda nunca baja. */
  neverPaysOff: boolean
}

/**
 * Proyecta cuántos meses toma liquidar un saldo pagando `monthlyPayment`
 * (incluye seguro mensual fijo si existe). Horizonte máximo de seguridad:
 * 600 meses.
 */
export function projectPayoff(
  balance: number,
  annualPercent: number,
  monthlyPayment: number,
  insuranceMonthly = 0,
): PayoffResult {
  const r = monthlyRateFromAnnual(annualPercent)
  const schedule: ScheduleRow[] = []
  let remaining = balance
  let totalInterest = 0
  let totalPaid = 0
  let month = 0

  const effectivePayment = monthlyPayment - insuranceMonthly
  if (remaining > 0 && effectivePayment <= remaining * r) {
    return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity, schedule: [], neverPaysOff: true }
  }

  while (remaining > 0.005 && month < 600) {
    month += 1
    const interest = round2(remaining * r)
    let principal = round2(effectivePayment - interest)
    let payment = monthlyPayment
    if (principal >= remaining) {
      principal = remaining
      payment = round2(principal + interest + insuranceMonthly)
    }
    remaining = round2(remaining - principal)
    totalInterest = round2(totalInterest + interest)
    totalPaid = round2(totalPaid + payment)
    schedule.push({ month, payment, interest, principal, insurance: insuranceMonthly, balance: remaining })
  }

  return { months: month, totalInterest, totalPaid, schedule, neverPaysOff: false }
}

/**
 * Ahorro de intereses y tiempo al agregar un monto extra mensual frente al
 * pago base (secc. 17: "Si agregas S/ 300 mensuales a BCP…").
 */
export function compareExtraPayment(
  balance: number,
  annualPercent: number,
  basePayment: number,
  extraMonthly: number,
  insuranceMonthly = 0,
): { base: PayoffResult; withExtra: PayoffResult; interestSaved: number; monthsSaved: number } {
  const base = projectPayoff(balance, annualPercent, basePayment, insuranceMonthly)
  const withExtra = projectPayoff(balance, annualPercent, basePayment + extraMonthly, insuranceMonthly)
  return {
    base,
    withExtra,
    interestSaved: base.neverPaysOff
      ? Infinity
      : round2(base.totalInterest - withExtra.totalInterest),
    monthsSaved: base.neverPaysOff ? Infinity : base.months - withExtra.months,
  }
}
