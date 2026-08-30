import { useState } from 'react'
import { useTable } from '@/hooks/useTable'
import { receivableBalance } from '@/algorithms/networth/networth'
import { BigFigure } from '@/components/ui/BigFigure'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency, formatDate } from '@/utils/format'

export function MeDeben() {
  const receivables = useTable('receivables')
  const payments = useTable('receivable_payments')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [nuevo, setNuevo] = useState({ person: '', amount: '', expected_date: '' })

  const totalPending = receivables.rows
    .filter((r) => r.status !== 'incobrable')
    .reduce((sum, r) => sum + receivableBalance(r, payments.rows), 0)

  async function registerPayment(receivableId: string) {
    const amount = parseFloat(drafts[receivableId] ?? '')
    if (!(amount > 0)) return
    await payments.insert({ receivable_id: receivableId, amount })
    const receivable = receivables.rows.find((r) => r.id === receivableId)
    if (receivable) {
      const remaining = receivableBalance(receivable, payments.rows) - amount
      await receivables.update(receivableId, {
        status: remaining <= 0.005 ? 'cobrado' : 'parcial',
      })
    }
    setDrafts((d) => ({ ...d, [receivableId]: '' }))
  }

  async function addReceivable() {
    const amount = parseFloat(nuevo.amount)
    if (!nuevo.person || !(amount > 0)) return
    await receivables.insert({
      person: nuevo.person,
      original_amount: amount,
      expected_date: nuevo.expected_date || null,
    })
    setNuevo({ person: '', amount: '', expected_date: '' })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Me deben" subtitle="¿Cuánto me deben y quién?" />

      <BigFigure
        label="🤝 Total por cobrar"
        amount={totalPending}
        hint="No cuenta como dinero disponible hasta que realmente lo recibas."
      />

      <div className="space-y-3">
        {receivables.rows.map((r) => {
          const balance = receivableBalance(r, payments.rows)
          const history = payments.rows.filter((p) => p.receivable_id === r.id)
          return (
            <div key={r.id} className="card space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-ink-900">
                  {r.person}
                  <span className="ml-2 text-xs text-ink-400">
                    {r.status === 'cobrado'
                      ? '✅ cobrado'
                      : r.status === 'parcial'
                        ? '🟡 parcial'
                        : r.status === 'incobrable'
                          ? '⛔ incobrable'
                          : '⏳ pendiente'}
                  </span>
                </p>
                <p className="font-semibold text-ink-900">
                  {formatCurrency(balance)}{' '}
                  <span className="text-xs font-normal text-ink-400">
                    de {formatCurrency(r.original_amount)}
                  </span>
                </p>
              </div>
              {r.expected_date && (
                <p className="text-xs text-ink-500">Fecha esperada: {formatDate(r.expected_date)}</p>
              )}
              {history.length > 0 && (
                <ul className="text-xs text-ink-500">
                  {history.map((p) => (
                    <li key={p.id}>
                      {formatDate(p.date)}: recibiste {formatCurrency(p.amount)}
                    </li>
                  ))}
                </ul>
              )}
              {balance > 0 && r.status !== 'incobrable' && (
                <div className="flex items-center gap-2">
                  <input
                    className="input w-32 !py-1.5"
                    type="number"
                    step="0.01"
                    placeholder="Cobro S/"
                    value={drafts[r.id] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  />
                  <button
                    className="text-sm text-lavender-700"
                    onClick={() => void registerPayment(r.id)}
                  >
                    Registrar cobro
                  </button>
                  <button
                    className="ml-auto text-sm text-ink-400"
                    onClick={() => void receivables.update(r.id, { status: 'incobrable' })}
                  >
                    Marcar incobrable
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {receivables.rows.length === 0 && !receivables.loading && (
          <p className="text-sm text-ink-500">Nadie te debe por ahora.</p>
        )}
      </div>

      <div className="card flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label className="label">Persona</label>
          <input
            className="input"
            value={nuevo.person}
            onChange={(e) => setNuevo({ ...nuevo, person: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Monto (S/)</label>
          <input
            className="input w-28"
            type="number"
            step="0.01"
            value={nuevo.amount}
            onChange={(e) => setNuevo({ ...nuevo, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Fecha esperada</label>
          <input
            className="input"
            type="date"
            value={nuevo.expected_date}
            onChange={(e) => setNuevo({ ...nuevo, expected_date: e.target.value })}
          />
        </div>
        <button className="btn-primary" onClick={() => void addReceivable()}>
          Agregar
        </button>
      </div>
    </div>
  )
}
