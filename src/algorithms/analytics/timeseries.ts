const MONTH_LABELS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export interface MonthBucket {
  monthKey: string // YYYY-MM
  label: string // "Ago '26"
}

/** Last N calendar months, oldest first, ending with the current month. */
export function lastNMonthBuckets(n: number, today = new Date()): MonthBucket[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTH_LABELS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
    return { monthKey, label }
  })
}

export interface DatedRecord {
  date: string // ISO date, YYYY-MM-DD...
  amount: number
}

/** Sums `records` into the given month buckets (zero-filled where there's no data). */
export function sumByMonth(records: DatedRecord[], buckets: MonthBucket[]): number[] {
  const totals = new Map(buckets.map((b) => [b.monthKey, 0]))
  for (const record of records) {
    const key = record.date.slice(0, 7)
    if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + record.amount)
  }
  return buckets.map((b) => totals.get(b.monthKey) ?? 0)
}
