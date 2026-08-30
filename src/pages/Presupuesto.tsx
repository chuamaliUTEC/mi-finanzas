import { useMemo, useState } from 'react'
import { useTable } from '@/hooks/useTable'
import {
  computeBudgetStatus,
  detectRecurringCandidates,
  recurringMonthlyTotal,
} from '@/algorithms/budget/budget'
import { PageHeader } from '@/components/ui/PageHeader'
import { formatCurrency } from '@/utils/format'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function Presupuesto() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [newRecurring, setNewRecurring] = useState({ name: '', amount: '', due_day: '' })

  const budgets = useTable('monthly_budgets')
  const budgetCategories = useTable('budget_categories', { softDelete: false })
  const categories = useTable('expense_categories', { orderBy: 'sort_order', ascending: true })
  const expenses = useTable('expenses')
  const recurring = useTable('recurring_expenses')

  const budget = budgets.rows.find((b) => b.year === year && b.month === month) ?? null
  const rowsForBudget = useMemo(
    () => (budget ? budgetCategories.rows.filter((bc) => bc.budget_id === budget.id) : []),
    [budget, budgetCategories.rows],
  )

  const statuses = useMemo(
    () => computeBudgetStatus(rowsForBudget, expenses.rows, year, month, new Date()),
    [rowsForBudget, expenses.rows, year, month],
  )

  const candidates = useMemo(
    () => detectRecurringCandidates(expenses.rows, recurring.rows),
    [expenses.rows, recurring.rows],
  )

  const recurringTotal = recurringMonthlyTotal(recurring.rows)
  const totalPlanned = rowsForBudget.reduce((s, r) => s + r.planned_amount, 0)
  const totalSpent = statuses.reduce((s, r) => s + r.spent, 0)

  async function createBudget() {
    await budgets.insert({ year, month })
  }

  async function savePlanned(categoryId: string) {
    if (!budget) return
    const value = parseFloat(drafts[categoryId] ?? '')
    if (Number.isNaN(value) || value < 0) return
    const existing = rowsForBudget.find((bc) => bc.category_id === categoryId)
    if (existing) await budgetCategories.update(existing.id, { planned_amount: value })
    else await budgetCategories.insert({ budget_id: budget.id, category_id: categoryId, planned_amount: value })
    setDrafts((d) => ({ ...d, [categoryId]: '' }))
  }

  async function addRecurring() {
    const amount = parseFloat(newRecurring.amount)
    if (!newRecurring.name || !(amount > 0)) return
    await recurring.insert({
      name: newRecurring.name,
      amount,
      due_day: newRecurring.due_day ? parseInt(newRecurring.due_day, 10) : null,
    })
    setNewRecurring({ name: '', amount: '', due_day: '' })
  }

  async function acceptCandidate(label: string, amount: number) {
    await recurring.insert({ name: label, amount })
  }

  const categoryName = (id: string) => {
    const cat = categories.rows.find((c) => c.id === id)
    return cat ? `${cat.icon ?? ''} ${cat.name}`.trim() : '—'
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Presupuesto" subtitle="Planificado vs. real vs. proyección al cierre." />

      <div className="flex items-center gap-2">
        <select
          className="input w-auto"
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10))}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
        >
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {!budget && !budgets.loading && (
        <div className="card text-center">
          <p className="text-sm text-ink-500">
            Aún no hay presupuesto para {MONTH_NAMES[month - 1]} {year}.
          </p>
          <button className="btn-primary mt-4" onClick={() => void createBudget()}>
            Crear presupuesto
          </button>
        </div>
      )}

      {budget && (
        <>
          <div className="card">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-ink-500">📊 Gastado vs. planificado</p>
              <p className="text-lg font-semibold text-ink-900">
                {formatCurrency(totalSpent)}{' '}
                <span className="text-sm font-normal text-ink-500">
                  de {formatCurrency(totalPlanned)}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {categories.rows.map((cat) => {
              const bc = rowsForBudget.find((r) => r.category_id === cat.id)
              const st = statuses.find((s) => s.categoryId === cat.id)
              const ratio = bc && bc.planned_amount > 0 ? (st?.spent ?? 0) / bc.planned_amount : 0
              const barTone =
                st?.status === 'excedido'
                  ? 'bg-critical'
                  : st?.status === 'camino_a_exceder'
                    ? 'bg-warning'
                    : 'bg-positive'
              return (
                <div key={cat.id} className="card space-y-2 !p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-900">
                      {cat.icon} {cat.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        className="input w-28 !py-1.5 text-right"
                        type="number"
                        placeholder={bc ? String(bc.planned_amount) : '0'}
                        value={drafts[cat.id] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [cat.id]: e.target.value }))}
                      />
                      <button
                        className="text-sm text-lavender-700"
                        onClick={() => void savePlanned(cat.id)}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                  {bc && bc.planned_amount > 0 && st && (
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                        <div
                          className={`h-full rounded-full ${barTone}`}
                          style={{ width: `${Math.min(100, ratio * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-ink-500">
                        {formatCurrency(st.spent)} de {formatCurrency(st.planned)} · proyección al
                        cierre: {formatCurrency(st.projected)}
                        {st.status === 'camino_a_exceder' && (
                          <span className="ml-1 text-warning">
                            ⚠️ vas camino a exceder tu presupuesto
                          </span>
                        )}
                        {st.status === 'excedido' && (
                          <span className="ml-1 text-critical">🔴 presupuesto excedido</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Gastos recurrentes */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Gastos recurrentes
          </h2>
          <p className="text-sm text-ink-500">
            Total mensual: <strong className="text-ink-900">{formatCurrency(recurringTotal)}</strong>
          </p>
        </div>

        {candidates.length > 0 && (
          <div className="rounded-xl border border-lavender-200 bg-lavender-50 p-4 text-sm">
            <p className="font-medium text-ink-900">Detectamos gastos que se repiten:</p>
            {candidates.map((c) => (
              <div key={c.key} className="mt-2 flex items-center justify-between gap-3">
                <span className="text-ink-700">
                  “{c.label}” aparece en {c.months} meses (~{formatCurrency(c.averageAmount)}).
                  ¿Convertirlo en gasto recurrente?
                </span>
                <button
                  className="btn-secondary !py-1.5"
                  onClick={() => void acceptCandidate(c.label, c.averageAmount)}
                >
                  Sí
                </button>
              </div>
            ))}
          </div>
        )}

        {recurring.rows.map((r) => (
          <div key={r.id} className="card flex items-center justify-between !p-4">
            <div>
              <p className="text-sm font-medium text-ink-900">
                {r.name}
                {r.needs_verification && (
                  <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
                    ⚠️ verificar
                  </span>
                )}
                {!r.is_active && (
                  <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">
                    pausado
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-500">
                {r.category_id ? categoryName(r.category_id) : 'Sin categoría'} ·{' '}
                {r.due_day ? `se cobra el ${r.due_day}` : 'fecha de cobro por confirmar'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-semibold text-ink-900">{formatCurrency(r.amount)}</p>
              <button
                className="text-sm text-lavender-700"
                onClick={() => void recurring.update(r.id, { is_active: !r.is_active })}
              >
                {r.is_active ? 'Pausar' : 'Activar'}
              </button>
              <button className="text-sm text-critical" onClick={() => void recurring.remove(r.id)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <div className="card flex flex-wrap items-end gap-3 !p-4">
          <div className="flex-1">
            <label className="label">Nombre</label>
            <input
              className="input"
              value={newRecurring.name}
              onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Monto (S/)</label>
            <input
              className="input w-28"
              type="number"
              step="0.01"
              value={newRecurring.amount}
              onChange={(e) => setNewRecurring({ ...newRecurring, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Día (opcional)</label>
            <input
              className="input w-24"
              type="number"
              min={1}
              max={31}
              value={newRecurring.due_day}
              onChange={(e) => setNewRecurring({ ...newRecurring, due_day: e.target.value })}
            />
          </div>
          <button className="btn-primary" onClick={() => void addRecurring()}>
            Agregar
          </button>
        </div>
      </section>
    </div>
  )
}
