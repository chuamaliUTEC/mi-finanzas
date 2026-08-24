export function formatCurrency(amount: number, currency = 'PEN', locale = 'es-PE') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

export function formatDate(isoDate: string, locale = 'es-PE') {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(isoDate))
}

export function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}
