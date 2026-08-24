import { annualToMonthlyRate, futureValue, realValue } from './finance'

export interface RetiroInputs {
  edadActual: number
  edadObjetivo: number
  capitalActual: number
  aporteMensual: number
  tasaRendimientoAnual: number
  inflacionAnual: number
  ingresoDeseadoMensualRetiro: number | null
  aniosEsperadosDeRetiro: number // e.g. 25 years of withdrawals
}

export interface RetiroProjection {
  horizonMeses: number
  capitalNominal: number
  capitalReal: number
  ingresoEstimadoMensualNominal: number
  ingresoEstimadoMensualReal: number
  brechaMensualReal: number | null
}

/**
 * Projects retirement capital using compound monthly contributions, then
 * deflates it to today's purchasing power. The estimated monthly income in
 * retirement is a simple capital / (years * 12) drawdown — not a guarantee,
 * just an order-of-magnitude planning number.
 */
export function projectRetiro(inputs: RetiroInputs): RetiroProjection {
  const horizonMeses = Math.max((inputs.edadObjetivo - inputs.edadActual) * 12, 0)
  const monthlyRate = annualToMonthlyRate(inputs.tasaRendimientoAnual)
  const capitalNominal = futureValue(inputs.capitalActual, inputs.aporteMensual, monthlyRate, horizonMeses)
  const years = horizonMeses / 12
  const capitalReal = realValue(capitalNominal, inputs.inflacionAnual, years)

  const withdrawalMonths = Math.max(inputs.aniosEsperadosDeRetiro * 12, 1)
  const ingresoEstimadoMensualNominal = capitalNominal / withdrawalMonths
  const ingresoEstimadoMensualReal = capitalReal / withdrawalMonths

  const brechaMensualReal =
    inputs.ingresoDeseadoMensualRetiro === null
      ? null
      : inputs.ingresoDeseadoMensualRetiro - ingresoEstimadoMensualReal

  return {
    horizonMeses,
    capitalNominal,
    capitalReal,
    ingresoEstimadoMensualNominal,
    ingresoEstimadoMensualReal,
    brechaMensualReal,
  }
}
