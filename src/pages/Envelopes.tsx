import { useState, type FormEvent } from 'react'
import { useEnvelopes } from '@/hooks/useEnvelopes'
import { formatCurrency } from '@/utils/format'

export default function Envelopes() {
  const {
    periodMonth,
    budget,
    envelopes,
    totalIncome,
    totalPlanned,
    unallocated,
    loading,
    error,
    ensureBudget,
    setEnvelopeAmount,
  } = useEnvelopes()

  const [incomeInput, setIncomeInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Record<string, string>>({})

  const handleCreateBudget = async (event: FormEvent) => {
    event.preventDefault()
    setCreating(true)
    await ensureBudget(Number(incomeInput) || 0)
    setCreating(false)
  }

  const handleSaveEnvelope = async (categoryId: string) => {
    const amount = Number(editing[categoryId] ?? 0)
    await setEnvelopeAmount(categoryId, amount)
    setEditing((e) => {
      const next = { ...e }
      delete next[categoryId]
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">✉️ Sobres del mes</h2>
        <p className="text-sm text-gray-500">
          Cada sol de tu ingreso debe tener un destino. El dinero de un sobre no cuenta como
          disponible para otro.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !budget ? (
        <form
          onSubmit={handleCreateBudget}
          className="max-w-sm space-y-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <p className="text-sm text-gray-600">
            Aún no hay presupuesto para {periodMonth}. Ingresa tu ingreso esperado para empezar a
            asignar sobres.
          </p>
          <input
            type="number"
            step="0.01"
            required
            placeholder="Ingreso esperado del mes"
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Crear presupuesto del mes'}
          </button>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Ingreso del mes</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Asignado a sobres</p>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(totalPlanned)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Sin asignar</p>
              <p className={`text-lg font-semibold ${unallocated < 0 ? 'text-red-600' : 'text-brand-700'}`}>
                {formatCurrency(unallocated)}
              </p>
              {unallocated < 0 && (
                <p className="mt-1 text-xs text-red-600">Asignaste más de lo que ingresa este mes.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {envelopes.length === 0 ? (
              <p className="text-sm text-gray-500">
                Crea categorías de gasto primero (en la página Gastos) para poder asignarles sobres.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {envelopes.map((env) => {
                  const pct = env.planned > 0 ? Math.min((env.spent / env.planned) * 100, 100) : 0
                  return (
                    <li key={env.categoryId} className="py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">{env.categoryName}</span>
                        {editing[env.categoryId] === undefined ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditing((e) => ({ ...e, [env.categoryId]: String(env.planned) }))
                            }
                            className="text-xs text-brand-600 hover:underline"
                          >
                            {env.planned > 0 ? 'Editar' : 'Asignar'}
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              autoFocus
                              value={editing[env.categoryId]}
                              onChange={(e) =>
                                setEditing((prev) => ({ ...prev, [env.categoryId]: e.target.value }))
                              }
                              className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEnvelope(env.categoryId)}
                              className="text-xs text-brand-600 hover:underline"
                            >
                              Guardar
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {formatCurrency(env.spent)} de {formatCurrency(env.planned)}
                        </span>
                        <span className={env.overBudget ? 'font-medium text-red-600' : ''}>
                          {env.overBudget
                            ? `Excedido en ${formatCurrency(Math.abs(env.remaining))}`
                            : `Quedan ${formatCurrency(env.remaining)}`}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full ${env.overBudget ? 'bg-red-500' : 'bg-brand-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
