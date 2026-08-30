import { describe, expect, it } from 'vitest'
import {
  compareExtraPayment,
  frenchInstallment,
  monthlyRateFromAnnual,
  projectPayoff,
} from '@/algorithms/debt/amortization'
import {
  computeDebtBalance,
  debtAnnualRate,
  orderDebts,
  simulateDebtPlan,
  totalActiveDebt,
} from '@/algorithms/debt/debts'
import {
  cardAvailableCredit,
  cardUtilization,
  paymentToReachUtilization,
  utilizationAfterPayment,
} from '@/algorithms/debt/cards'
import type { CreditCard, Debt, DebtPayment } from '@/types/database'

function debt(overrides: Partial<Debt>): Debt {
  return {
    id: 'd1', user_id: 'u1', creditor: 'X', name: null, type: 'otro',
    credit_card_id: null, initial_balance: 1000, currency: 'PEN',
    tea: null, tcea: null, rate_type: 'tea', installment_amount: null,
    minimum_payment: null, num_installments: null, installments_paid: 0,
    insurance_monthly: 0, fees_monthly: 0, due_day: null,
    target_payoff_date: null, priority: 'media', status: 'activa',
    allows_early_payoff: 'desconocido', payment_strategy: null, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function payment(overrides: Partial<DebtPayment>): DebtPayment {
  return {
    id: 'p1', user_id: 'u1', debt_id: 'd1', account_id: null,
    date: '2026-09-01', amount: 100, principal_amount: 100,
    interest_amount: 0, insurance_amount: 0, fees_amount: 0,
    penalty_amount: 0, is_extra_payment: false, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function card(overrides: Partial<CreditCard>): CreditCard {
  return {
    id: 'c1', user_id: 'u1', name: 'Tarjeta', issuer: null,
    credit_line: 4740, cash_line: 0, currency: 'PEN',
    tea_purchases: 87.5, tea_cash: null, tea_usd: null,
    membership_fee: 0, insurance_monthly: 0, closing_day: null,
    payment_day: null, benefits: null, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

// Deudas del perfil inicial (números reales del prompt maestro).
const sip = debt({ id: 'sip', creditor: 'SIP', initial_balance: 980.99, tea: 109.83, priority: 'muy_alta', type: 'revolvente' })
const bcp = debt({ id: 'bcp', creditor: 'BCP', initial_balance: 3194.84, tea: 87.5, minimum_payment: 348.44, priority: 'muy_alta', type: 'revolvente' })
const rody = debt({ id: 'rody', creditor: 'Rody', initial_balance: 810, rate_type: 'sin_interes', priority: 'alta', type: 'sin_intereses' })
const compartamos = debt({
  id: 'comp', creditor: 'Compartamos', initial_balance: 4967, tcea: 62.7586,
  rate_type: 'tcea', installment_amount: 430, minimum_payment: 430,
  num_installments: 18, installments_paid: 2, insurance_monthly: 13.44, type: 'cuotas',
})
const utec = debt({ id: 'utec', creditor: 'UTEC', initial_balance: 84633.6, rate_type: 'sin_interes', status: 'no_activada', priority: 'baja' })

describe('monthlyRateFromAnnual', () => {
  it('convierte TEA anual a tasa mensual efectiva', () => {
    // TEA 109.83 % → ~6.37 % mensual
    expect(monthlyRateFromAnnual(109.83)).toBeCloseTo(0.0637, 3)
    expect(monthlyRateFromAnnual(0)).toBe(0)
  })
})

describe('frenchInstallment', () => {
  it('reproduce la cuota de Compartamos (S/ 5,171, TCEA 62.7586 %, 18 cuotas ≈ S/ 430 con seguro)', () => {
    const installment = frenchInstallment(5171, 62.7586, 18)
    // cuota sin seguro ~S/ 413-417; con seguro de S/ 13.44 ≈ S/ 430
    expect(installment + 13.44).toBeGreaterThan(420)
    expect(installment + 13.44).toBeLessThan(440)
  })

  it('sin interés divide el capital entre las cuotas', () => {
    expect(frenchInstallment(810, 0, 3)).toBe(270)
  })
})

describe('projectPayoff', () => {
  it('marca neverPaysOff cuando el pago no cubre el interés', () => {
    const result = projectPayoff(3194.84, 87.5, 100)
    expect(result.neverPaysOff).toBe(true)
  })

  it('liquida una deuda sin interés en saldo/pago meses', () => {
    const result = projectPayoff(810, 0, 270)
    expect(result.months).toBe(3)
    expect(result.totalInterest).toBe(0)
  })

  it('el interés total crece con la tasa', () => {
    const low = projectPayoff(1000, 20, 200)
    const high = projectPayoff(1000, 100, 200)
    expect(high.totalInterest).toBeGreaterThan(low.totalInterest)
    expect(high.months).toBeGreaterThanOrEqual(low.months)
  })
})

describe('compareExtraPayment', () => {
  it('pagar extra ahorra intereses y meses', () => {
    const result = compareExtraPayment(3194.84, 87.5, 348.44, 300)
    expect(result.interestSaved).toBeGreaterThan(0)
    expect(result.monthsSaved).toBeGreaterThan(0)
  })
})

describe('computeDebtBalance / totalActiveDebt', () => {
  it('resta solo los pagos a capital', () => {
    const balance = computeDebtBalance(sip, [
      payment({ debt_id: 'sip', amount: 200, principal_amount: 150, interest_amount: 50 }),
    ])
    expect(balance).toBe(830.99)
  })

  it('ignora pagos eliminados y nunca baja de 0', () => {
    expect(
      computeDebtBalance(sip, [
        payment({ debt_id: 'sip', principal_amount: 500, deleted_at: 'x' }),
      ]),
    ).toBe(980.99)
    expect(computeDebtBalance(sip, [payment({ debt_id: 'sip', principal_amount: 5000, amount: 5000 })])).toBe(0)
  })

  it('el total excluye deudas no activadas (UTEC) y pagadas', () => {
    const total = totalActiveDebt([sip, bcp, rody, compartamos, utec], [])
    expect(total).toBeCloseTo(980.99 + 3194.84 + 810 + 4967, 2)
  })
})

describe('orderDebts', () => {
  const debts = [compartamos, rody, bcp, sip, utec]

  it('avalancha: mayor tasa primero (SIP → BCP → Compartamos → Rody)', () => {
    const ordered = orderDebts(debts, [], 'avalancha').map((d) => d.id)
    expect(ordered).toEqual(['sip', 'bcp', 'comp', 'rody'])
  })

  it('bola de nieve: menor saldo primero (Rody → SIP → BCP → Compartamos)', () => {
    const ordered = orderDebts(debts, [], 'bola_de_nieve').map((d) => d.id)
    expect(ordered).toEqual(['rody', 'sip', 'bcp', 'comp'])
  })

  it('personalizada respeta la prioridad declarada', () => {
    const ordered = orderDebts(debts, [], 'personalizada').map((d) => d.id)
    expect(ordered.slice(0, 2)).toEqual(['sip', 'bcp']) // muy_alta, desempate por tasa
    expect(ordered[2]).toBe('rody') // alta
  })
})

describe('simulateDebtPlan', () => {
  it('con presupuesto suficiente converge y reporta intereses', () => {
    const plan = simulateDebtPlan([sip, bcp, rody, compartamos], [], 'avalancha', 1500)
    expect(plan.insufficientBudget).toBe(false)
    expect(plan.totalMonths).toBeGreaterThan(0)
    expect(plan.totalMonths).toBeLessThan(24)
    expect(plan.totalInterest).toBeGreaterThan(0)
  })

  it('avalancha paga menos intereses que bola de nieve', () => {
    const avalancha = simulateDebtPlan([sip, bcp, rody, compartamos], [], 'avalancha', 1200)
    const nieve = simulateDebtPlan([sip, bcp, rody, compartamos], [], 'bola_de_nieve', 1200)
    expect(avalancha.totalInterest).toBeLessThanOrEqual(nieve.totalInterest)
  })

  it('detecta presupuesto insuficiente', () => {
    const plan = simulateDebtPlan([bcp], [], 'avalancha', 10)
    expect(plan.insufficientBudget).toBe(true)
  })
})

describe('tarjetas', () => {
  const bcpCard = card({ id: 'c-bcp', credit_line: 4740 })
  const bcpDebt = debt({ id: 'bcp', initial_balance: 3200.04, tea: 87.5, credit_card_id: 'c-bcp', type: 'revolvente' })

  it('utilización BCP: 3200.04 / 4740 ≈ 67.5 %', () => {
    expect(cardUtilization(bcpCard, [bcpDebt], [])).toBeCloseTo(0.675, 2)
  })

  it('crédito disponible = línea − utilizado', () => {
    expect(cardAvailableCredit(bcpCard, [bcpDebt], [])).toBeCloseTo(1539.96, 2)
  })

  it('pago necesario para llegar a 30 % de utilización', () => {
    const needed = paymentToReachUtilization(bcpCard, [bcpDebt], [])
    expect(needed).toBeCloseTo(3200.04 - 4740 * 0.3, 2)
    expect(utilizationAfterPayment(bcpCard, [bcpDebt], [], needed)).toBeCloseTo(0.3, 5)
  })

  it('pagar la deuda vinculada baja la utilización', () => {
    const pays = [payment({ debt_id: 'bcp', amount: 800, principal_amount: 800 })]
    expect(cardUtilization(bcpCard, [bcpDebt], pays)).toBeCloseTo((3200.04 - 800) / 4740, 4)
  })

  it('deuda TEA > 20 % tiene tasa reconocible para priorización', () => {
    expect(debtAnnualRate(sip)).toBeCloseTo(109.83, 2)
    expect(debtAnnualRate(compartamos)).toBeCloseTo(62.7586, 3)
    expect(debtAnnualRate(rody)).toBe(0)
  })
})
