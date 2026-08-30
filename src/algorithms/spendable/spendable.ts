import { round2 } from '@/algorithms/accounts/balance'
import { computeDebtBalance } from '@/algorithms/debt/debts'
import type {
  BudgetCategory,
  CreditCard,
  Debt,
  DebtPayment,
  Expense,
  IncomeSource,
  RecurringExpense,
} from '@/types/database'

// "PUEDES GASTAR" (secc. 12): el cálculo más importante de la plataforma.
//
//   DINERO DISPONIBLE REAL
//   − obligaciones de deuda pendientes del mes
//   − gastos recurrentes pendientes del mes
//   − presupuesto protegido restante (esenciales aún por gastar)
//   − ahorro comprometido
//   = DINERO REALMENTE GASTABLE (mes)
//
// Hoy = gastable del mes / días restantes; semana = hoy × min(7, restantes).
// El resultado incluye el desglose para que la UI muestre SIEMPRE de dónde
// sale la cifra, y qué componentes había datos para calcular.

export interface UpcomingPayment {
  date: string // ISO yyyy-mm-dd
  label: string
  amount: number
  kind: 'deuda' | 'recurrente' | 'tarjeta'
}

export interface SpendableBreakdown {
  availableMoney: number
  debtObligations: number
  recurringPending: number
  protectedBudgetRemaining: number
  committedSavings: number
}

export interface SpendableResult {
  month: number
  week: number
  today: number
  daysRemaining: number
  breakdown: SpendableBreakdown
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Próxima ocurrencia de un día-de-mes a partir de hoy (este mes o el próximo). */
export function nextOccurrence(dueDay: number, today: Date): string {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()
  const clamped = Math.min(dueDay, lastDay)
  if (clamped >= today.getDate()) return isoDate(year, month, clamped)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const lastNext = new Date(nextYear, nextMonth, 0).getDate()
  return isoDate(nextYear, nextMonth, Math.min(dueDay, lastNext))
}

/**
 * Pagos próximos ordenados por fecha (secc. 14.3): cuotas/mínimos de deuda,
 * gastos recurrentes y fechas de pago de tarjeta dentro del horizonte.
 */
export function upcomingPayments(
  debts: Debt[],
  payments: DebtPayment[],
  recurring: RecurringExpense[],
  cards: CreditCard[],
  today: Date,
  horizonDays = 31,
): UpcomingPayment[] {
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + horizonDays)
  const horizonIso = horizon.toISOString().slice(0, 10)
  const result: UpcomingPayment[] = []

  for (const debt of debts) {
    if (debt.deleted_at !== null || debt.status === 'pagada' || debt.status === 'no_activada') continue
    const amount = debt.minimum_payment ?? debt.installment_amount
    if (!debt.due_day || !amount) continue
    if (computeDebtBalance(debt, payments) <= 0) continue
    const date = nextOccurrence(debt.due_day, today)
    if (date <= horizonIso) {
      result.push({ date, label: `Pago ${debt.name ?? debt.creditor}`, amount, kind: 'deuda' })
    }
  }

  for (const r of recurring) {
    if (r.deleted_at !== null || !r.is_active || !r.due_day) continue
    const date = nextOccurrence(r.due_day, today)
    if (date <= horizonIso) {
      result.push({ date, label: r.name, amount: r.amount, kind: 'recurrente' })
    }
  }

  for (const card of cards) {
    if (card.deleted_at !== null || !card.payment_day) continue
    // Si la tarjeta tiene deudas vinculadas ya se listan arriba como deuda;
    // este recordatorio se agrega solo cuando no hay deuda vinculada.
    const hasLinkedDebt = debts.some(
      (d) => d.credit_card_id === card.id && d.deleted_at === null && d.status !== 'pagada',
    )
    if (hasLinkedDebt) continue
    const date = nextOccurrence(card.payment_day, today)
    if (date <= horizonIso) {
      result.push({ date, label: `Pago tarjeta ${card.name}`, amount: 0, kind: 'tarjeta' })
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

interface SpendableInputs {
  availableMoney: number
  debts: Debt[]
  debtPayments: DebtPayment[]
  recurring: RecurringExpense[]
  /** Categorías del presupuesto del mes en curso. */
  budgetCategories: BudgetCategory[]
  /** Gastos del mes en curso (para presupuesto protegido restante). */
  monthExpenses: Expense[]
  committedSavings?: number
  today: Date
}

export function computeSpendable(inputs: SpendableInputs): SpendableResult {
  const { today } = inputs
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const totalDays = new Date(year, month, 0).getDate()
  const daysRemaining = Math.max(1, totalDays - today.getDate() + 1)
  const monthEnd = isoDate(year, month, totalDays)

  // Obligaciones de deuda que vencen de hoy a fin de mes.
  const debtObligations = round2(
    inputs.debts
      .filter(
        (d) =>
          d.deleted_at === null &&
          d.status !== 'pagada' &&
          d.status !== 'no_activada' &&
          d.due_day !== null &&
          computeDebtBalance(d, inputs.debtPayments) > 0,
      )
      .filter((d) => nextOccurrence(d.due_day!, today) <= monthEnd)
      .reduce((sum, d) => sum + (d.minimum_payment ?? d.installment_amount ?? 0), 0),
  )

  // Recurrentes pendientes del mes: con día ≥ hoy, o sin día conocido
  // (conservador: se reservan igual).
  const recurringPending = round2(
    inputs.recurring
      .filter((r) => r.deleted_at === null && r.is_active)
      .filter((r) => r.due_day === null || nextOccurrence(r.due_day, today) <= monthEnd)
      .reduce((sum, r) => sum + r.amount, 0),
  )

  // Presupuesto protegido restante: esenciales planificados aún no gastados.
  const protectedBudgetRemaining = round2(
    inputs.budgetCategories
      .filter((bc) => bc.is_protected)
      .reduce((sum, bc) => {
        const spent = inputs.monthExpenses
          .filter(
            (e) =>
              e.deleted_at === null &&
              e.status === 'confirmado' &&
              e.category_id === bc.category_id,
          )
          .reduce((s, e) => s + e.amount, 0)
        return sum + Math.max(0, bc.planned_amount - spent)
      }, 0),
  )

  const committedSavings = round2(inputs.committedSavings ?? 0)

  const monthSpendable = round2(
    inputs.availableMoney -
      debtObligations -
      recurringPending -
      protectedBudgetRemaining -
      committedSavings,
  )
  const todaySpendable = monthSpendable > 0 ? round2(monthSpendable / daysRemaining) : monthSpendable
  const weekSpendable =
    monthSpendable > 0 ? round2(todaySpendable * Math.min(7, daysRemaining)) : monthSpendable

  return {
    month: monthSpendable,
    week: weekSpendable,
    today: todaySpendable,
    daysRemaining,
    breakdown: {
      availableMoney: inputs.availableMoney,
      debtObligations,
      recurringPending,
      protectedBudgetRemaining,
      committedSavings,
    },
  }
}

/** Ingreso mensual esperado de una fuente, normalizando la recurrencia. */
export function monthlyExpectedIncome(source: IncomeSource): number {
  if (!source.is_active || source.deleted_at !== null || !source.expected_amount) return 0
  switch (source.recurrence) {
    case 'semanal':
      return round2(source.expected_amount * (52 / 12))
    case 'quincenal':
      return round2(source.expected_amount * 2)
    case 'mensual':
      return source.expected_amount
    case 'eventual':
      return 0
  }
}
