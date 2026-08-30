import { round2 } from '@/algorithms/accounts/balance'
import { computeDebtBalance } from '@/algorithms/debt/debts'
import type { CreditCard, Debt, DebtPayment } from '@/types/database'

// Tarjetas de crédito (secc. 6-7). Regla central: la utilización de una
// tarjeta se deriva del saldo de sus deudas vinculadas — un solo número de
// verdad — y LÍNEA DISPONIBLE ≠ DINERO DISPONIBLE, siempre.

export function cardUtilizedBalance(
  card: CreditCard,
  debts: Debt[],
  payments: DebtPayment[],
): number {
  return round2(
    debts
      .filter((d) => d.credit_card_id === card.id && d.deleted_at === null && d.status !== 'pagada')
      .reduce((sum, d) => sum + computeDebtBalance(d, payments), 0),
  )
}

export function cardAvailableCredit(card: CreditCard, debts: Debt[], payments: DebtPayment[]): number {
  return round2(Math.max(0, card.credit_line - cardUtilizedBalance(card, debts, payments)))
}

/** Utilización como razón 0-1 (0.675 = 67.5 %). */
export function cardUtilization(card: CreditCard, debts: Debt[], payments: DebtPayment[]): number {
  if (card.credit_line <= 0) return 0
  return cardUtilizedBalance(card, debts, payments) / card.credit_line
}

/**
 * Pago necesario para llevar la utilización a un objetivo dado (por defecto
 * 30 %, umbral clásico de salud crediticia).
 */
export function paymentToReachUtilization(
  card: CreditCard,
  debts: Debt[],
  payments: DebtPayment[],
  targetRatio = 0.3,
): number {
  const utilized = cardUtilizedBalance(card, debts, payments)
  const target = card.credit_line * targetRatio
  return round2(Math.max(0, utilized - target))
}

/** Utilización resultante si se paga un monto dado. */
export function utilizationAfterPayment(
  card: CreditCard,
  debts: Debt[],
  payments: DebtPayment[],
  paymentAmount: number,
): number {
  if (card.credit_line <= 0) return 0
  const utilized = Math.max(0, cardUtilizedBalance(card, debts, payments) - paymentAmount)
  return utilized / card.credit_line
}
