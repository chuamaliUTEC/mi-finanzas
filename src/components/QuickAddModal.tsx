import { useState, type FormEvent } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { todayISODate } from '@/utils/format'
import type { Expense, ExpenseCategory, IncomeSource, IncomeTransaction } from '@/types/database'

interface QuickAddModalProps {
  onClose: () => void
}

type Kind = 'gasto' | 'ingreso'

export function QuickAddModal({ onClose }: QuickAddModalProps) {
  const [kind, setKind] = useState<Kind>('gasto')
  const { data: categories } = useSupabaseTable<ExpenseCategory>('expense_categories', { orderBy: 'name' })
  const { data: sources } = useSupabaseTable<IncomeSource>('income_sources', { orderBy: 'name' })
  const { create: createExpense } = useSupabaseTable<Expense>('expenses')
  const { create: createIncome } = useSupabaseTable<IncomeTransaction>('income_transactions')

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [date, setDate] = useState(todayISODate())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const result =
      kind === 'gasto'
        ? await createExpense({
            description,
            amount: Number(amount),
            spent_at: date,
            category_id: categoryId || null,
          } as Partial<Expense>)
        : await createIncome({
            description,
            amount: Number(amount),
            received_at: date,
            source_id: sourceId || null,
          } as Partial<IncomeTransaction>)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setDescription('')
      setAmount('')
      setCategoryId('')
      setSourceId('')
      setTimeout(onClose, 700)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-4 pt-20" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Registro rápido</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="mb-3 flex rounded-md bg-gray-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setKind('gasto')}
            className={`flex-1 rounded-md py-1.5 font-medium ${kind === 'gasto' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
          >
            Gasto
          </button>
          <button
            type="button"
            onClick={() => setKind('ingreso')}
            className={`flex-1 rounded-md py-1.5 font-medium ${kind === 'ingreso' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}
          >
            Ingreso
          </button>
        </div>

        {success ? (
          <p className="py-4 text-center text-sm text-brand-700">¡Guardado!</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="number"
              step="0.01"
              required
              placeholder="Monto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {kind === 'gasto' ? (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Sin fuente específica</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                kind === 'gasto' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {submitting ? 'Guardando…' : `Agregar ${kind}`}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
