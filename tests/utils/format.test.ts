import { describe, expect, it } from 'vitest'
import { formatCurrency } from '@/utils/format'

describe('formatCurrency', () => {
  it('formats a number as PEN currency by default', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.50')
  })
})
