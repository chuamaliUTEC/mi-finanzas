import { useState, type FormEvent } from 'react'
import { useFinancialMemory } from '@/hooks/useFinancialMemory'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate } from '@/utils/format'
import type { DataStatus } from '@/types/database'

const STATUS_OPTIONS: DataStatus[] = ['actual', 'confirmado', 'por_confirmar', 'desactualizado']

export default function FinancialMemoryPage() {
  const { groups, loading, error, addFact } = useFinancialMemory()
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<DataStatus>('actual')
  const [source, setSource] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    const result = await addFact(key.trim(), value.trim(), { status, source: source.trim() || 'manual' })
    setSubmitting(false)
    if (result.error) {
      setFormError(result.error)
    } else {
      setKey('')
      setValue('')
      setSource('')
      setStatus('actual')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">🧠 Memoria financiera</h2>
        <p className="text-sm text-gray-500">
          Hechos que el sistema recuerda sobre tus finanzas. Registrar un nuevo valor nunca borra el
          anterior: el dato previo pasa a histórico automáticamente.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-4"
      >
        <div>
          <label htmlFor="key" className="block text-xs font-medium text-gray-600">
            Clave (ej. ingreso_principal)
          </label>
          <input
            id="key"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="value" className="block text-xs font-medium text-gray-600">
            Valor
          </label>
          <input
            id="value"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-gray-600">
            Estado
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as DataStatus)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source" className="block text-xs font-medium text-gray-600">
            Fuente
          </label>
          <input
            id="source"
            placeholder="manual"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="sm:col-span-2 md:col-span-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Registrar hecho'}
          </button>
          {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
        </div>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {loading ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay hechos registrados.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {groups.map((group) => (
              <li key={group.key} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{group.key}</p>
                    <p className="text-sm text-gray-600">
                      {String(group.current?.memory_value.texto ?? '—')}
                    </p>
                    {group.current && (
                      <p className="text-xs text-gray-400">
                        {formatDate(group.current.effective_date)} · fuente: {group.current.source}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {group.current && <StatusBadge status={group.current.status} />}
                    {group.history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [group.key]: !e[group.key] }))}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        {expanded[group.key] ? 'Ocultar histórico' : `Ver histórico (${group.history.length})`}
                      </button>
                    )}
                  </div>
                </div>
                {expanded[group.key] && (
                  <ul className="mt-2 space-y-1 border-l-2 border-gray-100 pl-3">
                    {group.history.map((item) => (
                      <li key={item.id} className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {String(item.memory_value.texto ?? '—')} · {formatDate(item.effective_date)}
                        </span>
                        <StatusBadge status={item.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
