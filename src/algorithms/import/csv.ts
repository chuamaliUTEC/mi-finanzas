// Importación de movimientos (secc. 26). Parser de CSV sin dependencias
// externas: soporta comillas, comas dentro de campos, saltos de línea
// CRLF/LF y separadores coma o punto y coma (común en exportaciones de
// bancos peruanos configurados en español).

export type CsvRow = Record<string, string>

export interface ParsedCsv {
  headers: string[]
  rows: CsvRow[]
  delimiter: string
}

function detectDelimiter(firstLine: string): string {
  const candidates = [';', ',', '\t', '|']
  let best = ','
  let bestCount = 0
  for (const candidate of candidates) {
    // Cuenta ocurrencias fuera de comillas.
    let count = 0
    let inQuotes = false
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i]
      if (char === '"') inQuotes = !inQuotes
      else if (char === candidate && !inQuotes) count++
    }
    if (count > bestCount) {
      bestCount = count
      best = candidate
    }
  }
  return best
}

/** Divide el contenido en celdas respetando comillas y saltos embebidos. */
function tokenize(content: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field.trim())
      field = ''
    } else if (char === '\r') {
      // se maneja con el \n siguiente
    } else if (char === '\n') {
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim())
    rows.push(row)
  }

  return rows.filter((r) => r.some((cell) => cell.length > 0))
}

export function parseCsv(content: string): ParsedCsv {
  const trimmed = content.replace(/^\uFEFF/, '') // quita BOM de Excel
  const firstLine = trimmed.split(/\r?\n/)[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const matrix = tokenize(trimmed, delimiter)
  if (matrix.length === 0) return { headers: [], rows: [], delimiter }

  const headers = matrix[0].map((h, i) => h || `columna_${i + 1}`)
  const rows = matrix.slice(1).map((cells) => {
    const row: CsvRow = {}
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? ''
    })
    return row
  })
  return { headers, rows, delimiter }
}

// ---------------------------------------------------------------------------
// Normalización de valores
// ---------------------------------------------------------------------------

/**
 * Interpreta un monto en formatos habituales: "1,234.56", "1.234,56",
 * "S/ 45.90", "-45.90", "(45.90)" (negativo contable).
 * Devuelve null si no hay un número reconocible.
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null
  let text = raw.trim()
  let negative = false

  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.slice(1, -1)
  }

  text = text.replace(/[^\d,.+-]/g, '')
  if (text.startsWith('-')) {
    negative = true
    text = text.slice(1)
  }
  text = text.replace(/[+-]/g, '')
  if (!text) return null

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')

  if (lastComma > -1 && lastDot > -1) {
    // El separador decimal es el que aparece más a la derecha.
    if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.')
    else text = text.replace(/,/g, '')
  } else if (lastComma > -1) {
    // Una sola coma: decimal si deja 1-2 dígitos a la derecha.
    const decimals = text.length - lastComma - 1
    text = decimals <= 2 ? text.replace(',', '.') : text.replace(/,/g, '')
  } else if (lastDot > -1) {
    const decimals = text.length - lastDot - 1
    if (decimals > 2) text = text.replace(/\./g, '')
  }

  const value = parseFloat(text)
  if (Number.isNaN(value)) return null
  return negative ? -value : value
}

/**
 * Interpreta una fecha en formatos comunes y devuelve ISO yyyy-mm-dd.
 * Asume día/mes/año (convención peruana) cuando es ambiguo.
 */
export function parseDate(raw: string): string | null {
  if (!raw) return null
  const text = raw.trim()

  // Ya viene en ISO.
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const parts = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (parts) {
    const [, first, second, year] = parts
    // Convención peruana: dd/mm/aaaa, salvo que el segundo número no pueda
    // ser un mes (entonces venía en mm/dd/aaaa).
    let day = parseInt(first, 10)
    let month = parseInt(second, 10)
    if (month > 12 && day <= 12) {
      const swap = day
      day = month
      month = swap
    }
    if (day > 31 || month > 12) return null
    let fullYear = parseInt(year, 10)
    if (year.length === 2) fullYear += fullYear < 70 ? 2000 : 1900
    return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

// ---------------------------------------------------------------------------
// Mapeo de columnas y detección de duplicados
// ---------------------------------------------------------------------------

export interface ColumnMapping {
  date: string | null
  amount: string | null
  description: string | null
  category: string | null
  account: string | null
}

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  date: ['fecha', 'date', 'fec', 'dia', 'fecha de operacion', 'fecha operacion'],
  amount: ['monto', 'importe', 'amount', 'valor', 'cargo', 'abono', 'total', 'soles'],
  description: ['descripcion', 'description', 'detalle', 'concepto', 'glosa', 'operacion', 'comercio'],
  category: ['categoria', 'category', 'rubro', 'tipo'],
  account: ['cuenta', 'account', 'tarjeta', 'medio'],
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Propone un mapeo automático de columnas, que la usuaria puede corregir. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null, amount: null, description: null, category: null, account: null,
  }
  const normalized = headers.map((h) => ({ original: h, normal: normalizeHeader(h) }))

  for (const field of Object.keys(HEADER_HINTS) as (keyof ColumnMapping)[]) {
    const hints = HEADER_HINTS[field]
    const match =
      normalized.find((h) => hints.includes(h.normal)) ??
      normalized.find((h) => hints.some((hint) => h.normal.includes(hint)))
    if (match) mapping[field] = match.original
  }
  return mapping
}

export interface ImportCandidate {
  date: string
  amount: number
  description: string
  category: string | null
  account: string | null
  /** true = ya existe un movimiento equivalente registrado. */
  isDuplicate: boolean
  /** Fila original, para mostrar contexto si algo falla. */
  raw: CsvRow
}

export interface ExistingMovement {
  date: string
  amount: number
  description: string | null
  merchant: string | null
}

function normalizeText(value: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Un movimiento es duplicado si coincide fecha y monto (al céntimo) y la
 * descripción es equivalente. Sin la descripción, dos gastos idénticos el
 * mismo día (dos pasajes de S/ 5) se marcarían como duplicados sin serlo,
 * así que solo se consideran iguales cuando también coincide el texto.
 */
export function isDuplicate(candidate: ImportCandidate, existing: ExistingMovement[]): boolean {
  const candidateText = normalizeText(candidate.description)
  return existing.some((movement) => {
    if (movement.date !== candidate.date) return false
    if (Math.abs(movement.amount - Math.abs(candidate.amount)) > 0.005) return false
    const existingText = normalizeText(movement.description ?? movement.merchant)
    if (!candidateText && !existingText) return true
    return existingText === candidateText
  })
}

export interface MappingResult {
  candidates: ImportCandidate[]
  /** Filas que no se pudieron interpretar, con el motivo. */
  errors: { row: number; reason: string }[]
  duplicateCount: number
}

export function buildCandidates(
  rows: CsvRow[],
  mapping: ColumnMapping,
  existing: ExistingMovement[],
): MappingResult {
  const candidates: ImportCandidate[] = []
  const errors: { row: number; reason: string }[] = []

  rows.forEach((row, index) => {
    if (!mapping.date || !mapping.amount) {
      errors.push({ row: index + 1, reason: 'Falta mapear fecha o monto' })
      return
    }
    const date = parseDate(row[mapping.date] ?? '')
    const amount = parseAmount(row[mapping.amount] ?? '')
    if (!date) {
      errors.push({ row: index + 1, reason: `Fecha no reconocida: "${row[mapping.date]}"` })
      return
    }
    if (amount === null || amount === 0) {
      errors.push({ row: index + 1, reason: `Monto no reconocido: "${row[mapping.amount]}"` })
      return
    }
    const candidate: ImportCandidate = {
      date,
      amount,
      description: mapping.description ? (row[mapping.description] ?? '') : '',
      category: mapping.category ? (row[mapping.category] ?? null) : null,
      account: mapping.account ? (row[mapping.account] ?? null) : null,
      isDuplicate: false,
      raw: row,
    }
    candidate.isDuplicate = isDuplicate(candidate, existing)
    candidates.push(candidate)
  })

  // Duplicados dentro del propio archivo (una fila repetida dos veces).
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const key = `${candidate.date}|${Math.abs(candidate.amount).toFixed(2)}|${normalizeText(candidate.description)}`
    if (seen.has(key)) candidate.isDuplicate = true
    else seen.add(key)
  }

  return {
    candidates,
    errors,
    duplicateCount: candidates.filter((c) => c.isDuplicate).length,
  }
}
