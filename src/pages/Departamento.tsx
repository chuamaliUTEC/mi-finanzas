import { useMemo, useState, type FormEvent } from 'react'
import { useCalculatorMemory } from '@/hooks/useCalculatorMemory'
import { projectDepartamento, type DepartamentoInputs } from '@/algorithms/goals/departamento'
import { formatCurrency } from '@/utils/format'

interface DepartamentoForm {
  precioObjetivo: string
  cuotaInicialPct: string
  gastosCompra: string
  ahorroActual: string
  ahorroMensual: string
  mesesHastaObjetivo: string
  tasaRendimientoAnual: string
  tasaHipotecaAnual: string
  plazoHipotecaMeses: string
}

const DEFAULTS: DepartamentoForm = {
  precioObjetivo: '',
  cuotaInicialPct: '20',
  gastosCompra: '',
  ahorroActual: '',
  ahorroMensual: '',
  mesesHastaObjetivo: '60',
  tasaRendimientoAnual: '5',
  tasaHipotecaAnual: '9',
  plazoHipotecaMeses: '240',
}

function toInputs(form: DepartamentoForm): DepartamentoInputs {
  return {
    precioObjetivo: Number(form.precioObjetivo) || 0,
    cuotaInicialPct: (Number(form.cuotaInicialPct) || 0) / 100,
    gastosCompra: Number(form.gastosCompra) || 0,
    ahorroActual: Number(form.ahorroActual) || 0,
    ahorroMensual: Number(form.ahorroMensual) || 0,
    mesesHastaObjetivo: Number(form.mesesHastaObjetivo) || 1,
    tasaRendimientoAnual: (Number(form.tasaRendimientoAnual) || 0) / 100,
    tasaHipotecaAnual: (Number(form.tasaHipotecaAnual) || 0) / 100,
    plazoHipotecaMeses: Number(form.plazoHipotecaMeses) || 1,
  }
}

export default function Departamento() {
  const { params, save, loading } = useCalculatorMemory<DepartamentoForm>('departamento_parametros', DEFAULTS)
  const [form, setForm] = useState<DepartamentoForm>(DEFAULTS)
  const [saving, setSaving] = useState(false)

  useMemo(() => {
    if (!loading) setForm(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const projection = useMemo(() => projectDepartamento(toInputs(form)), [form])

  const handleChange = (field: keyof DepartamentoForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    await save(form)
    setSaving(false)
  }

  const fields: { key: keyof DepartamentoForm; label: string }[] = [
    { key: 'precioObjetivo', label: 'Precio objetivo del departamento' },
    { key: 'cuotaInicialPct', label: 'Cuota inicial (%)' },
    { key: 'gastosCompra', label: 'Gastos de compra' },
    { key: 'ahorroActual', label: 'Ahorro actual para esto' },
    { key: 'ahorroMensual', label: 'Ahorro mensual' },
    { key: 'mesesHastaObjetivo', label: 'Meses hasta la fecha objetivo' },
    { key: 'tasaRendimientoAnual', label: 'Rendimiento anual esperado del ahorro (%)' },
    { key: 'tasaHipotecaAnual', label: 'Tasa hipotecaria estimada (%)' },
    { key: 'plazoHipotecaMeses', label: 'Plazo de hipoteca (meses)' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">🏠 Departamento</h2>
        <p className="text-sm text-gray-500">
          Objetivo: comprar antes de los 30 años. Ajusta los parámetros — se guardan como memoria
          versionada, así que cada cambio de supuesto queda en tu historial.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 md:grid-cols-3">
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
        <div className="sm:col-span-2 md:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar supuestos'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Cuota inicial objetivo (+ gastos)</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(projection.cuotaInicialObjetivo)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Capital proyectado a la fecha objetivo</p>
          <p className="text-lg font-semibold text-brand-700">{formatCurrency(projection.capitalProyectado)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {projection.scenarios.map((scenario) => (
          <div
            key={scenario.nombre}
            className={`rounded-lg border p-4 ${scenario.factible ? 'border-brand-200 bg-brand-50' : 'border-amber-200 bg-amber-50'}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-800">{scenario.nombre}</p>
              <span className={`text-xs font-medium ${scenario.factible ? 'text-brand-700' : 'text-amber-700'}`}>
                {scenario.factible ? 'Factible' : 'No factible aún'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{scenario.detalle}</p>
            {scenario.cuotaMensualEstimada !== undefined && (
              <p className="mt-1 text-xs text-gray-500">
                Cuota mensual estimada de la hipoteca: {formatCurrency(scenario.cuotaMensualEstimada)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
