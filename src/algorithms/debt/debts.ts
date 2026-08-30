import { round2 } from '@/algorithms/accounts/balance'
import { projectPayoff, type PayoffResult } from '@/algorithms/debt/amortization'
import type { Debt, DebtPayment } from '@/types/database'

// Saldo, ordenamiento estratégico y simulación de plan de pago (secc. 5 y 17).

export function debtAnnualRate(debt: Debt): number {
  if (debt.rate_type === 'sin_interes') return 0
  if (debt.rate_type === 'tcea') return debt.tcea ?? 0
  return debt.tea ?? 0
}

/** Saldo actual = saldo inicial − Σ pagos a capital (no eliminados). */
export function computeDebtBalance(debt: Debt, payments: DebtPayment[]): number {
  const principalPaid = payments
    .filter((p) => p.debt_id === debt.id && p.deleted_at === null)
    .reduce((sum, p) => sum + p.principal_amount, 0)
  return round2(Math.max(0, debt.initial_balance - principalPaid))
}

export function totalActiveDebt(debts: Debt[], payments: DebtPayment[]): number {
  return round2(
    debts
      .filter((d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada')
      .reduce((sum, d) => sum + computeDebtBalance(d, payments), 0),
  )
}

export type PayoffStrategy = 'avalancha' | 'bola_de_nieve' | 'personalizada'

const PRIORITY_ORDER: Record<Debt['priority'], number> = {
  muy_alta: 0,
  alta: 1,
  media: 2,
  baja: 3,
}

/**
 * Ordena las deudas activas según la estrategia elegida:
 * - avalancha: mayor tasa primero (mínimo interés total);
 * - bola de nieve: menor saldo primero (victorias rápidas);
 * - personalizada: prioridad declarada por la usuaria, luego tasa.
 */
export function orderDebts(
  debts: Debt[],
  payments: DebtPayment[],
  strategy: PayoffStrategy,
): Debt[] {
  const active = debts.filter(
    (d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada',
  )
  const balance = (d: Debt) => computeDebtBalance(d, payments)
  const sorted = [...active]
  if (strategy === 'avalancha') {
    sorted.sort((a, b) => debtAnnualRate(b) - debtAnnualRate(a) || balance(a) - balance(b))
  } else if (strategy === 'bola_de_nieve') {
    sorted.sort((a, b) => balance(a) - balance(b) || debtAnnualRate(b) - debtAnnualRate(a))
  } else {
    sorted.sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        debtAnnualRate(b) - debtAnnualRate(a),
    )
  }
  return sorted
}

export interface DebtPlanItem {
  debt: Debt
  startingBalance: number
  payoffMonth: number
  interestPaid: number
}

export interface DebtPlan {
  items: DebtPlanItem[]
  totalMonths: number
  totalInterest: number
  /** true si el presupuesto mensual no alcanza para que el plan converja. */
  insufficientBudget: boolean
}

/**
 * Simula un plan tipo cascada: cada mes se paga el mínimo de todas las
 * deudas y todo el excedente del presupuesto va a la primera deuda del
 * orden estratégico; al liquidarla, su cuota se suma a la siguiente.
 * Modelo simplificado mes a mes con interés efectivo mensual.
 */
export function simulateDebtPlan(
  debts: Debt[],
  payments: DebtPayment[],
  strategy: PayoffStrategy,
  monthlyBudget: number,
): DebtPlan {
  const ordered = orderDebts(debts, payments, strategy)
  const state = ordered.map((debt) => ({
    debt,
    balance: computeDebtBalance(debt, payments),
    interestPaid: 0,
    payoffMonth: 0,
  }))
  const minPayment = (d: Debt, bal: number) =>
    Math.min(bal, d.minimum_payment ?? d.installment_amount ?? Math.max(30, bal * 0.05))

  let month = 0
  let insufficient = false
  while (state.some((s) => s.balance > 0.005) && month < 600) {
    month += 1
    // 1) interés del mes
    for (const s of state) {
      if (s.balance <= 0) continue
      const r = Math.pow(1 + debtAnnualRate(s.debt) / 100, 1 / 12) - 1
      const interest = round2(s.balance * r)
      s.balance = round2(s.balance + interest)
      s.interestPaid = round2(s.interestPaid + interest)
    }
    // 2) mínimos
    let remainingBudget = monthlyBudget
    for (const s of state) {
      if (s.balance <= 0) continue
      const pay = Math.min(remainingBudget, minPayment(s.debt, s.balance))
      s.balance = round2(s.balance - pay)
      remainingBudget = round2(remainingBudget - pay)
      if (s.balance <= 0.005 && s.payoffMonth === 0) s.payoffMonth = month
    }
    // 3) excedente a la primera deuda viva del orden
    for (const s of state) {
      if (remainingBudget <= 0) break
      if (s.balance <= 0) continue
      const pay = Math.min(remainingBudget, s.balance)
      s.balance = round2(s.balance - pay)
      remainingBudget = round2(remainingBudget - pay)
      if (s.balance <= 0.005 && s.payoffMonth === 0) s.payoffMonth = month
    }
  }
  if (month >= 600) insufficient = true

  return {
    items: state.map((s) => ({
      debt: s.debt,
      startingBalance: computeDebtBalance(s.debt, payments),
      payoffMonth: s.payoffMonth || month,
      interestPaid: s.interestPaid,
    })),
    totalMonths: month,
    totalInterest: round2(state.reduce((sum, s) => sum + s.interestPaid, 0)),
    insufficientBudget: insufficient,
  }
}

/** Proyección individual de una deuda con su pago actual. */
export function projectDebt(debt: Debt, payments: DebtPayment[], monthlyPayment: number): PayoffResult {
  return projectPayoff(
    computeDebtBalance(debt, payments),
    debtAnnualRate(debt),
    monthlyPayment,
    debt.insurance_monthly,
  )
}
