import { useState } from 'react'
import { useLearning } from '@/hooks/useLearning'
import { formatCurrency } from '@/utils/format'

export default function Learning() {
  const { suggestions, loading, error, approveSuggestion } = useLearning()
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const handleApprove = async (categoryId: string) => {
    const suggestion = suggestions.find((s) => s.categoryId === categoryId)
    if (!suggestion) return
    setApprovingId(categoryId)
    const result = await approveSuggestion(suggestion)
    setApprovingId(null)
    if (!result.error) setApprovedIds((prev) => new Set(prev).add(categoryId))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">📈 Aprendizaje</h2>
        <p className="text-sm text-gray-500">
          Basado en tu historial real (promedios, no IA compleja). Nunca cambia tu presupuesto
          automáticamente: cada ajuste requiere tu aprobación.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Analizando historial…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : suggestions.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Aún no hay suficiente historial (necesitas al menos 2 meses de presupuesto en una
          categoría) para sugerir ajustes.
        </p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s) => {
            const approved = approvedIds.has(s.categoryId)
            return (
              <li key={s.categoryId} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.categoryName}</p>
                    <p className="mt-1 text-sm text-gray-600">{s.reason}</p>
                    <p className="mt-2 text-sm">
                      <span className="text-gray-500">Presupuesto actual: </span>
                      <span className="font-medium">{formatCurrency(s.currentPlanned)}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span className="text-gray-500">Sugerido: </span>
                      <span className="font-medium text-brand-700">{formatCurrency(s.suggestedPlanned)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApprove(s.categoryId)}
                    disabled={approved || approvingId === s.categoryId}
                    className="shrink-0 whitespace-nowrap rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {approved ? 'Aplicado' : approvingId === s.categoryId ? 'Aplicando…' : 'Aprobar ajuste'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
