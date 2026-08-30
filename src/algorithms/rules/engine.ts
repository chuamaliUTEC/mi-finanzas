import { round2 } from '@/algorithms/accounts/balance'
import { computeDebtBalance, debtAnnualRate } from '@/algorithms/debt/debts'
import { cardUtilization, paymentToReachUtilization } from '@/algorithms/debt/cards'
import { computeBudgetStatus, isInMonth } from '@/algorithms/budget/budget'
import { upcomingPayments } from '@/algorithms/spendable/spendable'
import type {
  BudgetCategory,
  CreditCard,
  Debt,
  DebtPayment,
  Expense,
  ExpenseCategory,
  ExtraordinaryIncome,
  ExtraordinaryIncomeAllocation,
  FinancialRule,
  RecurringExpense,
} from '@/types/database'

// Motor de reglas (secc. 16). El motor NO conoce ninguna regla de negocio:
// solo sabe evaluar TIPOS DE CONDICIÓN genéricos contra un snapshot. Los
// umbrales y los mensajes viven en la base de datos (financial_rules), de
// modo que cambiar "30 % de utilización" a "25 %" es editar una fila, no
// tocar código.

export type Severity = 'info' | 'atencion' | 'riesgo' | 'critico'

export interface GeneratedAlert {
  ruleId: string
  severity: Severity
  title: string
  message: string
  dedupeKey: string
  entityType?: string
  entityId?: string
}

export interface FinancialSnapshot {
  today: Date
  availableMoney: number
  debts: Debt[]
  debtPayments: DebtPayment[]
  cards: CreditCard[]
  categories: ExpenseCategory[]
  budgetCategories: BudgetCategory[]
  expenses: Expense[]
  recurring: RecurringExpense[]
  extraordinaryIncomes: ExtraordinaryIncome[]
  extraordinaryAllocations: ExtraordinaryIncomeAllocation[]
}

type Evaluator = (rule: FinancialRule, snapshot: FinancialSnapshot) => GeneratedAlert[]

function param(rule: FinancialRule, key: string, fallback: number): number {
  const value = (rule.condition_params as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : fallback
}

/** Sustituye {marcadores} del message_template con valores reales. */
function render(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  )
}

function activeDebts(snapshot: FinancialSnapshot): Debt[] {
  return snapshot.debts.filter(
    (d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada',
  )
}

function categoryName(snapshot: FinancialSnapshot, categoryId: string): string {
  return snapshot.categories.find((c) => c.id === categoryId)?.name ?? 'esa categoría'
}

/** Promedio mensual histórico de una categoría, excluyendo el mes en curso. */
export function categoryMonthlyAverage(
  expenses: Expense[],
  categoryId: string,
  today: Date,
): { average: number; months: number } {
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const byMonth = new Map<string, number>()
  for (const e of expenses) {
    if (e.deleted_at !== null || e.status !== 'confirmado' || e.category_id !== categoryId) continue
    const key = e.date.slice(0, 7)
    if (key === currentKey) continue
    byMonth.set(key, (byMonth.get(key) ?? 0) + e.amount)
  }
  if (byMonth.size === 0) return { average: 0, months: 0 }
  const total = [...byMonth.values()].reduce((a, b) => a + b, 0)
  return { average: round2(total / byMonth.size), months: byMonth.size }
}

const EVALUATORS: Record<string, Evaluator> = {
  // SI deuda.tasa > umbral → prioridad alta.
  debt_rate_above: (rule, snapshot) => {
    const threshold = param(rule, 'threshold', 20)
    return activeDebts(snapshot)
      .filter((d) => debtAnnualRate(d) > threshold)
      .filter((d) => computeDebtBalance(d, snapshot.debtPayments) > 0)
      .map((d) => ({
        ruleId: rule.id,
        severity: rule.severity,
        title: `Deuda cara: ${d.name ?? d.creditor}`,
        message: render(rule.message_template, {
          name: d.name ?? d.creditor,
          rate: debtAnnualRate(d).toFixed(2),
        }),
        dedupeKey: `${rule.condition_type}:${d.id}`,
        entityType: 'debts',
        entityId: d.id,
      }))
  },

  // SI tarjeta.utilización > umbral → alerta con el pago que la corrige.
  card_utilization_above: (rule, snapshot) => {
    const threshold = param(rule, 'threshold', 0.3)
    return snapshot.cards
      .filter((c) => c.deleted_at === null)
      .filter((c) => cardUtilization(c, snapshot.debts, snapshot.debtPayments) > threshold)
      .map((c) => {
        const utilization = cardUtilization(c, snapshot.debts, snapshot.debtPayments)
        const payment = paymentToReachUtilization(c, snapshot.debts, snapshot.debtPayments, threshold)
        return {
          ruleId: rule.id,
          severity: rule.severity,
          title: `Utilización alta en ${c.name}`,
          message: render(rule.message_template, {
            name: c.name,
            utilization: (utilization * 100).toFixed(1),
            payment: `S/ ${payment.toFixed(2)}`,
          }),
          dedupeKey: `${rule.condition_type}:${c.id}`,
          entityType: 'credit_cards',
          entityId: c.id,
        }
      })
  },

  // SI gasto_categoria > presupuesto_categoria → alerta.
  budget_category_exceeded: (rule, snapshot) => {
    const { today } = snapshot
    const statuses = computeBudgetStatus(
      snapshot.budgetCategories,
      snapshot.expenses,
      today.getFullYear(),
      today.getMonth() + 1,
      today,
    )
    return statuses
      .filter((s) => s.status === 'excedido')
      .map((s) => ({
        ruleId: rule.id,
        severity: rule.severity,
        title: `Presupuesto excedido: ${categoryName(snapshot, s.categoryId)}`,
        message: render(rule.message_template, {
          name: categoryName(snapshot, s.categoryId),
          spent: `S/ ${s.spent.toFixed(2)}`,
          over: `S/ ${Math.abs(s.difference).toFixed(2)}`,
          planned: `S/ ${s.planned.toFixed(2)}`,
        }),
        dedupeKey: `${rule.condition_type}:${s.categoryId}:${today.getFullYear()}-${today.getMonth() + 1}`,
        entityType: 'expense_categories',
        entityId: s.categoryId,
      }))
  },

  budget_category_projected_over: (rule, snapshot) => {
    const { today } = snapshot
    const statuses = computeBudgetStatus(
      snapshot.budgetCategories,
      snapshot.expenses,
      today.getFullYear(),
      today.getMonth() + 1,
      today,
    )
    return statuses
      .filter((s) => s.status === 'camino_a_exceder')
      .map((s) => ({
        ruleId: rule.id,
        severity: rule.severity,
        title: `Vas camino a exceder ${categoryName(snapshot, s.categoryId)}`,
        message: render(rule.message_template, {
          name: categoryName(snapshot, s.categoryId),
          projected: `S/ ${s.projected.toFixed(2)}`,
          planned: `S/ ${s.planned.toFixed(2)}`,
          spent: `S/ ${s.spent.toFixed(2)}`,
        }),
        dedupeKey: `${rule.condition_type}:${s.categoryId}:${today.getFullYear()}-${today.getMonth() + 1}`,
        entityType: 'expense_categories',
        entityId: s.categoryId,
      }))
  },

  // SI saldo < pagos_proximos → alerta crítica.
  balance_below_upcoming: (rule, snapshot) => {
    const horizon = param(rule, 'horizon_days', 15)
    const upcoming = upcomingPayments(
      snapshot.debts,
      snapshot.debtPayments,
      snapshot.recurring,
      snapshot.cards,
      snapshot.today,
      horizon,
    )
    const total = round2(upcoming.reduce((sum, p) => sum + p.amount, 0))
    if (total === 0 || snapshot.availableMoney >= total) return []
    return [
      {
        ruleId: rule.id,
        severity: rule.severity,
        title: 'Tu saldo no cubre tus pagos próximos',
        message: render(rule.message_template, {
          available: `S/ ${snapshot.availableMoney.toFixed(2)}`,
          upcoming: `S/ ${total.toFixed(2)}`,
          days: horizon,
        }),
        dedupeKey: `${rule.condition_type}:${snapshot.today.toISOString().slice(0, 10)}`,
      },
    ]
  },

  // SI ingreso_extraordinario detectado → pedir asignación de destino.
  extraordinary_unallocated: (rule, snapshot) => {
    return snapshot.extraordinaryIncomes
      .filter((x) => x.deleted_at === null && x.status === 'esperado')
      .filter((x) => {
        const allocated = snapshot.extraordinaryAllocations
          .filter((a) => a.extraordinary_income_id === x.id)
          .reduce((sum, a) => sum + a.percent, 0)
        return allocated < 100
      })
      .map((x) => ({
        ruleId: rule.id,
        severity: rule.severity,
        title: `Asigna el destino de ${x.name}`,
        message: render(rule.message_template, {
          name: x.name,
          amount: `S/ ${x.expected_amount.toFixed(2)}`,
        }),
        dedupeKey: `${rule.condition_type}:${x.id}`,
        entityType: 'extraordinary_incomes',
        entityId: x.id,
      }))
  },

  // SI gasto supera el promedio histórico significativamente → desviación.
  category_spike: (rule, snapshot) => {
    const thresholdPct = param(rule, 'threshold_pct', 30)
    const minMonths = param(rule, 'min_months', 2)
    const { today } = snapshot
    const alerts: GeneratedAlert[] = []
    for (const category of snapshot.categories) {
      const { average, months } = categoryMonthlyAverage(snapshot.expenses, category.id, today)
      if (months < minMonths || average <= 0) continue
      const currentSpend = snapshot.expenses
        .filter(
          (e) =>
            e.deleted_at === null &&
            e.status === 'confirmado' &&
            e.category_id === category.id &&
            isInMonth(e.date, today.getFullYear(), today.getMonth() + 1),
        )
        .reduce((sum, e) => sum + e.amount, 0)
      const changePct = ((currentSpend - average) / average) * 100
      if (changePct < thresholdPct) continue
      alerts.push({
        ruleId: rule.id,
        severity: rule.severity,
        title: `Gasto al alza en ${category.name}`,
        message: render(rule.message_template, {
          name: category.name,
          change: changePct.toFixed(0),
          current: `S/ ${currentSpend.toFixed(2)}`,
          average: `S/ ${average.toFixed(2)}`,
        }),
        dedupeKey: `${rule.condition_type}:${category.id}:${today.getFullYear()}-${today.getMonth() + 1}`,
        entityType: 'expense_categories',
        entityId: category.id,
      })
    }
    return alerts
  },

  // SI existe deuda cara → advertir antes de tomar deuda nueva.
  new_debt_while_expensive: (rule, snapshot) => {
    const threshold = param(rule, 'threshold', 20)
    const expensive = activeDebts(snapshot)
      .filter((d) => debtAnnualRate(d) > threshold)
      .filter((d) => computeDebtBalance(d, snapshot.debtPayments) > 0)
      .sort((a, b) => debtAnnualRate(b) - debtAnnualRate(a))[0]
    if (!expensive) return []
    return [
      {
        ruleId: rule.id,
        severity: rule.severity,
        title: 'Tienes deuda cara vigente',
        message: render(rule.message_template, {
          name: expensive.name ?? expensive.creditor,
          rate: debtAnnualRate(expensive).toFixed(2),
        }),
        dedupeKey: `${rule.condition_type}:${expensive.id}`,
        entityType: 'debts',
        entityId: expensive.id,
      },
    ]
  },
}

/**
 * Evalúa todas las reglas activas contra el snapshot y devuelve las alertas
 * generadas, ordenadas por severidad (lo crítico primero).
 * Las reglas manuales (recordatorios declarativos) nunca generan alertas.
 */
export function evaluateRules(
  rules: FinancialRule[],
  snapshot: FinancialSnapshot,
): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = []
  for (const rule of rules) {
    if (rule.deleted_at !== null || !rule.enabled || rule.is_manual) continue
    const evaluator = EVALUATORS[rule.condition_type]
    if (!evaluator) continue
    alerts.push(...evaluator(rule, snapshot))
  }
  return sortBySeverity(alerts)
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critico: 0,
  riesgo: 1,
  atencion: 2,
  info: 3,
}

export function sortBySeverity<T extends { severity: Severity }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity])
}

export const SEVERITY_ICON: Record<Severity, string> = {
  critico: '🔴',
  riesgo: '🟠',
  atencion: '🟡',
  info: '🟢',
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critico: 'Crítico',
  riesgo: 'Riesgo',
  atencion: 'Atención',
  info: 'Información',
}

/** Tipos de condición que el motor sabe evaluar (para la UI de reglas). */
export const CONDITION_TYPES = Object.keys(EVALUATORS)
