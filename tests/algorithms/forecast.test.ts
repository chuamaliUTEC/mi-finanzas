import { describe, expect, it } from 'vitest'
import {
  describeSeries,
  detectOutliers,
  mean,
  median,
  monthOverMonthChange,
  projectionBase,
  standardDeviation,
  trendSlope,
  weightedMean,
} from '@/algorithms/forecast/statistics'
import {
  buildForecast,
  monthlySeries,
  simulateExtraExpense,
} from '@/algorithms/forecast/forecast'
import type {
  Debt,
  Expense,
  IncomeSource,
  IncomeTransaction,
  RecurringExpense,
} from '@/types/database'

const TODAY = new Date(2026, 8, 15) // 15 de septiembre de 2026

function income(overrides: Partial<IncomeTransaction> = {}): IncomeTransaction {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', source_id: null,
    account_id: null, amount: 2405, currency: 'PEN', date: '2026-08-24',
    status: 'realizado', description: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', account_id: null,
    credit_card_id: null, category_id: null, subcategory_id: null,
    amount: 100, currency: 'PEN', date: '2026-08-10',
    payment_method: 'efectivo', merchant: null, description: null, tags: [],
    is_recurring: false, necessity: 'necesario', is_emotional: false,
    status: 'confirmado', receipt_url: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function source(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'Sueldo',
    kind: 'fijo', recurrence: 'mensual', expected_amount: 2405,
    currency: 'PEN', reliability: 'alta', is_verified: false,
    expected_day: 24, is_active: true, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function recurring(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'R',
    amount: 100, currency: 'PEN', category_id: null, due_day: null,
    is_active: true, needs_verification: false, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', creditor: 'X',
    name: null, type: 'otro', credit_card_id: null, initial_balance: 1000,
    currency: 'PEN', tea: null, tcea: null, rate_type: 'tea',
    installment_amount: null, minimum_payment: null, num_installments: null,
    installments_paid: 0, insurance_monthly: 0, fees_monthly: 0,
    due_day: null, target_payoff_date: null, priority: 'media',
    status: 'activa', allows_early_payoff: 'desconocido',
    payment_strategy: null, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

describe('estadística descriptiva', () => {
  it('promedio, mediana y desviación estándar', () => {
    expect(mean([100, 200, 300])).toBe(200)
    expect(median([100, 200, 300])).toBe(200)
    expect(median([100, 200, 300, 400])).toBe(250)
    expect(standardDeviation([100, 100, 100])).toBe(0)
    expect(standardDeviation([10, 20, 30])).toBe(10)
  })

  it('la media ponderada pesa más los meses recientes', () => {
    // Serie que sube: la ponderada debe quedar por encima del promedio.
    expect(weightedMean([100, 200, 300])).toBeGreaterThan(mean([100, 200, 300]))
    // Serie que baja: por debajo.
    expect(weightedMean([300, 200, 100])).toBeLessThan(mean([300, 200, 100]))
    // Serie plana: iguales.
    expect(weightedMean([200, 200, 200])).toBe(200)
  })

  it('la tendencia detecta si el gasto sube o baja', () => {
    expect(trendSlope([100, 200, 300])).toBe(100)
    expect(trendSlope([300, 200, 100])).toBe(-100)
    expect(trendSlope([200, 200, 200])).toBe(0)
    expect(trendSlope([200])).toBe(0)
  })

  it('detecta outliers con la regla de 1.5×IQR', () => {
    expect(detectOutliers([100, 105, 98, 102, 5000])).toContain(5000)
    expect(detectOutliers([100, 105, 98, 102])).toEqual([])
    expect(detectOutliers([100, 200])).toEqual([]) // muy pocos datos
  })

  it('variación mes contra mes', () => {
    expect(monthOverMonthChange([100, 138])).toBe(38)
    expect(monthOverMonthChange([200, 100])).toBe(-50)
    expect(monthOverMonthChange([100])).toBe(0)
  })

  it('describeSeries reúne todo sin romperse con series vacías', () => {
    const stats = describeSeries([])
    expect(stats.average).toBe(0)
    expect(stats.months).toBe(0)
    expect(stats.outliers).toEqual([])
  })
})

describe('projectionBase — resistencia a meses raros', () => {
  it('usa la mediana cuando hay un mes atípico', () => {
    const values = [100, 105, 98, 102, 5000]
    expect(projectionBase(values)).toBe(median(values))
  })

  it('usa la media ponderada cuando la serie es limpia', () => {
    const values = [100, 120, 140]
    expect(projectionBase(values)).toBe(weightedMean(values))
  })
})

describe('monthlySeries', () => {
  it('agrupa por mes y excluye el mes en curso y lo eliminado', () => {
    const series = monthlySeries(
      [
        expense({ amount: 100, date: '2026-07-05' }),
        expense({ amount: 50, date: '2026-07-20' }),
        expense({ amount: 300, date: '2026-08-05' }),
        expense({ amount: 999, date: '2026-09-05' }), // mes en curso
        expense({ amount: 999, date: '2026-08-05', deleted_at: 'x' }),
      ],
      TODAY,
    )
    expect(series).toEqual([150, 300])
  })
})

describe('buildForecast', () => {
  const twoMonthsOfHistory = {
    incomes: [
      income({ amount: 2400, date: '2026-07-24' }),
      income({ amount: 2400, date: '2026-08-24' }),
    ],
    expenses: [
      expense({ amount: 1000, date: '2026-07-10' }),
      expense({ amount: 1000, date: '2026-08-10' }),
    ],
  }

  it('proyecta 12 meses', () => {
    const forecast = buildForecast({
      today: TODAY, startingBalance: 0,
      ...twoMonthsOfHistory,
      sources: [], recurring: [], debts: [], debtPayments: [],
    })
    expect(forecast.months).toHaveLength(12)
    expect(forecast.months[0].label).toBe('Oct 2026')
    expect(forecast.months[11].label).toBe('Sep 2027')
  })

  it('sin historial suficiente usa lo declarado y lo advierte', () => {
    const forecast = buildForecast({
      today: TODAY, startingBalance: 0,
      incomes: [], expenses: [],
      sources: [source({ expected_amount: 2405 })],
      recurring: [recurring({ amount: 300 })],
      debts: [], debtPayments: [],
    })
    expect(forecast.usedDeclaredValues).toBe(true)
    expect(forecast.months[0].income).toBe(2405)
    expect(forecast.months[0].expenses).toBe(300)
  })

  it('con historial no marca usedDeclaredValues', () => {
    const forecast = buildForecast({
      today: TODAY, startingBalance: 0,
      ...twoMonthsOfHistory,
      sources: [source()], recurring: [recurring()], debts: [], debtPayments: [],
    })
    expect(forecast.usedDeclaredValues).toBe(false)
    expect(forecast.months[0].income).toBe(2400)
  })

  it('el escenario pesimista deja menos saldo que el optimista', () => {
    const inputs = {
      today: TODAY, startingBalance: 0,
      ...twoMonthsOfHistory,
      sources: [], recurring: [], debts: [], debtPayments: [],
    }
    const pesimista = buildForecast(inputs, 'pesimista')
    const base = buildForecast(inputs, 'base')
    const optimista = buildForecast(inputs, 'optimista')
    const last = (f: typeof base) => f.months[11].cumulativeBalance
    expect(last(pesimista)).toBeLessThan(last(base))
    expect(last(base)).toBeLessThan(last(optimista))
  })

  it('la deuda baja mes a mes y el pago extra la liquida antes', () => {
    const d = debt({ initial_balance: 1000, tea: 0, minimum_payment: 100 })
    const inputs = {
      today: TODAY, startingBalance: 0,
      ...twoMonthsOfHistory,
      sources: [], recurring: [], debts: [d], debtPayments: [],
    }
    const sinExtra = buildForecast(inputs)
    const conExtra = buildForecast({ ...inputs, extraDebtPayment: 400 })

    expect(sinExtra.months[0].debtBalance).toBe(900)
    // Sin extra: 10 meses. Con extra de 400: 2 meses.
    const freeWithout = sinExtra.months.findIndex((m) => m.debtBalance <= 0)
    const freeWith = conExtra.months.findIndex((m) => m.debtBalance <= 0)
    expect(freeWith).toBeLessThan(freeWithout)
    expect(freeWith).toBe(1)
  })

  it('la deuda con interés crece si el pago no la cubre', () => {
    const d = debt({ initial_balance: 1000, tea: 109.83, minimum_payment: 10 })
    const forecast = buildForecast({
      today: TODAY, startingBalance: 0,
      ...twoMonthsOfHistory,
      sources: [], recurring: [], debts: [d], debtPayments: [],
    })
    expect(forecast.months[11].debtBalance).toBeGreaterThan(1000)
  })

  it('excluye deudas pagadas y no activadas de la proyección', () => {
    const forecast = buildForecast({
      today: TODAY, startingBalance: 0,
      ...twoMonthsOfHistory,
      sources: [], recurring: [],
      debts: [
        debt({ initial_balance: 5000, status: 'pagada' }),
        debt({ initial_balance: 84633, status: 'no_activada' }),
      ],
      debtPayments: [],
    })
    expect(forecast.months[0].debtBalance).toBe(0)
  })
})

describe('simulateExtraExpense — ¿qué pasa si…?', () => {
  it('descuenta del gastable y estima el retraso en metas', () => {
    const impact = simulateExtraExpense(500, 900, 250)
    expect(impact.spendableAfter).toBe(400)
    expect(impact.savingsDelayMonths).toBe(2)
    expect(impact.description).toContain('400.00')
  })

  it('avisa cuando el gasto compromete obligaciones', () => {
    const impact = simulateExtraExpense(1000, 400, 200)
    expect(impact.spendableAfter).toBe(-600)
    expect(impact.description).toContain('por debajo')
  })

  it('sin capacidad de ahorro el retraso es indefinido, no cero', () => {
    expect(simulateExtraExpense(500, 900, 0).savingsDelayMonths).toBe(Infinity)
  })
})
