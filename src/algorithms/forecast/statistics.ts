import { round2 } from '@/algorithms/accounts/balance'

// Estadística descriptiva para el pronóstico (secc. 21). Funciones puras
// sobre series mensuales; ninguna asume que hay muchos datos: con historial
// corto devuelven lo que se puede afirmar honestamente.

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return round2(values.reduce((a, b) => a + b, 0) / values.length)
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return round2(sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid])
}

/**
 * Media ponderada dando más peso a los meses recientes (pesos 1, 2, 3…).
 * Refleja mejor un hábito que cambió hace poco.
 */
export function weightedMean(values: number[]): number {
  if (values.length === 0) return 0
  let weightedSum = 0
  let weightTotal = 0
  values.forEach((value, i) => {
    const weight = i + 1
    weightedSum += value * weight
    weightTotal += weight
  })
  return round2(weightedSum / weightTotal)
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1)
  return round2(Math.sqrt(variance))
}

/**
 * Pendiente por mes según regresión lineal simple (mínimos cuadrados).
 * Positiva = el gasto/ingreso viene subiendo.
 */
export function trendSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = values.reduce((a, b) => a + b, 0) / n
  let numerator = 0
  let denominator = 0
  values.forEach((y, x) => {
    numerator += (x - meanX) * (y - meanY)
    denominator += (x - meanX) ** 2
  })
  return denominator === 0 ? 0 : round2(numerator / denominator)
}

/**
 * Outliers por la regla de 1.5×IQR: valores atípicos que no deberían
 * arrastrar el pronóstico (un mes con un gasto extraordinario).
 */
export function detectOutliers(values: number[]): number[] {
  if (values.length < 4) return []
  const sorted = [...values].sort((a, b) => a - b)
  const quartile = (q: number) => {
    const pos = (sorted.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    return sorted[base + 1] !== undefined
      ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
      : sorted[base]
  }
  const q1 = quartile(0.25)
  const q3 = quartile(0.75)
  const iqr = q3 - q1
  const low = q1 - 1.5 * iqr
  const high = q3 + 1.5 * iqr
  return values.filter((v) => v < low || v > high)
}

/** Variación porcentual entre el último valor y el anterior. */
export function monthOverMonthChange(values: number[]): number {
  if (values.length < 2) return 0
  const previous = values[values.length - 2]
  const current = values[values.length - 1]
  if (previous === 0) return 0
  return round2(((current - previous) / previous) * 100)
}

export interface SeriesStats {
  average: number
  weightedAverage: number
  median: number
  standardDeviation: number
  trend: number
  outliers: number[]
  monthOverMonth: number
  months: number
}

export function describeSeries(values: number[]): SeriesStats {
  return {
    average: mean(values),
    weightedAverage: weightedMean(values),
    median: median(values),
    standardDeviation: standardDeviation(values),
    trend: trendSlope(values),
    outliers: detectOutliers(values),
    monthOverMonth: monthOverMonthChange(values),
    months: values.length,
  }
}

/**
 * Valor base para proyectar: mediana si hay outliers (resistente a un mes
 * raro), media ponderada si la serie es limpia (sigue la tendencia real).
 */
export function projectionBase(values: number[]): number {
  if (values.length === 0) return 0
  const stats = describeSeries(values)
  return stats.outliers.length > 0 ? stats.median : stats.weightedAverage
}
