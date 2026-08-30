import { useMemo, useState } from 'react'
import { useTable } from '@/hooks/useTable'
import { monthlyExpectedIncome } from '@/algorithms/spendable/spendable'
import { isInMonth } from '@/algorithms/budget/budget'
import { PageHeader } from '@/components/ui/PageHeader'
import { VerificationBadge } from '@/components/ui/VerificationBadge'
import { formatCurrency, formatDate } from '@/utils/format'
import type { VerificationStatus } from '@/types/database'

// INGRESOS: separa con claridad lo que ya entró de lo que se espera, se
// estima o está sin verificar. Un ingreso no verificado nunca engorda la
// cifra de "dinero disponible".

const RECURRENCE_LABEL: Record<string, string> = {
  mensual: 'al mes',
  quincenal: 'cada quincena',
  semanal: 'por semana',
  eventual: 'eventual',
}

export function Ingresos() {
  const sources = useTable('income_sources')
  const incomes = useTable('income_transactions', { orderBy: 'date' })
  const extraordinary = useTable('extraordinary_incomes')
  const allocations = useTable('extraordinary_income_allocations', { softDelete: false })
  const debts = useTable('debts')
  const [showForm, setShowForm] = useState(false)
  const [nuevo, setNuevo] = useState({
    name: '', amount: '', recurrence: 'mensual',
    verification_status: 'confirmado' as VerificationStatus,
  })

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const expectedMonthly = useMemo(
    () => sources.rows.reduce((sum, s) => sum + monthlyExpectedIncome(s), 0),
    [sources.rows],
  )

  // Solo lo REALIZADO cuenta como dinero que de verdad entró.
  const realThisMonth = useMemo(
    () =>
      incomes.rows
        .filter(
          (i) => i.deleted_at === null && i.status === 'realizado' && isInMonth(i.date, year, month),
        )
        .reduce((sum, i) => sum + i.amount, 0),
    [incomes.rows, year, month],
  )

  const verifiableIncome = useMemo(
    () =>
      sources.rows
        .filter((s) => s.deleted_at === null && s.verification_status === 'confirmado' && s.is_verified)
        .reduce((sum, s) => sum + monthlyExpectedIncome(s), 0),
    [sources.rows],
  )

  const debtName = (id: string | null) => {
    if (!id) return null
    const debt = debts.rows.find((d) => d.id === id)
    return debt ? (debt.name ?? debt.creditor) : null
  }

  async function addSource() {
    const amount = parseFloat(nuevo.amount)
    if (!nuevo.name || !(amount > 0)) return
    await sources.insert({
      name: nuevo.name,
      kind: 'variable',
      recurrence: nuevo.recurrence as 'mensual' | 'quincenal' | 'semanal' | 'eventual',
      expected_amount: amount,
      verification_status: nuevo.verification_status,
      is_verified: nuevo.verification_status === 'confirmado',
    })
    setNuevo({ name: '', amount: '', recurrence: 'mensual', verification_status: 'confirmado' })
    setShowForm(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Ingresos"
        subtitle="¿Cuánto entra, cuánto es seguro y cuánto está por confirmarse?"
        action={
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            + Fuente
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-sm font-medium text-ink-500">💰 Recibido este mes</p>
          <p className="mt-1 text-3xl font-semibold text-ink-900">
            {formatCurrency(realThisMonth)}
          </p>
          <p className="mt-1 text-xs text-ink-400">Solo lo que ya entró de verdad.</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-ink-500">📅 Esperado al mes</p>
          <p className="mt-1 text-3xl font-semibold text-ink-600">
            {formatCurrency(expectedMonthly)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Proyección con todas tus fuentes. No es dinero disponible.
          </p>
        </div>
      </div>

      {verifiableIncome > 0 && verifiableIncome < expectedMonthly && (
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          <strong className="text-ink-900">
            Ingreso verificable ante un banco: {formatCurrency(verifiableIncome)}.
          </strong>{' '}
          El resto de tus fuentes no sustenta una evaluación crediticia, aunque sí tu flujo diario.
        </div>
      )}

      {showForm && (
        <div className="card flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <label className="label">Nombre</label>
            <input
              className="input"
              value={nuevo.name}
              onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Monto (S/)</label>
            <input
              className="input w-28"
              type="number"
              step="0.01"
              value={nuevo.amount}
              onChange={(e) => setNuevo({ ...nuevo, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Frecuencia</label>
            <select
              className="input"
              value={nuevo.recurrence}
              onChange={(e) => setNuevo({ ...nuevo, recurrence: e.target.value })}
            >
              <option value="mensual">Mensual</option>
              <option value="quincenal">Quincenal</option>
              <option value="semanal">Semanal</option>
              <option value="eventual">Eventual</option>
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select
              className="input"
              value={nuevo.verification_status}
              onChange={(e) =>
                setNuevo({ ...nuevo, verification_status: e.target.value as VerificationStatus })
              }
            >
              <option value="confirmado">🟢 Confirmado</option>
              <option value="estimado">🟡 Estimado</option>
              <option value="pendiente">🔴 Pendiente</option>
              <option value="no_verificado">⚪ No verificado</option>
            </select>
          </div>
          <button className="btn-primary" onClick={() => void addSource()}>
            Agregar
          </button>
        </div>
      )}

      {/* Fuentes de ingreso */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Mis fuentes de ingreso
        </h2>
        {sources.rows.map((source) => (
          <div key={source.id} className="card space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-ink-900">
                {source.name}{' '}
                <VerificationBadge
                  status={source.verification_status}
                  title={source.verification_note ?? undefined}
                />
              </p>
              <p className="text-lg font-semibold text-ink-900">
                {source.expected_amount !== null
                  ? `${formatCurrency(source.expected_amount)} ${RECURRENCE_LABEL[source.recurrence] ?? ''}`
                  : 'Monto sin definir'}
              </p>
            </div>
            <p className="text-xs text-ink-500">
              Confiabilidad {source.reliability}
              {source.recurrence !== 'mensual' && source.expected_amount
                ? ` · equivale a ${formatCurrency(monthlyExpectedIncome(source))} al mes`
                : ''}
              {source.expected_day ? ` · suele llegar el ${source.expected_day}` : ''}
            </p>
            {source.verification_note && (
              <p className="text-xs text-warning">{source.verification_note}</p>
            )}
            {source.notes && <p className="text-xs text-ink-400">{source.notes}</p>}
            <div className="flex gap-3 pt-1 text-sm">
              {source.verification_status !== 'confirmado' && (
                <button
                  className="text-lavender-700"
                  onClick={() =>
                    void sources.update(source.id, {
                      verification_status: 'confirmado',
                      is_verified: true,
                      verification_note: null,
                    })
                  }
                >
                  Marcar como confirmado
                </button>
              )}
              <button className="text-critical" onClick={() => void sources.remove(source.id)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {sources.rows.length === 0 && !sources.loading && (
          <p className="text-sm text-ink-500">Aún no registras fuentes de ingreso.</p>
        )}
      </section>

      {/* Extraordinarios en cola */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Extraordinarios en cola
        </h2>
        <p className="text-sm text-ink-500">
          Dinero que llegará una sola vez. Se asigna antes de recibirse, para que no se sienta
          como dinero libre.
        </p>
        {extraordinary.rows
          .filter((x) => x.status === 'esperado')
          .map((extra) => {
            const alloc = allocations.rows.filter((a) => a.extraordinary_income_id === extra.id)
            const assigned = alloc.reduce((sum, a) => sum + a.percent, 0)
            return (
              <div key={extra.id} className="card space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-ink-900">
                    {extra.name} <VerificationBadge status={extra.verification_status} />
                  </p>
                  <p className="text-lg font-semibold text-ink-600">
                    {formatCurrency(extra.expected_amount)}
                  </p>
                </div>
                <p className="text-xs text-ink-500">
                  {extra.expected_date ? `Esperado: ${formatDate(extra.expected_date)}` : 'Sin fecha'}
                  {assigned >= 100
                    ? ` · destino asignado${
                        alloc[0]?.target_id && debtName(alloc[0].target_id)
                          ? `: ${debtName(alloc[0].target_id)}`
                          : ''
                      }`
                    : ' · ⚠️ sin destino asignado'}
                </p>
                {extra.notes && <p className="text-xs text-ink-400">{extra.notes}</p>}
              </div>
            )
          })}
        {extraordinary.rows.filter((x) => x.status === 'esperado').length === 0 &&
          !extraordinary.loading && (
            <p className="text-sm text-ink-500">Nada extraordinario en cola.</p>
          )}
      </section>

      {/* Movimientos registrados */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Ingresos registrados
        </h2>
        {incomes.rows.slice(0, 15).map((income) => (
          <div key={income.id} className="card flex items-center justify-between gap-3 !p-4">
            <div>
              <p className="text-sm font-medium text-ink-900">
                {income.description ??
                  sources.rows.find((s) => s.id === income.source_id)?.name ??
                  'Ingreso'}
              </p>
              <p className="text-xs text-ink-500">
                {formatDate(income.date)} ·{' '}
                {income.status === 'realizado' ? '🟢 recibido' : `⏳ ${income.status}`}
              </p>
            </div>
            <p
              className={`font-semibold ${
                income.status === 'realizado' ? 'text-positive' : 'text-ink-400'
              }`}
            >
              {formatCurrency(income.amount)}
            </p>
          </div>
        ))}
        {incomes.rows.length === 0 && !incomes.loading && (
          <p className="text-sm text-ink-500">
            Todavía no registras ningún ingreso recibido. Cuando llegue tu sueldo, regístralo desde
            “Registrar” para que tu dinero disponible se actualice.
          </p>
        )}
      </section>
    </div>
  )
}
