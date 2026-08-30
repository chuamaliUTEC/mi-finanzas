const currencyFormatters = new Map<string, Intl.NumberFormat>()

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const existing = currencyFormatters.get(currency)
  if (existing) return existing
  const formatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
  currencyFormatters.set(currency, formatter)
  return formatter
}

export function formatCurrency(amount: number, currency = 'PEN'): string {
  return getCurrencyFormatter(currency).format(amount)
}

export function formatDate(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? new Date(isoDate) : isoDate
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatPercent(ratio: number, fractionDigits = 1): string {
  return `${(ratio * 100).toFixed(fractionDigits)}%`
}
