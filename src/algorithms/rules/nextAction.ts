import { round2 } from '@/algorithms/accounts/balance'
import { computeDebtBalance, debtAnnualRate } from '@/algorithms/debt/debts'
import { cardUtilization, paymentToReachUtilization } from '@/algorithms/debt/cards'
import { projectPayoff } from '@/algorithms/debt/amortization'
import type { Severity } from '@/algorithms/rules/engine'
import type { CreditCard, Debt, DebtPayment, SavingsGoal } from '@/types/database'

// Prioridad financiera dinámica y "TU PRÓXIMA MEJOR ACCIÓN" (secc. 47).
// No se asume que la prioridad es siempre la misma: se recalcula con tasa,
// saldo, vencimiento, restricciones personales y dinero realmente
// disponible. Siempre se muestra UNA acción principal y su porqué.

export interface NextAction {
  severity: Severity
  title: string
  why: string
  amount?: number
  entityType?: string
  entityId?: string
}

export interface DebtPriorityScore {
  debt: Debt
  balance: number
  rate: number
  score: number
  reasons: string[]
}

/**
 * Puntúa cada deuda combinando los factores del prompt. Puntaje mayor =
 * atacar antes. La tasa domina (coste real del dinero), pero una fecha
 * comprometida o un saldo pequeño y liquidable también suben la prioridad.
 */
export function scoreDebtPriorities(
  debts: Debt[],
  payments: DebtPayment[],
  today: Date,
  availableForDebt = 0,
): DebtPriorityScore[] {
  const scores: DebtPriorityScore[] = []
  for (const debt of debts) {
    if (debt.deleted_at !== null || debt.status === 'pagada' || debt.status === 'no_activada') continue
    const balance = computeDebtBalance(debt, payments)
    if (balance <= 0) continue
    const rate = debtAnnualRate(debt)
    const reasons: string[] = []

    // 1. Coste del dinero: el factor dominante.
    let score = rate
    if (rate > 0) reasons.push(`tasa de ${rate.toFixed(2)} % anual`)
    else reasons.push('no genera intereses')

    // 2. Restricción temporal comprometida (ej. "debe estar en 0 en nov.").
    // Una fecha dada a otra persona no se mide en TEA: incumplirla tiene un
    // costo que no aparece en la tasa, así que cuando está encima debe pesar
    // más que cualquier tasa (una deuda al 0 % con fecha a un mes va antes
    // que una al 60 % sin fecha).
    if (debt.target_payoff_date) {
      const target = new Date(debt.target_payoff_date)
      const monthsLeft =
        (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth())
      if (monthsLeft <= 0) {
        score += 120
        reasons.push('su fecha comprometida ya venció')
      } else if (monthsLeft <= 3) {
        score += { 1: 90, 2: 60, 3: 40 }[monthsLeft] ?? 0
        reasons.push(`fecha comprometida en ${monthsLeft} ${monthsLeft === 1 ? 'mes' : 'meses'}`)
      }
    }

    // 3. Mora: urgencia inmediata.
    if (debt.status === 'en_mora') {
      score += 50
      reasons.push('está en mora')
    }

    // 4. Liquidable ahora mismo con el dinero disponible: victoria concreta.
    if (availableForDebt > 0 && balance <= availableForDebt) {
      score += 15
      reasons.push('puedes liquidarla por completo hoy')
    }

    // 5. Prioridad declarada por la usuaria (restricción personal).
    const priorityBoost = { muy_alta: 12, alta: 8, media: 4, baja: 0 }[debt.priority]
    score += priorityBoost

    scores.push({ debt, balance, rate, score: round2(score), reasons })
  }
  return scores.sort((a, b) => b.score - a.score)
}

interface NextActionInputs {
  debts: Debt[]
  debtPayments: DebtPayment[]
  cards: CreditCard[]
  goals: SavingsGoal[]
  availableMoney: number
  spendableMonth: number
  upcomingTotal: number
  emergencyFundCurrent: number
  today: Date
}

/**
 * Genera acciones concretas ordenadas por urgencia. La primera es "tu
 * próxima mejor acción"; el resto queda como contexto.
 */
export function computeNextActions(inputs: NextActionInputs): NextAction[] {
  const actions: NextAction[] = []

  // 1. Crítico: el dinero no alcanza para lo que ya está comprometido.
  if (inputs.upcomingTotal > inputs.availableMoney) {
    actions.push({
      severity: 'critico',
      title: 'Cubre primero tus pagos próximos',
      why:
        `Tus pagos próximos suman S/ ${inputs.upcomingTotal.toFixed(2)} y tu dinero disponible ` +
        `es S/ ${inputs.availableMoney.toFixed(2)}. Antes de cualquier otro gasto, resuelve la ` +
        'diferencia: adelanta un cobro pendiente, ajusta una fecha de pago o reduce gastos de la semana.',
      amount: round2(inputs.upcomingTotal - inputs.availableMoney),
    })
  }

  // 2. La deuda que más cuesta, con el monto que sí puedes destinar.
  const spendable = Math.max(0, inputs.spendableMonth)
  const priorities = scoreDebtPriorities(
    inputs.debts,
    inputs.debtPayments,
    inputs.today,
    spendable,
  )
  const top = priorities[0]
  if (top) {
    const suggested = round2(Math.min(spendable, top.balance))
    const rateText =
      top.rate > 0
        ? `Con ${top.rate.toFixed(2)} % anual, cada mes que pasa te cuesta cerca de ` +
          `S/ ${round2(top.balance * (Math.pow(1 + top.rate / 100, 1 / 12) - 1)).toFixed(2)} solo en intereses.`
        : 'No genera intereses, pero tiene un compromiso que cumplir.'
    actions.push({
      severity: top.rate > 50 ? 'riesgo' : 'atencion',
      title:
        suggested > 0
          ? `Abona S/ ${suggested.toFixed(2)} a ${top.debt.name ?? top.debt.creditor}`
          : `Prioriza ${top.debt.name ?? top.debt.creditor} en cuanto tengas flujo`,
      why:
        `Es tu deuda prioritaria por ${top.reasons.join(', ')}. ${rateText}` +
        (suggested >= top.balance && suggested > 0
          ? ' Con lo que tienes disponible podrías eliminarla por completo.'
          : ''),
      amount: suggested > 0 ? suggested : undefined,
      entityType: 'debts',
      entityId: top.debt.id,
    })
  }

  // 3. Utilización de tarjeta por encima del umbral sano.
  for (const card of inputs.cards) {
    if (card.deleted_at !== null) continue
    const utilization = cardUtilization(card, inputs.debts, inputs.debtPayments)
    if (utilization <= 0.3) continue
    const payment = paymentToReachUtilization(card, inputs.debts, inputs.debtPayments)
    actions.push({
      severity: utilization > 0.6 ? 'riesgo' : 'atencion',
      title: `Baja la utilización de ${card.name}`,
      why:
        `Estás usando ${(utilization * 100).toFixed(1)} % de tu línea. Un pago de ` +
        `S/ ${payment.toFixed(2)} la llevaría al 30 %, el umbral que suele mirarse para evaluar ` +
        'tu perfil crediticio.',
      amount: payment,
      entityType: 'credit_cards',
      entityId: card.id,
    })
  }

  // 4. Sin deuda cara pendiente: construir el colchón.
  const hasExpensiveDebt = priorities.some((p) => p.rate > 20)
  const emergencyGoal = inputs.goals.find(
    (g) => g.kind === 'fondo_emergencia' && g.status === 'activa' && g.deleted_at === null,
  )
  if (!hasExpensiveDebt && emergencyGoal && inputs.emergencyFundCurrent < emergencyGoal.target_amount) {
    const gap = round2(emergencyGoal.target_amount - inputs.emergencyFundCurrent)
    actions.push({
      severity: 'info',
      title: 'Sigue construyendo tu fondo de emergencia',
      why:
        `Ya no tienes deuda cara pendiente, así que el siguiente paso es tu colchón: te faltan ` +
        `S/ ${gap.toFixed(2)} para llegar a S/ ${emergencyGoal.target_amount.toFixed(2)}.`,
      amount: Math.min(gap, spendable),
    })
  }

  return actions
}

/**
 * Impacto de destinar un monto extra a una deuda: cuánto se ahorra en
 * intereses y cuántos meses se adelanta la liquidación (secc. 46).
 */
export function extraPaymentImpact(
  debt: Debt,
  payments: DebtPayment[],
  basePayment: number,
  extra: number,
): { monthsSaved: number; interestSaved: number } {
  const balance = computeDebtBalance(debt, payments)
  const rate = debtAnnualRate(debt)
  const base = projectPayoff(balance, rate, basePayment, debt.insurance_monthly)
  const withExtra = projectPayoff(balance, rate, basePayment + extra, debt.insurance_monthly)
  if (base.neverPaysOff) {
    return { monthsSaved: Infinity, interestSaved: Infinity }
  }
  return {
    monthsSaved: base.months - withExtra.months,
    interestSaved: round2(base.totalInterest - withExtra.totalInterest),
  }
}
