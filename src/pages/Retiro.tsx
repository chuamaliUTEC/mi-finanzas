import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useCalculatorMemory } from '@/hooks/useCalculatorMemory'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { projectRetiro, type RetiroInputs } from '@/algorithms/goals/retiro'
import { formatCurrency } from '@/utils/format'
import type { SavingsContribution, SavingsGoal } from '@/types/database'

interface RetiroForm {
  metaId: string
  edadActual: string
  edadObjetivo: string
  capitalActual: string
  aporteMensual: string
  tasaRendimientoAnual: string
  inflacionAnual: string
  ingresoDeseadoMensualRetiro: string
  aniosEsperadosDeRetiro: string
}

const DEFAULTS: RetiroForm = {
  metaId: '',
  edadActual: '25',
  edadObjetivo: '60',
  capitalActual: '',
  aporteMensual: '',
  tasaRendimientoAnual: '6',
  inflacionAnual: '3',
  ingresoDeseadoMensualRetiro: '',
  aniosEsperadosDeRetiro: '25',
}

function toInputs(form: RetiroForm): RetiroInputs {
  return {
    edadActual: Number(form.edadActual) || 0,
    edadObjetivo: Number(form.edadObjetivo) || 0,
    capitalActual: Number(form.capitalActual) || 0,
    aporteMensual: Number(form.aporteMensual) || 0,
    tasaRendimientoAnual: (Number(form.tasaRendimientoAnual) || 0) / 100,
    inflacionAnual: (Number(form.inflacionAnual) || 0) / 100,
    ingresoDeseadoMensualRetiro: form.ingresoDeseadoMensualRetiro === '' ? null : Number(form.ingresoDeseadoMensualRetiro),
    aniosEsperadosDeRetiro: Number(form.aniosEsperadosDeRetiro) || 1,
  }
}

export default function Retiro() {
  const { params, save, loading } = useCalculatorMemory<RetiroForm>('retiro_parametros', DEFAULTS)
  const [form, setForm] = useState<RetiroForm>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const { data: goals } = useSupabaseTable<SavingsGoal>('savings_goals')
  const { data: contributions } = useSupabaseTable<SavingsContribution>('savings_contributions', {
    orderBy: 'contributed_at',
    ascending: false,
  })

  useMemo(() => {
    if (!loading) setForm(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const linkedGoal = goals.find((g) => g.id === form.metaId) ?? null

  useEffect(() => {
    if (linkedGoal) {
      setForm((f) => (f.capitalActual === String(linkedGoal.current_amount) ? f : { ...f, capitalActual: String(linkedGoal.current_amount) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedGoal?.current_amount])

  const suggestedMonthly = useMemo(() => {
    if (!linkedGoal) return null
    const recent = contributions.filter((c) => c.goal_id === linkedGoal.id).slice(0, 3)
    if (recent.length === 0) return null
    return recent.reduce((sum, c) => sum + Number(c.amount), 0) / recent.length
  }, [contributions, linkedGoal])

  const projection = useMemo(() => projectRetiro(toInputs(form)), [form])

  const handleChange = (field: keyof RetiroForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    await save(form)
    setSaving(false)
  }

  const fields: { key: keyof RetiroForm; label: string }[] = [
    { key: 'edadActual', label: 'Edad actual' },
    { key: 'edadObjetivo', label: 'Edad objetivo de retiro' },
    { key: 'capitalActual', label: 'Capital actual destinado a retiro' },
    { key: 'aporteMensual', label: 'Aporte mensual' },
    { key: 'tasaRendimientoAnual', label: 'Rendimiento anual esperado (%)' },
    { key: 'inflacionAnual', label: 'Inflación anual esperada (%)' },
    { key: 'ingresoDeseadoMensualRetiro', label: 'Ingreso mensual deseado en retiro (opcional)' },
    { key: 'aniosEsperadosDeRetiro', label: 'Años esperados de retiro (para el retiro del capital)' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">👵 Retiro 2062</h2>
        <p className="text-sm text-gray-500">
          Horizonte de aprox. 35 años. Los supuestos se guardan como memoria versionada.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-xs font-medium text-gray-600">Vincular con una meta de ahorro real</label>
        <select
          value={form.metaId}
          onChange={(e) => setForm((f) => ({ ...f, metaId: e.target.value }))}
          className="mt-1 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">Sin vincular (ingresar capital actual manualmente)</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {linkedGoal && (
          <p className="mt-2 text-xs text-gray-500">
            "Capital actual" se sincroniza con el saldo real de <strong>{linkedGoal.name}</strong> (
            {formatCurrency(linkedGoal.current_amount)}).
            {suggestedMonthly !== null && (
              <>
                {' '}
                Promedio de tus últimos aportes: {formatCurrency(suggestedMonthly)}/mes.{' '}
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, aporteMensual: String(Math.round(suggestedMonthly * 100) / 100) }))}
                  className="text-brand-600 hover:underline"
                >
                  Usar como aporte mensual
                </button>
              </>
            )}
          </p>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-600">{field.label}</label>
            <input
              type="number"
              step="0.01"
              readOnly={field.key === 'capitalActual' && Boolean(linkedGoal)}
              value={form[field.key]}
              onChange={handleChange(field.key)}
              className={`mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                field.key === 'capitalActual' && linkedGoal ? 'bg-gray-50 text-gray-500' : ''
              }`}
            />
          </div>
        ))}
        <div className="sm:col-span-2 md:col-span-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar supuestos'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Horizonte</p>
          <p className="text-lg font-semibold text-gray-900">{projection.horizonMeses} meses</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Capital proyectado (valor nominal)</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(projection.capitalNominal)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Capital proyectado (valor real, ajustado por inflación)</p>
          <p className="text-lg font-semibold text-brand-700">{formatCurrency(projection.capitalReal)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Ingreso mensual estimado en retiro (valor real)</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(projection.ingresoEstimadoMensualReal)}</p>
        </div>
      </div>

      {projection.brechaMensualReal !== null && (
        <div
          className={`rounded-lg border p-4 ${projection.brechaMensualReal > 0 ? 'border-amber-200 bg-amber-50' : 'border-brand-200 bg-brand-50'}`}
        >
          <p className="text-sm text-gray-700">
            {projection.brechaMensualReal > 0
              ? `Brecha estimada: te faltarían ${formatCurrency(projection.brechaMensualReal)} mensuales (valor real) para el ingreso deseado en retiro.`
              : `Tu proyección cubre el ingreso deseado en retiro, con un margen de ${formatCurrency(Math.abs(projection.brechaMensualReal))} mensuales.`}
          </p>
        </div>
      )}
    </div>
  )
}
