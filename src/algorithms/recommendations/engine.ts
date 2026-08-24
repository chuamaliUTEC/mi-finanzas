import type { SpendableResult } from '@/algorithms/budgeting/spendable'
import type { NetWorthBreakdown } from '@/algorithms/networth'
import type { DepartamentoProjection } from '@/algorithms/goals/departamento'
import type { RetiroProjection } from '@/algorithms/goals/retiro'
import type { PayoffPlanStep } from '@/algorithms/debt'

export interface ExplainedRecommendation {
  category: string
  title: string
  motivo: string
  datosUtilizados: string[]
  impacto: string
  confianza: number
  fecha: string
}

const today = () => new Date().toISOString().slice(0, 10)

export function buildRecommendations(input: {
  spendable: SpendableResult
  netWorth: NetWorthBreakdown
  avalanche: PayoffPlanStep[]
  hasExpensiveDebt: boolean
  departamento?: DepartamentoProjection
  retiro?: RetiroProjection
}): ExplainedRecommendation[] {
  const recommendations: ExplainedRecommendation[] = []
  const { breakdown } = input.spendable

  recommendations.push({
    category: 'gasto',
    title: `Puedes gastar aproximadamente ${input.spendable.amount.toFixed(2)}`,
    motivo: 'Calculado a partir de tu liquidez e ingresos confiables, menos lo ya comprometido.',
    datosUtilizados: [
      `Liquidez disponible: ${breakdown.liquidity.toFixed(2)}`,
      `Ingreso confiable: ${breakdown.reliableIncome.toFixed(2)}`,
      `Gastos esenciales: ${breakdown.essentialExpenses.toFixed(2)}`,
      `Pagos de deuda: ${breakdown.debtPayments.toFixed(2)}`,
      `Ahorro objetivo: ${breakdown.savingsTarget.toFixed(2)}`,
      `Aportes a metas: ${breakdown.goalContributions.toFixed(2)}`,
      `Margen de seguridad: ${breakdown.safetyMargin.toFixed(2)}`,
    ],
    impacto: 'Gastar más de este monto reduce tu margen de seguridad para este período.',
    confianza: 0.6,
    fecha: today(),
  })

  if (input.avalanche.length > 0) {
    const top = input.avalanche[0]
    recommendations.push({
      category: 'deuda',
      title: `Prioriza pagar "${top.name}" primero`,
      motivo: 'Es la deuda activa con la tasa de interés más alta entre las que tienen saldo confirmado (método avalancha).',
      datosUtilizados: [
        `Saldo: ${top.balance.toFixed(2)}`,
        `Deudas activas evaluadas: ${input.avalanche.length}`,
      ],
      impacto: 'Pagarla primero minimiza el interés total que terminarás pagando.',
      confianza: 0.8,
      fecha: today(),
    })
  }

  recommendations.push({
    category: 'inversion',
    title: input.hasExpensiveDebt ? 'Todavía no es momento de invertir agresivamente' : '¿Puedo invertir este mes?',
    motivo: input.hasExpensiveDebt
      ? 'Tienes deuda con una tasa de interés alta activa. La prioridad financiera es eliminarla antes de invertir.'
      : 'No se detectó deuda cara activa, así que el margen disponible puede orientarse a inversión según tu perfil de riesgo.',
    datosUtilizados: [`Deuda cara detectada: ${input.hasExpensiveDebt ? 'sí' : 'no'}`],
    impacto: input.hasExpensiveDebt
      ? 'Invertir mientras existe deuda cara suele costar más en intereses de lo que se gana en rendimiento.'
      : 'Evalúa según tu horizonte: corto plazo, departamento y retiro son bolsillos distintos.',
    confianza: 0.7,
    fecha: today(),
  })

  if (input.departamento) {
    const gap = input.departamento.cuotaInicialObjetivo - input.departamento.capitalProyectado
    recommendations.push({
      category: 'departamento',
      title: gap > 0 ? 'Vas retrasada para la cuota inicial del departamento' : 'Vas bien para la cuota inicial del departamento',
      motivo:
        gap > 0
          ? `Con tu ahorro actual proyectas ${input.departamento.capitalProyectado.toFixed(2)}, pero necesitas ${input.departamento.cuotaInicialObjetivo.toFixed(2)}.`
          : `Tu capital proyectado (${input.departamento.capitalProyectado.toFixed(2)}) cubre la cuota inicial objetivo (${input.departamento.cuotaInicialObjetivo.toFixed(2)}).`,
      datosUtilizados: [
        `Capital proyectado: ${input.departamento.capitalProyectado.toFixed(2)}`,
        `Cuota inicial objetivo: ${input.departamento.cuotaInicialObjetivo.toFixed(2)}`,
      ],
      impacto: gap > 0 ? 'Necesitas aumentar tu ahorro mensual o postergar la fecha objetivo.' : 'Puedes mantener tu plan actual.',
      confianza: 0.6,
      fecha: today(),
    })
  }

  if (input.retiro && input.retiro.brechaMensualReal !== null) {
    const gap = input.retiro.brechaMensualReal
    recommendations.push({
      category: 'retiro',
      title: gap > 0 ? 'Vas retrasada para tu ingreso deseado en retiro' : 'Vas bien para tu retiro',
      motivo:
        gap > 0
          ? `Tu ingreso mensual estimado en retiro (valor real) sería ${input.retiro.ingresoEstimadoMensualReal.toFixed(2)}, ${gap.toFixed(2)} menos de lo que deseas.`
          : `Tu ingreso mensual estimado en retiro (valor real) cubre lo que deseas, con margen de ${Math.abs(gap).toFixed(2)}.`,
      datosUtilizados: [
        `Capital real proyectado: ${input.retiro.capitalReal.toFixed(2)}`,
        `Ingreso mensual estimado (real): ${input.retiro.ingresoEstimadoMensualReal.toFixed(2)}`,
      ],
      impacto: gap > 0 ? 'Considera aumentar tu aporte mensual o ajustar tu horizonte de retiro.' : 'Puedes mantener tu plan actual.',
      confianza: 0.5,
      fecha: today(),
    })
  }

  return recommendations
}
