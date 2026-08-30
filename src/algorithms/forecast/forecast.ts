import { round2 } from '@/algorithms/accounts/balance'
import { computeDebtBalance, debtAnnualRate } from '@/algorithms/debt/debts'
import { monthlyExpectedIncome } from '@/algorithms/spendable/spendable'
import { describeSeries, projectionBase, type SeriesStats } from '@/algorithms/forecast/statistics'
import type {
  Debt,
  DebtPayment,
  Expense,
  IncomeSource,
  IncomeTransaction,
  RecurringExpense,
} from '@/types/database'

// Pronóstico a 12 meses con escenarios (secc. 21). Usa historial cuando
// existe; cuando no, cae en lo declarado (fuentes de ingreso, recurrentes)
// y lo dice, en vez de fingir una precisión que no tiene.

export type Scenario = 'pesimista' | 'base' | 'optimista'

export interface ForecastMonth {
  /** yyyy-mm */
  key: string
  label: string
  income: number
  expenses: number
  savings: number
  debtBalance: number
  cumulativeBalance: number
}

export interface ForecastResult {
  months: ForecastMonth[]
  scenario: Scenario
  /** true si no hay historial suficiente y se usó lo declarado. */
  usedDeclaredValues: boolean
  incomeStats: SeriesStats
  expenseStats: SeriesStats
}

const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

/** Agrupa montos por mes (yyyy-mm) y devuelve la serie ordenada. */
export function monthlySeries(
  rows: { date: string; amount: number; deleted_at: string | null }[],
  today: Date,
  monthsBack = 12,
  filter: (row: { date: string; amount: number; deleted_at: string | null }) => boolean = () => true,
): number[] {
  const byMonth = new Map<string, number>()
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  for (const row of rows) {
    if (row.deleted_at !== null || !filter(row)) continue
    const key = row.date.slice(0, 7)
    if (key >= currentKey) continue // solo meses cerrados
    byMonth.set(key, (byMonth.get(key) ?? 0) + row.amount)
  }
  const keys = [...byMonth.keys()].sort().slice(-monthsBack)
  return keys.map((k) => round2(byMonth.get(k) ?? 0))
}

const SCENARIO_FACTORS: Record<Scenario, { income: number; expenses: number }> = {
  // Pesimista: entra menos y se gasta más de lo habitual.
  pesimista: { income: 0.85, expenses: 1.15 },
  base: { income: 1, expenses: 1 },
  // Optimista: se sostiene el ingreso y se contiene el gasto.
  optimista: { income: 1.1, expenses: 0.9 },
}

interface ForecastInputs {
  today: Date
  startingBalance: number
  incomes: IncomeTransaction[]
  expenses: Expense[]
  sources: IncomeSource[]
  recurring: RecurringExpense[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  /** Monto mensual destinado a deuda por encima de los mínimos. */
  extraDebtPayment?: number
  horizon?: number
}

export function buildForecast(inputs: ForecastInputs, scenario: Scenario = 'base'): ForecastResult {
  const horizon = inputs.horizon ?? 12
  const factors = SCENARIO_FACTORS[scenario]

  // Historial de meses cerrados.
  const incomeSeries = monthlySeries(
    inputs.incomes,
    inputs.today,
    12,
    (row) => (row as IncomeTransaction).status === 'realizado',
  )
  const expenseSeries = monthlySeries(
    inputs.expenses,
    inputs.today,
    12,
    (row) => (row as Expense).status === 'confirmado',
  )

  const incomeStats = describeSeries(incomeSeries)
  const expenseStats = describeSeries(expenseSeries)

  // Con menos de 2 meses cerrados el historial no dice nada: se usa lo
  // declarado (sueldo y demás fuentes, gastos recurrentes).
  const declaredIncome = inputs.sources.reduce((sum, s) => sum + monthlyExpectedIncome(s), 0)
  const declaredExpenses = inputs.recurring
    .filter((r) => r.deleted_at === null && r.is_active)
    .reduce((sum, r) => sum + r.amount, 0)

  const usedDeclaredValues = incomeSeries.length < 2 || expenseSeries.length < 2
  const baseIncome = incomeSeries.length >= 2 ? projectionBase(incomeSeries) : declaredIncome
  const baseExpenses = expenseSeries.length >= 2 ? projectionBase(expenseSeries) : declaredExpenses

  // Estado inicial de las deudas para proyectar su amortización.
  const debtState = inputs.debts
    .filter((d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada')
    .map((d) => ({
      balance: computeDebtBalance(d, inputs.debtPayments),
      monthlyRate: Math.pow(1 + debtAnnualRate(d) / 100, 1 / 12) - 1,
      payment: d.minimum_payment ?? d.installment_amount ?? 0,
    }))
    .filter((d) => d.balance > 0)

  const months: ForecastMonth[] = []
  let cumulative = inputs.startingBalance
  const extraPool = inputs.extraDebtPayment ?? 0

  for (let i = 1; i <= horizon; i++) {
    const date = new Date(inputs.today.getFullYear(), inputs.today.getMonth() + i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const income = round2(baseIncome * factors.income)
    const expenses = round2(baseExpenses * factors.expenses)

    // Amortización: mínimos + excedente a la primera deuda con saldo.
    let debtPaid = 0
    let available = extraPool
    for (const debt of debtState) {
      if (debt.balance <= 0) continue
      debt.balance = round2(debt.balance * (1 + debt.monthlyRate))
      const pay = Math.min(debt.payment, debt.balance)
      debt.balance = round2(debt.balance - pay)
      debtPaid = round2(debtPaid + pay)
    }
    for (const debt of debtState) {
      if (available <= 0) break
      if (debt.balance <= 0) continue
      const pay = Math.min(available, debt.balance)
      debt.balance = round2(debt.balance - pay)
      available = round2(available - pay)
      debtPaid = round2(debtPaid + pay)
    }

    const savings = round2(income - expenses - debtPaid)
    cumulative = round2(cumulative + savings)
    const debtBalance = round2(debtState.reduce((sum, d) => sum + Math.max(0, d.balance), 0))

    months.push({
      key,
      label: `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`,
      income,
      expenses,
      savings,
      debtBalance,
      cumulativeBalance: cumulative,
    })
  }

  return { months, scenario, usedDeclaredValues, incomeStats, expenseStats }
}

export interface ScenarioImpact {
  spendableAfter: number
  savingsDelayMonths: number
  debtDelayMonths: number
  description: string
}

/**
 * Simulador "¿QUÉ PASA SI…?" (secc. 46): impacto de un gasto puntual sobre
 * el dinero gastable y sobre el ritmo de las metas y la deuda.
 */
export function simulateExtraExpense(
  amount: number,
  spendableMonth: number,
  monthlySavingsCapacity: number,
): ScenarioImpact {
  const spendableAfter = round2(spendableMonth - amount)
  const delay =
    monthlySavingsCapacity > 0 ? round2(amount / monthlySavingsCapacity) : Infinity
  return {
    spendableAfter,
    savingsDelayMonths: delay,
    debtDelayMonths: delay,
    description:
      spendableAfter < 0
        ? `Ese gasto te deja S/ ${Math.abs(spendableAfter).toFixed(2)} por debajo de lo que puedes gastar sin comprometer tus obligaciones.`
        : `Te quedarían S/ ${spendableAfter.toFixed(2)} gastables este mes.`,
  }
}
