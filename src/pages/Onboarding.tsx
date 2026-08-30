import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// Onboarding (secc. 41). Los pasos escriben directo en la base de datos;
// deudas, tarjetas, gastos recurrentes y metas se registran en sus propios
// módulos, hacia los que se orienta al final.

interface ExtraIncome {
  name: string
  amount: string
  reliability: 'alta' | 'media' | 'baja'
}

interface InitialAccount {
  name: string
  type: string
  balance: string
}

const PRIORITIES = [
  'Salir de deudas',
  'Construir fondo de emergencia',
  'Ahorrar para una meta',
  'Ordenar mis gastos',
  'Invertir',
]

export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [fullName, setFullName] = useState('')
  const [employer, setEmployer] = useState('')
  const [salary, setSalary] = useState('')
  const [salaryDay, setSalaryDay] = useState('')
  const [extras, setExtras] = useState<ExtraIncome[]>([])
  const [accountsDraft, setAccountsDraft] = useState<InitialAccount[]>([
    { name: 'Efectivo', type: 'efectivo', balance: '' },
  ])
  const [priority, setPriority] = useState('')

  if (!user) return <Navigate to="/ingresar" replace />
  if (profile?.onboarding_completed_at) return <Navigate to="/" replace />

  async function finish() {
    if (!user) return
    setSaving(true)

    await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        employer: employer || null,
        financial_priority: priority || null,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (parseFloat(salary) > 0) {
      await supabase.from('income_sources').insert({
        user_id: user.id,
        name: employer ? `Sueldo ${employer}` : 'Sueldo',
        kind: 'fijo',
        recurrence: 'mensual',
        expected_amount: parseFloat(salary),
        reliability: 'alta',
        is_verified: false,
        expected_day: salaryDay ? parseInt(salaryDay, 10) : null,
        notes: 'Pendiente de verificar con boleta.',
      })
    }

    const validExtras = extras.filter((e) => e.name && parseFloat(e.amount) > 0)
    if (validExtras.length > 0) {
      await supabase.from('income_sources').insert(
        validExtras.map((e) => ({
          user_id: user.id,
          name: e.name,
          kind: 'variable',
          recurrence: 'mensual',
          expected_amount: parseFloat(e.amount),
          reliability: e.reliability,
          is_verified: false,
        })),
      )
    }

    const validAccounts = accountsDraft.filter((a) => a.name)
    if (validAccounts.length > 0) {
      await supabase.from('accounts').insert(
        validAccounts.map((a) => ({
          user_id: user.id,
          name: a.name,
          type: a.type,
          initial_balance: parseFloat(a.balance) || 0,
        })),
      )
    }

    await refreshProfile()
    setSaving(false)
    navigate('/')
  }

  const steps = [
    // Paso 1: ¿Quién eres?
    <div key="who" className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-900">¿Quién eres?</h2>
      <div>
        <label className="label">Tu nombre</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <label className="label">¿Dónde trabajas? (opcional)</label>
        <input className="input" value={employer} onChange={(e) => setEmployer(e.target.value)} />
      </div>
    </div>,

    // Paso 2: ¿Cuánto ganas?
    <div key="salary" className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-900">¿Cuánto ganas?</h2>
      <div>
        <label className="label">Sueldo neto mensual (S/)</label>
        <input
          className="input"
          type="number"
          step="0.01"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
        />
      </div>
      <div>
        <label className="label">¿Qué día del mes suele llegar? (opcional)</label>
        <input
          className="input"
          type="number"
          min={1}
          max={31}
          value={salaryDay}
          onChange={(e) => setSalaryDay(e.target.value)}
        />
      </div>
      <p className="text-xs text-ink-400">
        Se registrará como pendiente de verificar hasta que confirmes tu boleta.
      </p>
    </div>,

    // Paso 3: ingresos adicionales
    <div key="extras" className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-900">¿Tienes ingresos adicionales?</h2>
      {extras.map((extra, i) => (
        <div key={i} className="grid grid-cols-[1fr_100px_110px] gap-2">
          <input
            className="input"
            placeholder="Nombre (ej. trabajos parciales)"
            value={extra.name}
            onChange={(e) =>
              setExtras(extras.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
            }
          />
          <input
            className="input"
            type="number"
            placeholder="S/ mes"
            value={extra.amount}
            onChange={(e) =>
              setExtras(extras.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))
            }
          />
          <select
            className="input"
            value={extra.reliability}
            onChange={(e) =>
              setExtras(
                extras.map((x, j) =>
                  j === i ? { ...x, reliability: e.target.value as ExtraIncome['reliability'] } : x,
                ),
              )
            }
          >
            <option value="alta">Confiable</option>
            <option value="media">Variable</option>
            <option value="baja">Incierto</option>
          </select>
        </div>
      ))}
      <button
        className="btn-secondary"
        onClick={() => setExtras([...extras, { name: '', amount: '', reliability: 'media' }])}
      >
        + Agregar ingreso
      </button>
    </div>,

    // Paso 4: ¿Cuánto dinero tienes?
    <div key="money" className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-900">¿Cuánto dinero tienes ahora?</h2>
      {accountsDraft.map((acc, i) => (
        <div key={i} className="grid grid-cols-[1fr_130px_100px] gap-2">
          <input
            className="input"
            placeholder="Nombre de la cuenta"
            value={acc.name}
            onChange={(e) =>
              setAccountsDraft(
                accountsDraft.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
              )
            }
          />
          <select
            className="input"
            value={acc.type}
            onChange={(e) =>
              setAccountsDraft(
                accountsDraft.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)),
              )
            }
          >
            <option value="sueldo">Cuenta sueldo</option>
            <option value="bancaria">Banco</option>
            <option value="ahorro">Ahorro</option>
            <option value="efectivo">Efectivo</option>
            <option value="yape">Yape</option>
            <option value="plin">Plin</option>
            <option value="inversion">Inversión</option>
          </select>
          <input
            className="input"
            type="number"
            placeholder="Saldo"
            value={acc.balance}
            onChange={(e) =>
              setAccountsDraft(
                accountsDraft.map((x, j) => (j === i ? { ...x, balance: e.target.value } : x)),
              )
            }
          />
        </div>
      ))}
      <button
        className="btn-secondary"
        onClick={() =>
          setAccountsDraft([...accountsDraft, { name: '', type: 'bancaria', balance: '' }])
        }
      >
        + Agregar cuenta
      </button>
    </div>,

    // Paso 5: prioridad financiera
    <div key="priority" className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-900">¿Cuál es tu prioridad financiera hoy?</h2>
      <div className="space-y-2">
        {PRIORITIES.map((p) => (
          <label
            key={p}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              priority === p
                ? 'border-lavender-500 bg-lavender-50 text-lavender-800'
                : 'border-ink-200 bg-white text-ink-700'
            }`}
          >
            <input
              type="radio"
              className="hidden"
              checked={priority === p}
              onChange={() => setPriority(p)}
            />
            {p}
          </label>
        ))}
      </div>
      <p className="text-xs text-ink-400">
        Tus deudas, tarjetas, gastos recurrentes y metas se registran en sus módulos: te guiaremos
        al terminar.
      </p>
    </div>,
  ]

  const isLast = step === steps.length - 1

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="card w-full max-w-lg">
        <p className="mb-4 text-xs font-medium text-lavender-600">
          Paso {step + 1} de {steps.length}
        </p>
        {steps[step]}
        <div className="mt-6 flex justify-between">
          <button
            className="btn-secondary"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || saving}
          >
            Atrás
          </button>
          {isLast ? (
            <button className="btn-primary" onClick={() => void finish()} disabled={saving}>
              {saving ? 'Construyendo tu mapa financiero…' : 'Terminar'}
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
