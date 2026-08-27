import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useOnboarding } from '@/hooks/useOnboarding'

const SOURCE_TYPES = [
  { value: 'fijo', label: 'Fijo (ej. sueldo)' },
  { value: 'variable', label: 'Variable (ej. honorarios)' },
  { value: 'extraordinario', label: 'Extraordinario (no se repite)' },
  { value: 'destinado_especifico', label: 'Destinado a algo específico (ej. inversión)' },
]

const FREQUENCIES = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'irregular', label: 'Irregular' },
]

export default function Onboarding() {
  const {
    loading,
    incomeSources,
    afpFact,
    insuranceFact,
    steps,
    completedCount,
    totalSteps,
    addIncomeSource,
    saveAfp,
    saveInsurance,
  } = useOnboarding()

  const [incomeName, setIncomeName] = useState('')
  const [incomeType, setIncomeType] = useState('fijo')
  const [incomeFrequency, setIncomeFrequency] = useState('mensual')
  const [incomeEarmark, setIncomeEarmark] = useState('')
  const [savingIncome, setSavingIncome] = useState(false)

  const [afpText, setAfpText] = useState('')
  const [savingAfp, setSavingAfp] = useState(false)

  const [insuranceText, setInsuranceText] = useState('')
  const [savingInsurance, setSavingInsurance] = useState(false)

  const handleAddIncome = async (event: FormEvent) => {
    event.preventDefault()
    setSavingIncome(true)
    const result = await addIncomeSource({
      name: incomeName,
      source_type: incomeType,
      frequency: incomeFrequency,
      earmarked_for: incomeEarmark,
    })
    setSavingIncome(false)
    if (!result.error) {
      setIncomeName('')
      setIncomeEarmark('')
    }
  }

  const handleSaveAfp = async (event: FormEvent) => {
    event.preventDefault()
    setSavingAfp(true)
    await saveAfp(afpText)
    setSavingAfp(false)
    setAfpText('')
  }

  const handleSaveInsurance = async (event: FormEvent) => {
    event.preventDefault()
    setSavingInsurance(true)
    await saveInsurance(insuranceText)
    setSavingInsurance(false)
    setInsuranceText('')
  }

  const isDone = (key: string) => steps.find((s) => s.key === key)?.done ?? false

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">📝 Cuestionario financiero</h2>
        <p className="text-sm text-gray-500">
          Ve completando cada pregunta. Cada respuesta se guarda en el lugar correcto de la
          plataforma — nunca mezclamos ingresos con categorías de gasto.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Progreso</span>
              <span className="text-gray-500">
                {completedCount}/{totalSteps}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${(completedCount / totalSteps) * 100}%` }}
              />
            </div>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              {steps.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span>{s.done ? '✅' : '⬜'}</span>
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          {/* 1. Ingresos */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">
              1. ¿Cuáles son tus fuentes de ingreso reales? {isDone('ingresos') && '✅'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Usa el nombre real, como lo conoces tú: "Sueldo Solgas", "Recibo por Honorarios",
              "Mesada papá". Esto NO es una categoría de gasto — es de dónde te entra la plata.
            </p>
            {incomeSources.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-gray-600">
                {incomeSources.map((s) => (
                  <li key={s.id}>
                    • {s.name} <span className="text-xs text-gray-400">({s.source_type})</span>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={handleAddIncome} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                required
                placeholder="ej. Sueldo Solgas"
                value={incomeName}
                onChange={(e) => setIncomeName(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <select
                value={incomeType}
                onChange={(e) => setIncomeType(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                value={incomeFrequency}
                onChange={(e) => setIncomeFrequency(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="¿Destinado a algo? (opcional, ej. inversión)"
                value={incomeEarmark}
                onChange={(e) => setIncomeEarmark(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={savingIncome}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 sm:col-span-2"
              >
                {savingIncome ? 'Guardando…' : '+ Agregar fuente de ingreso'}
              </button>
            </form>
          </div>

          {/* 2. Gastos fijos */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">
              2. ¿Cuáles son tus gastos fijos este mes? {isDone('gastos') && '✅'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Alquiler, servicios, comida, gatos, transporte — cada uno con su categoría. Esto sí
              va en Gastos, con la categoría que corresponda (Mascotas, Vivienda, etc.).
            </p>
            <Link
              to="/gastos"
              className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Ir a registrar gastos →
            </Link>
          </div>

          {/* 3. AFP */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">
              3. ¿En qué AFP y fondo estás? {isDone('afp') && '✅'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Nombre de tu AFP, tipo de fondo (0/1/2/3) y cuánto te descuentan al mes, si lo sabes.
            </p>
            {afpFact && <p className="mt-2 rounded-md bg-gray-50 p-2 text-sm text-gray-600">{afpFact}</p>}
            <form onSubmit={handleSaveAfp} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                required
                placeholder="ej. AFP Habitat, fondo 2, descuento ~13%"
                value={afpText}
                onChange={(e) => setAfpText(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={savingAfp}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {savingAfp ? 'Guardando…' : 'Guardar'}
              </button>
            </form>
          </div>

          {/* 4. Seguros */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">
              4. ¿Qué seguros tienes? {isDone('seguros') && '✅'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">Salud (EPS/SIS), vida, u otros. Si no tienes ninguno, escribe "ninguno".</p>
            {insuranceFact && <p className="mt-2 rounded-md bg-gray-50 p-2 text-sm text-gray-600">{insuranceFact}</p>}
            <form onSubmit={handleSaveInsurance} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                required
                placeholder="ej. EPS Rímac, sin seguro de vida"
                value={insuranceText}
                onChange={(e) => setInsuranceText(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={savingInsurance}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {savingInsurance ? 'Guardando…' : 'Guardar'}
              </button>
            </form>
          </div>

          {/* 5. Fondo de emergencia */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">
              5. Fondo de emergencia {isDone('emergencia') && '✅'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Crea una meta llamada "Fondo de emergencia" — recomendado: 6 meses de tus gastos
              esenciales, por vivir sola y tener ingreso variable.
            </p>
            <Link
              to="/metas"
              className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Ir a Metas →
            </Link>
          </div>

          {/* 6. Deudas */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">6. Deudas {isDone('deudas') && '✅'}</h3>
            <Link
              to="/deudas"
              className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Ir a Deudas →
            </Link>
          </div>

          {/* 7. Tarjetas */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-medium text-gray-800">7. Tarjetas {isDone('tarjetas') && '✅'}</h3>
            <Link
              to="/tarjetas"
              className="mt-3 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Ir a Tarjetas →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
