import { useState } from 'react'
import { useTable } from '@/hooks/useTable'
import { SEVERITY_ICON } from '@/algorithms/rules/engine'
import { PageHeader } from '@/components/ui/PageHeader'

// MIS REGLAS (secc. 24) y planes SI X → ENTONCES Y (secc. 25).

export function Reglas() {
  const rules = useTable('financial_rules', { orderBy: 'sort_order', ascending: true })
  const plans = useTable('if_then_plans', { orderBy: 'sort_order', ascending: true })
  const [newRule, setNewRule] = useState('')
  const [newPlan, setNewPlan] = useState({ trigger: '', steps: '' })

  const automatic = rules.rows.filter((r) => !r.is_manual)
  const manual = rules.rows.filter((r) => r.is_manual)

  async function addRule() {
    if (!newRule.trim()) return
    await rules.insert({
      name: newRule.trim(),
      condition_type: 'manual',
      condition_params: {},
      severity: 'info',
      message_template: newRule.trim(),
      is_manual: true,
      is_system: false,
      sort_order: 100,
    })
    setNewRule('')
  }

  async function addPlan() {
    const steps = newPlan.steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!newPlan.trigger.trim() || steps.length === 0) return
    await plans.insert({ trigger_text: newPlan.trigger.trim(), steps, sort_order: 100 })
    setNewPlan({ trigger: '', steps: '' })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Mis reglas" subtitle="Las decisiones que ya tomaste, por escrito." />

      {/* Reglas personales declarativas */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Mis reglas personales
        </h2>
        {manual.map((rule) => (
          <div key={rule.id} className="card flex items-center justify-between gap-3 !p-4">
            <p className={`text-sm ${rule.enabled ? 'text-ink-800' : 'text-ink-400 line-through'}`}>
              {rule.name}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <button
                className="text-sm text-lavender-700"
                onClick={() => void rules.update(rule.id, { enabled: !rule.enabled })}
              >
                {rule.enabled ? 'Desactivar' : 'Activar'}
              </button>
              {!rule.is_system && (
                <button className="text-sm text-critical" onClick={() => void rules.remove(rule.id)}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="card flex items-end gap-3 !p-4">
          <div className="flex-1">
            <label className="label">Nueva regla</label>
            <input
              className="input"
              placeholder="Ej.: No comprar nada mayor a S/ 200 sin pensarlo 24 horas"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addRule()}
            />
          </div>
          <button className="btn-primary" onClick={() => void addRule()}>
            Agregar
          </button>
        </div>
      </section>

      {/* Reglas automáticas del motor */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Reglas que vigilamos por ti
        </h2>
        <p className="text-sm text-ink-500">
          Estas reglas se evalúan solas con tus datos y generan las alertas del centro de
          decisiones. Puedes desactivar la que no te sirva.
        </p>
        {automatic.map((rule) => (
          <div key={rule.id} className="card !p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`text-sm font-medium ${
                    rule.enabled ? 'text-ink-900' : 'text-ink-400 line-through'
                  }`}
                >
                  {SEVERITY_ICON[rule.severity]} {rule.name}
                </p>
                {rule.description && (
                  <p className="mt-0.5 text-xs text-ink-500">{rule.description}</p>
                )}
              </div>
              <button
                className="shrink-0 text-sm text-lavender-700"
                onClick={() => void rules.update(rule.id, { enabled: !rule.enabled })}
              >
                {rule.enabled ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Planes SI → ENTONCES */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Planes “SI… → ENTONCES…”
        </h2>
        {plans.rows.map((plan) => (
          <div key={plan.id} className="card !p-4">
            <div className="flex items-start justify-between gap-3">
              <p
                className={`text-sm font-medium ${
                  plan.enabled ? 'text-ink-900' : 'text-ink-400 line-through'
                }`}
              >
                {plan.trigger_text}
              </p>
              <div className="flex shrink-0 gap-3">
                <button
                  className="text-sm text-lavender-700"
                  onClick={() => void plans.update(plan.id, { enabled: !plan.enabled })}
                >
                  {plan.enabled ? 'Desactivar' : 'Activar'}
                </button>
                <button className="text-sm text-critical" onClick={() => void plans.remove(plan.id)}>
                  Eliminar
                </button>
              </div>
            </div>
            <ol className="mt-2 space-y-1 text-sm text-ink-600">
              {plan.steps.map((step, i) => (
                <li key={i}>
                  {i + 1}. {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
        <div className="card space-y-3 !p-4">
          <div>
            <label className="label">SI…</label>
            <input
              className="input"
              placeholder="Ej.: SI recibo un ingreso extraordinario"
              value={newPlan.trigger}
              onChange={(e) => setNewPlan({ ...newPlan, trigger: e.target.value })}
            />
          </div>
          <div>
            <label className="label">ENTONCES… (un paso por línea)</label>
            <textarea
              className="input min-h-24"
              placeholder={'Registrar el ingreso\nSeparar obligaciones\nAsignar a deuda'}
              value={newPlan.steps}
              onChange={(e) => setNewPlan({ ...newPlan, steps: e.target.value })}
            />
          </div>
          <button className="btn-primary" onClick={() => void addPlan()}>
            Crear plan
          </button>
        </div>
      </section>
    </div>
  )
}
