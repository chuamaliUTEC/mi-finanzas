import { describe, expect, it } from 'vitest'
import {
  buildCandidates,
  isDuplicate,
  parseAmount,
  parseCsv,
  parseDate,
  suggestMapping,
  type ColumnMapping,
  type ImportCandidate,
} from '@/algorithms/import/csv'

describe('parseCsv', () => {
  it('lee cabeceras y filas con separador coma', () => {
    const { headers, rows } = parseCsv('Fecha,Monto,Descripción\n2026-09-01,25.50,Almuerzo')
    expect(headers).toEqual(['Fecha', 'Monto', 'Descripción'])
    expect(rows).toHaveLength(1)
    expect(rows[0]['Monto']).toBe('25.50')
  })

  it('detecta punto y coma como separador (exportaciones en español)', () => {
    const { headers, delimiter, rows } = parseCsv('Fecha;Importe;Detalle\n01/09/2026;1.234,56;Pago')
    expect(delimiter).toBe(';')
    expect(headers).toEqual(['Fecha', 'Importe', 'Detalle'])
    expect(rows[0]['Importe']).toBe('1.234,56')
  })

  it('respeta comas dentro de comillas', () => {
    const { rows } = parseCsv('Fecha,Descripción,Monto\n2026-09-01,"Compra, supermercado",100')
    expect(rows[0]['Descripción']).toBe('Compra, supermercado')
    expect(rows[0]['Monto']).toBe('100')
  })

  it('maneja comillas escapadas, CRLF y BOM de Excel', () => {
    const { rows, headers } = parseCsv('﻿Fecha,Detalle\r\n2026-09-01,"Dijo ""hola"""\r\n')
    expect(headers[0]).toBe('Fecha')
    expect(rows[0]['Detalle']).toBe('Dijo "hola"')
  })

  it('ignora líneas en blanco y devuelve vacío sin contenido', () => {
    expect(parseCsv('').rows).toEqual([])
    expect(parseCsv('Fecha,Monto\n\n2026-09-01,10\n\n').rows).toHaveLength(1)
  })
})

describe('parseAmount', () => {
  it('interpreta formato peruano y anglosajón', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('25.50')).toBe(25.5)
    expect(parseAmount('25,50')).toBe(25.5)
    expect(parseAmount('1234')).toBe(1234)
  })

  it('quita el símbolo de moneda y maneja negativos', () => {
    expect(parseAmount('S/ 45.90')).toBe(45.9)
    expect(parseAmount('-348.44')).toBe(-348.44)
    expect(parseAmount('(348.44)')).toBe(-348.44) // negativo contable
  })

  it('trata separadores de miles sin decimales', () => {
    expect(parseAmount('1.234')).toBe(1234)
    expect(parseAmount('12.345.678')).toBe(12345678)
  })

  it('devuelve null cuando no hay número', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('sin monto')).toBeNull()
  })
})

describe('parseDate', () => {
  it('acepta ISO y dd/mm/yyyy', () => {
    expect(parseDate('2026-09-01')).toBe('2026-09-01')
    expect(parseDate('01/09/2026')).toBe('2026-09-01')
    expect(parseDate('1/9/2026')).toBe('2026-09-01')
    expect(parseDate('01-09-2026')).toBe('2026-09-01')
  })

  it('desambigua cuando el orden es claramente mm/dd', () => {
    expect(parseDate('09/25/2026')).toBe('2026-09-25')
  })

  it('completa años de dos dígitos', () => {
    expect(parseDate('01/09/26')).toBe('2026-09-01')
  })

  it('devuelve null si no reconoce la fecha', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate('ayer')).toBeNull()
    expect(parseDate('45/45/2026')).toBeNull()
  })
})

describe('suggestMapping', () => {
  it('reconoce cabeceras habituales, con o sin tildes', () => {
    const mapping = suggestMapping(['Fecha', 'Descripción', 'Monto', 'Categoría', 'Cuenta'])
    expect(mapping.date).toBe('Fecha')
    expect(mapping.amount).toBe('Monto')
    expect(mapping.description).toBe('Descripción')
    expect(mapping.category).toBe('Categoría')
    expect(mapping.account).toBe('Cuenta')
  })

  it('reconoce sinónimos de banco', () => {
    const mapping = suggestMapping(['Fecha de operación', 'Glosa', 'Importe'])
    expect(mapping.date).toBe('Fecha de operación')
    expect(mapping.description).toBe('Glosa')
    expect(mapping.amount).toBe('Importe')
  })

  it('deja en null lo que no reconoce', () => {
    const mapping = suggestMapping(['col_a', 'col_b'])
    expect(mapping.date).toBeNull()
    expect(mapping.amount).toBeNull()
  })
})

describe('detección de duplicados', () => {
  function candidate(overrides: Partial<ImportCandidate> = {}): ImportCandidate {
    return {
      date: '2026-09-01', amount: 25.5, description: 'Almuerzo',
      category: null, account: null, isDuplicate: false, raw: {},
      ...overrides,
    }
  }

  it('marca duplicado cuando coinciden fecha, monto y descripción', () => {
    const existing = [
      { date: '2026-09-01', amount: 25.5, description: 'Almuerzo', merchant: null },
    ]
    expect(isDuplicate(candidate(), existing)).toBe(true)
  })

  it('NO marca duplicado dos gastos iguales con distinta descripción', () => {
    const existing = [
      { date: '2026-09-01', amount: 5, description: 'Pasaje ida', merchant: null },
    ]
    expect(isDuplicate(candidate({ amount: 5, description: 'Pasaje vuelta' }), existing)).toBe(false)
  })

  it('no le afecta el signo ni las mayúsculas o tildes', () => {
    const existing = [
      { date: '2026-09-01', amount: 25.5, description: 'ALMUERZO', merchant: null },
    ]
    expect(isDuplicate(candidate({ amount: -25.5, description: 'almuerzo' }), existing)).toBe(true)
  })

  it('distingue por fecha y por monto', () => {
    const existing = [
      { date: '2026-09-01', amount: 25.5, description: 'Almuerzo', merchant: null },
    ]
    expect(isDuplicate(candidate({ date: '2026-09-02' }), existing)).toBe(false)
    expect(isDuplicate(candidate({ amount: 26 }), existing)).toBe(false)
  })

  it('compara contra el comercio cuando no hay descripción registrada', () => {
    const existing = [{ date: '2026-09-01', amount: 25.5, description: null, merchant: 'Almuerzo' }]
    expect(isDuplicate(candidate(), existing)).toBe(true)
  })
})

describe('buildCandidates', () => {
  const mapping: ColumnMapping = {
    date: 'Fecha', amount: 'Monto', description: 'Detalle',
    category: null, account: null,
  }

  it('convierte filas válidas y reporta las que no se pueden interpretar', () => {
    const rows = [
      { Fecha: '01/09/2026', Monto: 'S/ 25.50', Detalle: 'Almuerzo' },
      { Fecha: 'ayer', Monto: '10', Detalle: 'Malo' },
      { Fecha: '02/09/2026', Monto: 'sin monto', Detalle: 'Malo' },
    ]
    const result = buildCandidates(rows, mapping, [])
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].amount).toBe(25.5)
    expect(result.candidates[0].date).toBe('2026-09-01')
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0].row).toBe(2)
  })

  it('marca duplicados contra lo ya registrado', () => {
    const rows = [{ Fecha: '01/09/2026', Monto: '25.50', Detalle: 'Almuerzo' }]
    const result = buildCandidates(rows, mapping, [
      { date: '2026-09-01', amount: 25.5, description: 'Almuerzo', merchant: null },
    ])
    expect(result.duplicateCount).toBe(1)
    expect(result.candidates[0].isDuplicate).toBe(true)
  })

  it('detecta filas repetidas dentro del propio archivo', () => {
    const rows = [
      { Fecha: '01/09/2026', Monto: '25.50', Detalle: 'Almuerzo' },
      { Fecha: '01/09/2026', Monto: '25.50', Detalle: 'Almuerzo' },
    ]
    const result = buildCandidates(rows, mapping, [])
    expect(result.candidates[0].isDuplicate).toBe(false) // la primera se queda
    expect(result.candidates[1].isDuplicate).toBe(true) // la copia se marca
    expect(result.duplicateCount).toBe(1)
  })

  it('exige mapear fecha y monto', () => {
    const rows = [{ Fecha: '01/09/2026', Monto: '25.50', Detalle: 'x' }]
    const result = buildCandidates(rows, { ...mapping, amount: null }, [])
    expect(result.candidates).toHaveLength(0)
    expect(result.errors[0].reason).toContain('Falta mapear')
  })

  it('ignora montos en cero', () => {
    const rows = [{ Fecha: '01/09/2026', Monto: '0', Detalle: 'Nada' }]
    expect(buildCandidates(rows, mapping, []).candidates).toHaveLength(0)
  })
})
