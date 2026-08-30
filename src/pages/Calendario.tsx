import { useMemo } from 'react'
import { useFinancialOverview } from '@/hooks/useFinancialOverview'
import { monthlyExpectedIncome, nextOccurrence } from '@/algorithms/spendable/spendable'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatDate } from '@/utils/format'

// CALENDARIO FINANCIERO (secc. 33): pagos, ingresos, vencimientos, cuotas,
// tarjetas, metas e ingresos extraordinarios en una sola línea de tiempo.

interface CalendarEntry {
  date: string
  icon: string
  label: string
  amount: number | null
  tone: 'salida' | 'entrada' | 'neutro'
}

export function Calendario() {
  const overview = useFinancialOverview()
  const { tables, today } = overview

  const entries = useMemo(() => {
    const list: CalendarEntry[] = []
    const horizon = new Date(today)
    horizon.setDate(horizon.getDate() + 60)
    const horizonIso = horizon.toISOString().slice(0, 10)

    // Salidas: pagos próximos ya calculados (deudas, recurrentes, tarjetas).
    for (const payment of overview.upcoming) {
      list.push({
        date: payment.date,
        icon: payment.kind === 'tarjeta' ? '💳' : '🔴',
        label: payment.label,
        amount: payment.amount > 0 ? payment.amount : null,
        tone: 'salida',
      })
    }

    // Entradas: fuentes de ingreso con día esperado.
    for (const source of tables.sources?.rows ?? []) {
      if (source.deleted_at !== null || !source.is_active || !source.expected_day) continue
      const date = nextOccurrence(source.expected_day, today)
      if (date > horizonIso) continue
      list.push({
        date,
        icon: '🟢',
        label: source.name,
        amount: monthlyExpectedIncome(source) || source.expected_amount,
        tone: 'entrada',
      })
    }

    // Entradas: ingresos extraordinarios esperados con fecha.
    for (const extra of tables.extraordinary.rows) {
      if (extra.deleted_at !== null || extra.status !== 'esperado' || !extra.expected_date) continue
      if (extra.expected_date > horizonIso) continue
      list.push({
        date: extra.expected_date,
        icon: '🎁',
        label: `${extra.name} (esperado)`,
        amount: extra.expected_amount,
        tone: 'entrada',
      })
    }

    // Hitos: fechas objetivo de deudas y metas.
    for (const debt of tables.debts.rows) {
      if (debt.deleted_at !== null || !debt.target_payoff_date) continue
      if (debt.target_payoff_date > horizonIso) continue
      list.push({
        date: debt.target_payoff_date,
        icon: '🎯',
        label: `Fecha objetivo: ${debt.name ?? debt.creditor} en S/ 0`,
        amount: null,
        tone: 'neutro',
      })
    }
    for (const goal of tables.goals.rows) {
      if (goal.deleted_at !== null || !goal.target_date || goal.status !== 'activa') continue
      if (goal.target_date > horizonIso) continue
      list.push({
        date: goal.target_date,
        icon: '🎯',
        label: `Meta: ${goal.name}`,
        amount: goal.target_amount,
        tone: 'neutro',
      })
    }

    return list.sort((a, b) => a.date.localeCompare(b.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview.upcoming, tables.extraordinary.rows, tables.debts.rows, tables.goals.rows])

  // Agrupa por fecha para no repetir el día en cada fila.
  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.date) ?? []
      list.push(entry)
      map.set(entry.date, list)
    }
    return [...map.entries()]
  }, [entries])

  const todayIso = today.toISOString().slice(0, 10)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Calendario" subtitle="¿Qué viene y cuándo?" />

      {overview.loading && <p className="text-sm text-ink-400">Cargando…</p>}

      {!overview.loading && grouped.length === 0 && (
        <div className="card">
          <p className="text-sm text-ink-500">
            No hay eventos en los próximos 60 días. Agrega días de pago a tus deudas y gastos
            recurrentes para verlos aquí.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([date, dayEntries]) => (
          <div key={date} className="card">
            <p className="text-sm font-semibold text-ink-900">
              {formatDate(date)}
              {date === todayIso && (
                <span className="ml-2 rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-medium text-lavender-700">
                  hoy
                </span>
              )}
            </p>
            <ul className="mt-2 space-y-1.5">
              {dayEntries.map((entry, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-700">
                    {entry.icon} {entry.label}
                  </span>
                  {entry.amount !== null && (
                    <span
                      className={`shrink-0 font-medium ${
                        entry.tone === 'entrada' ? 'text-positive' : 'text-ink-900'
                      }`}
                    >
                      {entry.tone === 'entrada' ? '+' : ''}
                      {formatCurrency(entry.amount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
