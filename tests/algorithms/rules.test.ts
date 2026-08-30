import { describe, expect, it } from 'vitest'
import {
  categoryMonthlyAverage,
  evaluateRules,
  sortBySeverity,
  type FinancialSnapshot,
} from '@/algorithms/rules/engine'
import { computeNextActions, scoreDebtPriorities } from '@/algorithms/rules/nextAction'
import { detectBudgetAdjustments } from '@/algorithms/learning/learning'
import type {
  BudgetCategory,
  CreditCard,
  Debt,
  Expense,
  ExpenseCategory,
  ExtraordinaryIncome,
  FinancialRule,
  MonthlyBudget,
  RecurringExpense,
  SavingsGoal,
} from '@/types/database'

const TODAY = new Date(2026, 8, 15) // 15 de septiembre de 2026

function rule(overrides: Partial<FinancialRule>): FinancialRule {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'Regla',
    description: null, condition_type: 'debt_rate_above', condition_params: {},
    severity: 'riesgo', message_template: '{name} {rate}', is_system: true,
    is_manual: false, enabled: true, sort_order: 0,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function debt(overrides: Partial<Debt>): Debt {
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

function card(overrides: Partial<CreditCard>): CreditCard {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'Visa',
    issuer: null, credit_line: 4740, cash_line: 0, currency: 'PEN',
    tea_purchases: 87.5, tea_cash: null, tea_usd: null, tea_cash_advance: null, membership_charge_date: null, membership_fee: 0,
    insurance_monthly: 0, closing_day: null, payment_day: null,
    benefits: null, notes: null, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', account_id: null,
    credit_card_id: null, category_id: 'cat1', subcategory_id: null,
    amount: 100, currency: 'PEN', date: '2026-09-05',
    payment_method: 'efectivo', merchant: null, description: null, tags: [],
    is_recurring: false, necessity: 'necesario', is_emotional: false,
    status: 'confirmado', receipt_url: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function category(overrides: Partial<ExpenseCategory>): ExpenseCategory {
  return {
    id: 'cat1', user_id: 'u1', name: 'Restaurantes', icon: null,
    sort_order: 1, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function budgetCat(overrides: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', budget_id: 'b1',
    category_id: 'cat1', planned_amount: 300, is_protected: false,
    created_at: '', updated_at: '',
    ...overrides,
  }
}

function recurring(overrides: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'Spotify',
    amount: 32.9, currency: 'PEN', category_id: null, due_day: null,
    is_active: true, needs_verification: false, notes: null,
    created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function extraordinary(overrides: Partial<ExtraordinaryIncome>): ExtraordinaryIncome {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u1', name: 'CTS',
    expected_amount: 735, currency: 'PEN', expected_date: null,
    status: 'esperado', verification_status: 'estimado',
    received_amount: null, received_date: null,
    notes: null, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function goal(overrides: Partial<SavingsGoal>): SavingsGoal {
  return {
    id: 'g1', user_id: 'u1', name: 'Fondo', kind: 'fondo_emergencia',
    target_amount: 1600, currency: 'PEN', target_date: null,
    monthly_contribution: null, priority: 'alta', status: 'activa', debt_id: null,
    notes: null, created_at: '', updated_at: '', deleted_at: null,
    ...overrides,
  }
}

function snapshot(overrides: Partial<FinancialSnapshot>): FinancialSnapshot {
  return {
    today: TODAY,
    availableMoney: 1000,
    debts: [],
    debtPayments: [],
    cards: [],
    categories: [],
    budgetCategories: [],
    expenses: [],
    recurring: [],
    extraordinaryIncomes: [],
    extraordinaryAllocations: [],
    ...overrides,
  }
}

describe('evaluateRules — el motor no tiene reglas propias', () => {
  it('no genera nada si no hay reglas, aunque los datos las ameriten', () => {
    const alerts = evaluateRules([], snapshot({ debts: [debt({ tea: 109.83 })] }))
    expect(alerts).toEqual([])
  })

  it('ignora reglas desactivadas, eliminadas y manuales', () => {
    const s = snapshot({ debts: [debt({ tea: 109.83, creditor: 'SIP' })] })
    expect(evaluateRules([rule({ enabled: false })], s)).toEqual([])
    expect(evaluateRules([rule({ deleted_at: 'x' })], s)).toEqual([])
    expect(evaluateRules([rule({ is_manual: true })], s)).toEqual([])
  })

  it('ignora condition_type desconocido sin romperse', () => {
    const s = snapshot({ debts: [debt({ tea: 109.83 })] })
    expect(evaluateRules([rule({ condition_type: 'inventado' })], s)).toEqual([])
  })

  it('el umbral vive en condition_params, no en el código', () => {
    const s = snapshot({ debts: [debt({ tea: 25, creditor: 'SIP' })] })
    const conUmbral20 = evaluateRules(
      [rule({ condition_type: 'debt_rate_above', condition_params: { threshold: 20 } })],
      s,
    )
    const conUmbral30 = evaluateRules(
      [rule({ condition_type: 'debt_rate_above', condition_params: { threshold: 30 } })],
      s,
    )
    expect(conUmbral20).toHaveLength(1)
    expect(conUmbral30).toHaveLength(0)
  })
})

describe('reglas concretas del prompt', () => {
  it('SI deuda.TEA > 20 % → alerta, con la tasa en el mensaje', () => {
    const alerts = evaluateRules(
      [
        rule({
          condition_type: 'debt_rate_above',
          condition_params: { threshold: 20 },
          message_template: 'Tu deuda {name} tiene {rate} % anual.',
        }),
      ],
      snapshot({
        debts: [
          debt({ creditor: 'SIP', name: 'SIP', tea: 109.83 }),
          debt({ creditor: 'Rody', rate_type: 'sin_interes' }),
        ],
      }),
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toBe('Tu deuda SIP tiene 109.83 % anual.')
  })

  it('SI tarjeta.utilización > 30 % → alerta con el pago que la corrige', () => {
    const bcp = card({ id: 'c1', name: 'BCP', credit_line: 4740 })
    const alerts = evaluateRules(
      [
        rule({
          condition_type: 'card_utilization_above',
          condition_params: { threshold: 0.3 },
          message_template: '{name} está en {utilization} %. Paga {payment}.',
        }),
      ],
      snapshot({
        cards: [bcp],
        debts: [debt({ credit_card_id: 'c1', initial_balance: 3200.04 })],
      }),
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toContain('67.5 %')
    expect(alerts[0].message).toContain('S/ 1778.04')
  })

  it('SI gasto_categoria > presupuesto_categoria → alerta', () => {
    const alerts = evaluateRules(
      [
        rule({
          condition_type: 'budget_category_exceeded',
          severity: 'atencion',
          message_template: 'Gastaste {spent} en {name}: {over} de más.',
        }),
      ],
      snapshot({
        categories: [category({ id: 'cat1', name: 'Restaurantes' })],
        budgetCategories: [budgetCat({ category_id: 'cat1', planned_amount: 300 })],
        expenses: [expense({ category_id: 'cat1', amount: 771, date: '2026-09-05' })],
      }),
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toBe('Gastaste S/ 771.00 en Restaurantes: S/ 471.00 de más.')
  })

  it('SI saldo < pagos_proximos → alerta crítica', () => {
    const alerts = evaluateRules(
      [
        rule({
          condition_type: 'balance_below_upcoming',
          condition_params: { horizon_days: 15 },
          severity: 'critico',
          message_template: 'Disponible {available} vs. próximos {upcoming}.',
        }),
      ],
      snapshot({
        availableMoney: 200,
        debts: [debt({ minimum_payment: 348.44, due_day: 20 })],
      }),
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].severity).toBe('critico')
    expect(alerts[0].message).toBe('Disponible S/ 200.00 vs. próximos S/ 348.44.')
  })

  it('no alerta cuando el saldo sí cubre los pagos próximos', () => {
    const alerts = evaluateRules(
      [rule({ condition_type: 'balance_below_upcoming', condition_params: { horizon_days: 15 } })],
      snapshot({ availableMoney: 5000, debts: [debt({ minimum_payment: 348.44, due_day: 20 })] }),
    )
    expect(alerts).toEqual([])
  })

  it('SI ingreso extraordinario sin asignar → pedir destino', () => {
    const cts = extraordinary({ id: 'x1', name: 'CTS', expected_amount: 735 })
    const grati = extraordinary({ id: 'x2', name: 'Gratificación', expected_amount: 1990 })
    const alerts = evaluateRules(
      [rule({ condition_type: 'extraordinary_unallocated', message_template: '{name}: {amount}' })],
      snapshot({
        extraordinaryIncomes: [cts, grati],
        extraordinaryAllocations: [
          {
            id: 'a1', user_id: 'u1', extraordinary_income_id: 'x2',
            target_type: 'deuda', target_id: null, percent: 100, created_at: '',
          },
        ],
      }),
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toBe('CTS: S/ 735.00')
  })

  it('SI gasto supera el promedio histórico → detecta la desviación', () => {
    const alerts = evaluateRules(
      [
        rule({
          condition_type: 'category_spike',
          condition_params: { threshold_pct: 30, min_months: 2 },
          message_template: '{name} subió {change} %.',
        }),
      ],
      snapshot({
        categories: [category({ id: 'cat1', name: 'Delivery' })],
        expenses: [
          expense({ category_id: 'cat1', amount: 100, date: '2026-07-10' }),
          expense({ category_id: 'cat1', amount: 100, date: '2026-08-10' }),
          expense({ category_id: 'cat1', amount: 138, date: '2026-09-10' }),
        ],
      }),
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toBe('Delivery subió 38 %.')
  })

  it('ordena las alertas por severidad: lo crítico primero', () => {
    const sorted = sortBySeverity([
      { severity: 'info' as const },
      { severity: 'critico' as const },
      { severity: 'atencion' as const },
      { severity: 'riesgo' as const },
    ])
    expect(sorted.map((s) => s.severity)).toEqual(['critico', 'riesgo', 'atencion', 'info'])
  })
})

describe('categoryMonthlyAverage', () => {
  it('promedia meses cerrados, excluyendo el mes en curso', () => {
    const { average, months } = categoryMonthlyAverage(
      [
        expense({ amount: 200, date: '2026-07-05' }),
        expense({ amount: 100, date: '2026-08-05' }),
        expense({ amount: 999, date: '2026-09-05' }), // mes actual: fuera
      ],
      'cat1',
      TODAY,
    )
    expect(average).toBe(150)
    expect(months).toBe(2)
  })
})

describe('scoreDebtPriorities — prioridad dinámica', () => {
  it('la tasa domina el orden', () => {
    const scores = scoreDebtPriorities(
      [
        debt({ id: 'sip', creditor: 'SIP', tea: 109.83, initial_balance: 980.99 }),
        debt({ id: 'bcp', creditor: 'BCP', tea: 87.5, initial_balance: 3194.84 }),
        debt({ id: 'comp', creditor: 'Compartamos', tcea: 62.75, rate_type: 'tcea' }),
      ],
      [], TODAY,
    )
    expect(scores.map((s) => s.debt.id)).toEqual(['sip', 'bcp', 'comp'])
  })

  it('una fecha comprometida cercana sube una deuda sin intereses', () => {
    const scores = scoreDebtPriorities(
      [
        debt({ id: 'comp', creditor: 'Compartamos', tcea: 62.75, rate_type: 'tcea' }),
        debt({
          id: 'rody', creditor: 'Rody', rate_type: 'sin_interes',
          initial_balance: 810, target_payoff_date: '2026-10-31',
        }),
      ],
      [], TODAY,
    )
    // Rody no cobra intereses, pero vence en ~1 mes: pasa al frente.
    expect(scores[0].debt.id).toBe('rody')
    expect(scores[0].reasons.join(' ')).toContain('fecha comprometida')
  })

  it('la mora tiene prioridad inmediata y explica por qué', () => {
    const scores = scoreDebtPriorities(
      [
        debt({ id: 'a', tea: 30 }),
        debt({ id: 'b', tea: 10, status: 'en_mora' }),
      ],
      [], TODAY,
    )
    expect(scores[0].debt.id).toBe('b')
    expect(scores[0].reasons).toContain('está en mora')
  })

  it('excluye deudas pagadas, no activadas y con saldo cero', () => {
    const scores = scoreDebtPriorities(
      [
        debt({ status: 'pagada' }),
        debt({ status: 'no_activada' }),
        debt({ initial_balance: 0 }),
      ],
      [], TODAY,
    )
    expect(scores).toEqual([])
  })
})

describe('computeNextActions — una acción principal', () => {
  it('lo crítico va primero: cubrir los pagos próximos', () => {
    const actions = computeNextActions({
      debts: [debt({ tea: 109.83, minimum_payment: 100, due_day: 25 })],
      debtPayments: [], cards: [], goals: [],
      availableMoney: 200, spendableMonth: 100, upcomingTotal: 800,
      emergencyFundCurrent: 0, today: TODAY,
    })
    expect(actions[0].severity).toBe('critico')
    expect(actions[0].amount).toBe(600)
  })

  it('sin urgencias, la acción es atacar la deuda más cara y explica el costo', () => {
    const actions = computeNextActions({
      debts: [debt({ creditor: 'SIP', name: 'SIP', tea: 109.83, initial_balance: 980.99 })],
      debtPayments: [], cards: [], goals: [],
      availableMoney: 1000, spendableMonth: 400, upcomingTotal: 0,
      emergencyFundCurrent: 0, today: TODAY,
    })
    expect(actions[0].title).toContain('SIP')
    expect(actions[0].amount).toBe(400)
    expect(actions[0].why).toContain('109.83')
    expect(actions[0].why).toContain('intereses')
  })

  it('avisa cuando el disponible alcanza para liquidar la deuda completa', () => {
    const actions = computeNextActions({
      debts: [debt({ creditor: 'SIP', tea: 109.83, initial_balance: 300 })],
      debtPayments: [], cards: [], goals: [],
      availableMoney: 1000, spendableMonth: 500, upcomingTotal: 0,
      emergencyFundCurrent: 0, today: TODAY,
    })
    expect(actions[0].amount).toBe(300)
    expect(actions[0].why).toContain('eliminarla por completo')
  })

  it('sin deuda cara, propone construir el fondo de emergencia', () => {
    const actions = computeNextActions({
      debts: [], debtPayments: [], cards: [],
      goals: [goal({ target_amount: 1600 })],
      availableMoney: 1000, spendableMonth: 400, upcomingTotal: 0,
      emergencyFundCurrent: 500, today: TODAY,
    })
    expect(actions[0].title).toContain('fondo de emergencia')
    expect(actions[0].why).toContain('1100.00')
  })

  it('con deuda cara vigente NO propone el fondo de emergencia todavía', () => {
    const actions = computeNextActions({
      debts: [debt({ tea: 109.83, initial_balance: 900 })],
      debtPayments: [], cards: [],
      goals: [goal({ target_amount: 1600 })],
      availableMoney: 1000, spendableMonth: 400, upcomingTotal: 0,
      emergencyFundCurrent: 0, today: TODAY,
    })
    expect(actions.some((a) => a.title.includes('fondo de emergencia'))).toBe(false)
  })
})

describe('detectBudgetAdjustments — aprendizaje', () => {
  function budget(year: number, month: number, id: string): MonthlyBudget {
    return {
      id, user_id: 'u1', year, month, notes: null,
      created_at: '', updated_at: '', deleted_at: null,
    }
  }

  it('ejemplo del prompt: transporte se queda corto ~25 % y sugiere subirlo', () => {
    const budgets = [budget(2026, 6, 'b1'), budget(2026, 7, 'b2'), budget(2026, 8, 'b3')]
    const cats = [
      budgetCat({ budget_id: 'b1', category_id: 'transp', planned_amount: 200 }),
      budgetCat({ budget_id: 'b2', category_id: 'transp', planned_amount: 200 }),
      budgetCat({ budget_id: 'b3', category_id: 'transp', planned_amount: 200 }),
    ]
    const expenses = [
      expense({ category_id: 'transp', amount: 250, date: '2026-06-10' }),
      expense({ category_id: 'transp', amount: 260, date: '2026-07-10' }),
      expense({ category_id: 'transp', amount: 240, date: '2026-08-10' }),
    ]
    const suggestions = detectBudgetAdjustments(budgets, cats, expenses, TODAY)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].suggestedPlanned).toBe(250)
    expect(suggestions[0].observation).toContain('quedarse corto')
    expect(suggestions[0].observation).toContain('25 %')
    expect(suggestions[0].monthsObserved).toBe(3)
  })

  it('un solo mes desviado no cambia nada', () => {
    const budgets = [budget(2026, 6, 'b1'), budget(2026, 7, 'b2'), budget(2026, 8, 'b3')]
    const cats = [
      budgetCat({ budget_id: 'b1', category_id: 'c', planned_amount: 200 }),
      budgetCat({ budget_id: 'b2', category_id: 'c', planned_amount: 200 }),
      budgetCat({ budget_id: 'b3', category_id: 'c', planned_amount: 200 }),
    ]
    const expenses = [
      expense({ category_id: 'c', amount: 200, date: '2026-06-10' }),
      expense({ category_id: 'c', amount: 195, date: '2026-07-10' }),
      expense({ category_id: 'c', amount: 400, date: '2026-08-10' }),
    ]
    expect(detectBudgetAdjustments(budgets, cats, expenses, TODAY)).toEqual([])
  })

  it('no usa el mes en curso como evidencia', () => {
    const budgets = [budget(2026, 9, 'b1')]
    const cats = [budgetCat({ budget_id: 'b1', category_id: 'c', planned_amount: 200 })]
    const expenses = [expense({ category_id: 'c', amount: 500, date: '2026-09-10' })]
    expect(detectBudgetAdjustments(budgets, cats, expenses, TODAY)).toEqual([])
  })

  it('exige un mínimo de meses observados', () => {
    const budgets = [budget(2026, 7, 'b1'), budget(2026, 8, 'b2')]
    const cats = [
      budgetCat({ budget_id: 'b1', category_id: 'c', planned_amount: 100 }),
      budgetCat({ budget_id: 'b2', category_id: 'c', planned_amount: 100 }),
    ]
    const expenses = [
      expense({ category_id: 'c', amount: 200, date: '2026-07-10' }),
      expense({ category_id: 'c', amount: 200, date: '2026-08-10' }),
    ]
    expect(detectBudgetAdjustments(budgets, cats, expenses, TODAY, 3)).toEqual([])
    expect(detectBudgetAdjustments(budgets, cats, expenses, TODAY, 2)).toHaveLength(1)
  })
})

describe('reglas manuales', () => {
  it('los recordatorios declarativos nunca generan alertas', () => {
    const manuales = [
      rule({ is_manual: true, name: 'Nunca pagar una línea de crédito con otra' }),
      rule({ is_manual: true, name: 'PASE CUOTAS bloqueado' }),
    ]
    expect(evaluateRules(manuales, snapshot({ debts: [debt({ tea: 109.83 })] }))).toEqual([])
  })
})

describe('recurrentes en el cálculo de pagos próximos', () => {
  it('un recurrente con día de cobro entra en la alerta de saldo insuficiente', () => {
    const alerts = evaluateRules(
      [
        rule({
          condition_type: 'balance_below_upcoming',
          condition_params: { horizon_days: 31 },
          message_template: '{available} vs {upcoming}',
        }),
      ],
      snapshot({
        availableMoney: 20,
        recurring: [recurring({ amount: 32.9, due_day: 20 })],
      }),
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].message).toBe('S/ 20.00 vs S/ 32.90')
  })
})
