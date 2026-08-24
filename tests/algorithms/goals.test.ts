import { describe, expect, it } from 'vitest'
import { annualToMonthlyRate, futureValue, loanMonthlyPayment, monthsToReach, realValue } from '@/algorithms/goals/finance'
import { projectDepartamento } from '@/algorithms/goals/departamento'
import { projectRetiro } from '@/algorithms/goals/retiro'

describe('finance helpers', () => {
  it('futureValue compounds principal and a monthly annuity', () => {
    const fv = futureValue(1000, 100, 0.01, 12)
    expect(fv).toBeGreaterThan(1000 + 100 * 12) // interest adds on top of contributions
  })

  it('futureValue with zero rate is just principal plus contributions', () => {
    expect(futureValue(1000, 100, 0, 12)).toBeCloseTo(2200)
  })

  it('realValue deflates a nominal amount by inflation', () => {
    expect(realValue(1000, 0.1, 1)).toBeCloseTo(909.09, 1)
  })

  it('annualToMonthlyRate compounds correctly', () => {
    const monthly = annualToMonthlyRate(0.12)
    expect(Math.pow(1 + monthly, 12)).toBeCloseTo(1.12, 5)
  })

  it('loanMonthlyPayment amortizes a fixed-rate loan', () => {
    const payment = loanMonthlyPayment(10000, 0.12, 12)
    expect(payment).toBeGreaterThan(10000 / 12) // more than principal alone due to interest
  })

  it('monthsToReach finds when a target balance is reached', () => {
    const months = monthsToReach(1200, 0, 100, 0)
    expect(months).toBe(12)
  })

  it('monthsToReach returns null when it is impossible to reach the target', () => {
    expect(monthsToReach(1000, 0, 0, 0)).toBeNull()
  })
})

describe('projectDepartamento', () => {
  it('flags the "comprar al contado" scenario as feasible when capital covers price + costs', () => {
    const result = projectDepartamento({
      precioObjetivo: 1000,
      cuotaInicialPct: 0.2,
      gastosCompra: 0,
      ahorroActual: 1000,
      ahorroMensual: 0,
      mesesHastaObjetivo: 1,
      tasaRendimientoAnual: 0,
      tasaHipotecaAnual: 0.09,
      plazoHipotecaMeses: 12,
    })
    const contado = result.scenarios.find((s) => s.nombre === 'Comprar al contado')
    expect(contado?.factible).toBe(true)
  })

  it('flags scenarios as not feasible when savings fall short', () => {
    const result = projectDepartamento({
      precioObjetivo: 100000,
      cuotaInicialPct: 0.2,
      gastosCompra: 0,
      ahorroActual: 0,
      ahorroMensual: 10,
      mesesHastaObjetivo: 1,
      tasaRendimientoAnual: 0,
      tasaHipotecaAnual: 0.09,
      plazoHipotecaMeses: 12,
    })
    const contado = result.scenarios.find((s) => s.nombre === 'Comprar al contado')
    expect(contado?.factible).toBe(false)
  })
})

describe('projectRetiro', () => {
  it('computes a positive gap when desired income exceeds projected income', () => {
    const result = projectRetiro({
      edadActual: 25,
      edadObjetivo: 60,
      capitalActual: 0,
      aporteMensual: 0,
      tasaRendimientoAnual: 0.05,
      inflacionAnual: 0.03,
      ingresoDeseadoMensualRetiro: 5000,
      aniosEsperadosDeRetiro: 25,
    })
    expect(result.brechaMensualReal).not.toBeNull()
    expect(result.brechaMensualReal as number).toBeGreaterThan(0)
  })

  it('returns null gap when no desired income was provided', () => {
    const result = projectRetiro({
      edadActual: 25,
      edadObjetivo: 60,
      capitalActual: 0,
      aporteMensual: 100,
      tasaRendimientoAnual: 0.05,
      inflacionAnual: 0.03,
      ingresoDeseadoMensualRetiro: null,
      aniosEsperadosDeRetiro: 25,
    })
    expect(result.brechaMensualReal).toBeNull()
  })
})
