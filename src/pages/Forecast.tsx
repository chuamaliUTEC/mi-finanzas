import { useState } from 'react'
import { useForecast } from '@/hooks/useForecast'
import { calculateForecastError } from '@/algorithms/forecasting'
import { formatCurrency, formatDate } from '@/utils/format'

export default function ForecastPage() {
  const { loading, error, twelveMonthProjection, forecasts, actuals, saveNextMonthForecast, confirmActualForForecast } =
    useForecast()
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    await saveNextMonthForecast()
    setSaving(false)
  }

  const handleConfirm = async (forecast: (typeof forecasts)[number]) => {
    setConfirmingId(forecast.id)
    await confirmActualForForecast(forecast)
    setConfirmingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">🔮 Forecast</h2>
          <p className="text-sm text-gray-500">
            Proyección basada en el promedio móvil de tu historial. Sin IA compleja: solo tendencias
            reales, comparadas después contra lo que realmente pasó.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar forecast del próximo mes'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Proyección a 12 meses</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="py-1 pr-4">Mes</th>
                    <th className="py-1 pr-4">Ingreso proyectado</th>
                    <th className="py-1 pr-4">Gasto proyectado</th>
                    <th className="py-1">Balance proyectado</th>
                  </tr>
                </thead>
                <tbody>
                  {twelveMonthProjection.map((m) => (
                    <tr key={m.monthOffset} className="border-t border-gray-100">
                      <td className="py-1 pr-4 text-gray-600">+{m.monthOffset} mes</td>
                      <td className="py-1 pr-4 text-brand-600">{formatCurrency(m.projectedIncome)}</td>
                      <td className="py-1 pr-4 text-red-600">{formatCurrency(m.projectedExpenses)}</td>
                      <td className={`py-1 ${m.projectedBalance >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                        {formatCurrency(m.projectedBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Forecast vs. real</h3>
            {forecasts.length === 0 ? (
              <p className="text-sm text-gray-500">Aún no guardaste ningún forecast.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {forecasts.map((f) => {
                  const actual = actuals.find((a) => a.forecast_id === f.id)
                  const incomeError = actual ? calculateForecastError(f.projected_income, actual.actual_income) : null
                  const expenseError = actual
                    ? calculateForecastError(f.projected_expenses, actual.actual_expenses)
                    : null
                  return (
                    <li key={f.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{formatDate(f.forecast_date)}</span>
                        {!actual && (
                          <button
                            type="button"
                            onClick={() => handleConfirm(f)}
                            disabled={confirmingId === f.id}
                            className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                          >
                            {confirmingId === f.id ? 'Registrando…' : 'Registrar lo real de ese mes'}
                          </button>
                        )}
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
                        <span>Ingreso proyectado: {formatCurrency(f.projected_income)}</span>
                        <span>Gasto proyectado: {formatCurrency(f.projected_expenses)}</span>
                        {actual && (
                          <>
                            <span>Ingreso real: {formatCurrency(actual.actual_income)}</span>
                            <span>Gasto real: {formatCurrency(actual.actual_expenses)}</span>
                          </>
                        )}
                      </div>
                      {incomeError && expenseError && (
                        <p className="mt-1 text-xs text-gray-400">
                          Error ingreso: {formatCurrency(incomeError.absoluteError)}
                          {incomeError.percentError !== null && ` (${incomeError.percentError.toFixed(1)}%)`} · Error
                          gasto: {formatCurrency(expenseError.absoluteError)}
                          {expenseError.percentError !== null && ` (${expenseError.percentError.toFixed(1)}%)`}
                        </p>
                      )}
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
