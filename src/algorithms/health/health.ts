import { round2 } from '@/algorithms/accounts/balance'

// MI SITUACIÓN (secc. 42-43): seis indicadores y una puntuación
// ORIENTATIVA. No es un score crediticio ni un diagnóstico: es una lectura
// de tus propios datos, y cada indicador explica qué significa y cómo sube.

export interface HealthIndicator {
  key: 'liquidez' | 'flujo' | 'deuda' | 'patrimonio' | 'seguridad' | 'progreso'
  label: string
  /** Progreso 0-1 para la barra. */
  ratio: number
  score: number
  value: string
  meaning: string
  howToImprove: string
}

export interface HealthReport {
  indicators: HealthIndicator[]
  score: number
  label: string
}

interface HealthInputs {
  availableMoney: number
  monthlyEssentialSpend: number
  monthlyIncome: number
  monthlyExpenses: number
  totalDebt: number
  monthlyDebtPayments: number
  netWorth: number
  totalAssets: number
  emergencyFundCurrent: number
  emergencyFundTarget: number
  goalsTotal: number
  goalsAchieved: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

export function computeHealth(inputs: HealthInputs): HealthReport {
  const indicators: HealthIndicator[] = []

  // 1. Liquidez: cuántos meses de gasto esencial cubre tu dinero real.
  //    Referencia sana: 1 mes cubierto.
  const monthsCovered =
    inputs.monthlyEssentialSpend > 0
      ? inputs.availableMoney / inputs.monthlyEssentialSpend
      : inputs.availableMoney > 0
        ? 1
        : 0
  indicators.push({
    key: 'liquidez',
    label: 'Liquidez',
    ratio: clamp01(monthsCovered),
    score: clamp01(monthsCovered) * 100,
    value:
      inputs.monthlyEssentialSpend > 0
        ? `${monthsCovered.toFixed(1)} meses cubiertos`
        : `S/ ${inputs.availableMoney.toFixed(2)}`,
    meaning:
      'Cuánto tiempo podrías sostener tus gastos esenciales solo con el dinero que ya tienes disponible.',
    howToImprove: 'Sube si aumentas tu saldo real o reduces tus gastos fijos.',
  })

  // 2. Flujo: qué proporción de lo que entra te queda después de gastar.
  //    Referencia: ahorrar el 20 % del ingreso.
  const surplus = inputs.monthlyIncome - inputs.monthlyExpenses
  const savingsRate = inputs.monthlyIncome > 0 ? surplus / inputs.monthlyIncome : 0
  indicators.push({
    key: 'flujo',
    label: 'Flujo',
    ratio: clamp01(savingsRate / 0.2),
    score: clamp01(savingsRate / 0.2) * 100,
    value: `S/ ${round2(surplus).toFixed(2)} al mes`,
    meaning: 'Lo que te queda cada mes después de gastar. Negativo significa que estás consumiendo tu saldo.',
    howToImprove: 'Sube al aumentar ingresos o recortar gasto variable.',
  })

  // 3. Deuda: cuánto de tu ingreso se va en pagar deuda.
  //    Referencia: por debajo del 30 % del ingreso mensual.
  const debtRatio =
    inputs.monthlyIncome > 0 ? inputs.monthlyDebtPayments / inputs.monthlyIncome : 0
  const debtHealth = inputs.totalDebt === 0 ? 1 : clamp01(1 - debtRatio / 0.3)
  indicators.push({
    key: 'deuda',
    label: 'Deuda',
    ratio: debtHealth,
    score: debtHealth * 100,
    value:
      inputs.totalDebt === 0
        ? 'Sin deuda'
        : `${(debtRatio * 100).toFixed(0)} % de tu ingreso`,
    meaning:
      'Qué parte de tu ingreso mensual se compromete en pagar deuda. Por encima del 30 % deja poco margen.',
    howToImprove: 'Sube al reducir saldos, sobre todo los de tasa más alta.',
  })

  // 4. Patrimonio: activos frente a pasivos.
  const netWorthRatio =
    inputs.totalAssets + Math.abs(Math.min(0, inputs.netWorth)) > 0
      ? inputs.netWorth / Math.max(inputs.totalAssets, Math.abs(inputs.netWorth))
      : 0
  indicators.push({
    key: 'patrimonio',
    label: 'Patrimonio',
    ratio: clamp01((netWorthRatio + 1) / 2),
    score: clamp01((netWorthRatio + 1) / 2) * 100,
    value: `S/ ${inputs.netWorth.toFixed(2)}`,
    meaning:
      'Todo lo que tienes menos todo lo que debes. Empezar en negativo es normal cuando hay deuda: lo que importa es la dirección.',
    howToImprove: 'Sube cada vez que pagas capital de una deuda o ahorras.',
  })

  // 5. Seguridad: fondo de emergencia frente a su objetivo.
  const emergencyRatio =
    inputs.emergencyFundTarget > 0
      ? inputs.emergencyFundCurrent / inputs.emergencyFundTarget
      : 0
  indicators.push({
    key: 'seguridad',
    label: 'Seguridad',
    ratio: clamp01(emergencyRatio),
    score: clamp01(emergencyRatio) * 100,
    value: `S/ ${inputs.emergencyFundCurrent.toFixed(2)} de S/ ${inputs.emergencyFundTarget.toFixed(2)}`,
    meaning: 'Tu colchón para imprevistos, para no volver a endeudarte cuando algo pase.',
    howToImprove: 'Sube con cada aporte a tu fondo de emergencia.',
  })

  // 6. Progreso: metas alcanzadas.
  const progressRatio = inputs.goalsTotal > 0 ? inputs.goalsAchieved / inputs.goalsTotal : 0
  indicators.push({
    key: 'progreso',
    label: 'Progreso',
    ratio: clamp01(progressRatio),
    score: clamp01(progressRatio) * 100,
    value:
      inputs.goalsTotal > 0
        ? `${inputs.goalsAchieved} de ${inputs.goalsTotal} metas`
        : 'Sin metas definidas',
    meaning: 'Cuántos de los objetivos que te pusiste ya conseguiste.',
    howToImprove: 'Sube al completar una meta, aunque sea pequeña.',
  })

  // La puntuación pondera lo que más condiciona las decisiones del día a
  // día: deuda y flujo pesan más que el progreso en metas.
  const weights: Record<HealthIndicator['key'], number> = {
    liquidez: 0.2,
    flujo: 0.25,
    deuda: 0.25,
    patrimonio: 0.1,
    seguridad: 0.15,
    progreso: 0.05,
  }
  const score = round2(
    indicators.reduce((sum, indicator) => sum + indicator.score * weights[indicator.key], 0),
  )

  const label =
    score >= 80 ? 'Sólida' : score >= 60 ? 'Estable' : score >= 40 ? 'En construcción' : 'Frágil'

  return { indicators, score, label }
}
