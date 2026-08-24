import { useMemo, useState, type FormEvent } from 'react'
import { useCalculatorMemory } from '@/hooks/useCalculatorMemory'
import { projectRetiro, type RetiroInputs } from '@/algorithms/goals/retiro'
import { formatCurrency } from '@/utils/format'

interface RetiroForm {
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

  useMemo(() => {
    if (!loading) setForm(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-600">{field.label}</label>
            <input
              type="number"
              step="0.01"
              value={form[field.key]}
              onChange={handleChange(field.key)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
