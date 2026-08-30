import { describe, expect, it } from 'vitest'
import { formatCurrency, formatPercent } from '@/utils/format'

describe('formatCurrency', () => {
  it('formatea soles con el símbolo esperado', () => {
    expect(formatCurrency(2405)).toContain('2,405')
  })

  it('soporta otras monedas sin convertir el monto', () => {
    expect(formatCurrency(100, 'USD')).toContain('100')
  })
})

describe('formatPercent', () => {
  it('convierte una razón a porcentaje con un decimal por defecto', () => {
    expect(formatPercent(0.675)).toBe('67.5%')
  })

  it('respeta la cantidad de decimales solicitada', () => {
    expect(formatPercent(1.0983, 2)).toBe('109.83%')
  })
})
