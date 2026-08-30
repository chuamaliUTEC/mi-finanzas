import { describe, expect, it } from 'vitest'
import { computeHealth } from '@/algorithms/health/health'

function inputs(overrides: Partial<Parameters<typeof computeHealth>[0]> = {}) {
  return {
    availableMoney: 1000,
    monthlyEssentialSpend: 1000,
    monthlyIncome: 3000,
    monthlyExpenses: 2400,
    totalDebt: 0,
    monthlyDebtPayments: 0,
    netWorth: 1000,
    totalAssets: 1000,
    emergencyFundCurrent: 0,
    emergencyFundTarget: 1600,
    goalsTotal: 0,
    goalsAchieved: 0,
    ...overrides,
  }
}

describe('computeHealth', () => {
  it('devuelve los seis indicadores con explicación y cómo mejorar', () => {
    const health = computeHealth(inputs())
    expect(health.indicators.map((i) => i.key)).toEqual([
      'liquidez', 'flujo', 'deuda', 'patrimonio', 'seguridad', 'progreso',
    ])
    for (const indicator of health.indicators) {
      expect(indicator.meaning.length).toBeGreaterThan(20)
      expect(indicator.howToImprove.length).toBeGreaterThan(10)
      expect(indicator.ratio).toBeGreaterThanOrEqual(0)
      expect(indicator.ratio).toBeLessThanOrEqual(1)
    }
  })

  it('la puntuación queda entre 0 y 100', () => {
    const mala = computeHealth(
      inputs({
        availableMoney: 0, monthlyIncome: 2405, monthlyExpenses: 3000,
        totalDebt: 9953, monthlyDebtPayments: 1200, netWorth: -6418,
        totalAssets: 3535,
      }),
    )
    const buena = computeHealth(
      inputs({
        availableMoney: 5000, monthlyEssentialSpend: 1000,
        monthlyIncome: 3000, monthlyExpenses: 2000,
        totalDebt: 0, netWorth: 20000, totalAssets: 20000,
        emergencyFundCurrent: 1600, goalsTotal: 2, goalsAchieved: 2,
      }),
    )
    expect(mala.score).toBeGreaterThanOrEqual(0)
    expect(buena.score).toBeLessThanOrEqual(100)
    expect(buena.score).toBeGreaterThan(mala.score)
  })

  it('el perfil inicial (patrimonio negativo, deuda alta) no sale bien parado', () => {
    const health = computeHealth(
      inputs({
        availableMoney: 0, monthlyEssentialSpend: 311,
        monthlyIncome: 2405, monthlyExpenses: 2405,
        totalDebt: 9952.83, monthlyDebtPayments: 800,
        netWorth: -6417.83, totalAssets: 3535,
        emergencyFundCurrent: 0, emergencyFundTarget: 1600,
      }),
    )
    expect(health.label).toBe('Frágil')
    expect(health.indicators.find((i) => i.key === 'seguridad')?.ratio).toBe(0)
    expect(health.indicators.find((i) => i.key === 'liquidez')?.ratio).toBe(0)
  })

  it('sin deuda, el indicador de deuda está al máximo', () => {
    const health = computeHealth(inputs({ totalDebt: 0, monthlyDebtPayments: 0 }))
    const deuda = health.indicators.find((i) => i.key === 'deuda')!
    expect(deuda.ratio).toBe(1)
    expect(deuda.value).toBe('Sin deuda')
  })

  it('el fondo de emergencia completo marca seguridad al 100 %', () => {
    const health = computeHealth(
      inputs({ emergencyFundCurrent: 1600, emergencyFundTarget: 1600 }),
    )
    expect(health.indicators.find((i) => i.key === 'seguridad')?.ratio).toBe(1)
  })

  it('no se rompe con todo en cero (usuaria recién registrada)', () => {
    const health = computeHealth(
      inputs({
        availableMoney: 0, monthlyEssentialSpend: 0, monthlyIncome: 0,
        monthlyExpenses: 0, totalDebt: 0, monthlyDebtPayments: 0,
        netWorth: 0, totalAssets: 0, emergencyFundTarget: 0,
        goalsTotal: 0, goalsAchieved: 0,
      }),
    )
    expect(Number.isFinite(health.score)).toBe(true)
    expect(health.indicators.every((i) => Number.isFinite(i.ratio))).toBe(true)
  })

  it('un flujo negativo lo refleja en el valor mostrado', () => {
    const health = computeHealth(inputs({ monthlyIncome: 2000, monthlyExpenses: 2500 }))
    const flujo = health.indicators.find((i) => i.key === 'flujo')!
    expect(flujo.ratio).toBe(0)
    expect(flujo.value).toContain('-500')
  })
})
