import { useMemo, useState } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { useEnvelopes } from '@/hooks/useEnvelopes'
import { runFullAudit, type AuditFinding } from '@/algorithms/audit/rules'
import { calculateBudgetVariance } from '@/algorithms/budgeting'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Debt, Expense, RecurringExpense, SavingsGoal } from '@/types/database'

const SEVERITY_CLASS: Record<AuditFinding['severity'], string> = {
  info: 'border-gray-200 bg-gray-50 text-gray-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-red-200 bg-red-50 text-red-800',
}

export default function Auditor() {
  const { user } = useAuth()
  const { data: expenses, loading: l1 } = useSupabaseTable<Expense>('expenses')
  const { data: recurringExpenses, loading: l2 } = useSupabaseTable<RecurringExpense>('recurring_expenses')
  const { data: savingsGoals, loading: l3 } = useSupabaseTable<SavingsGoal>('savings_goals')
  const { data: debts, loading: l4 } = useSupabaseTable<Debt>('debts')
  const { budget, envelopes, loading: l5 } = useEnvelopes()
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())

  const loading = l1 || l2 || l3 || l4 || l5

  const budgetVariances = useMemo(() => {
    if (!budget) return []
    return calculateBudgetVariance(
      envelopes.map((e) => ({
        id: e.budgetCategoryId ?? e.categoryId,
        user_id: '',
        budget_id: budget.id,
        category_id: e.categoryId,
        planned_amount: e.planned,
        created_at: '',
        updated_at: '',
      })),
      expenses,
    )
  }, [budget, envelopes, expenses])

  const findings = useMemo(
    () =>
      runFullAudit({
        expenses,
        budgetVariances,
        recurringExpenses,
        savingsGoals,
        debts,
      }),
    [expenses, budgetVariances, recurringExpenses, savingsGoals, debts],
  )

  const handleSaveAlert = async (finding: AuditFinding, index: number) => {
    if (!user) return
    await supabase.from('financial_alerts').insert({
      user_id: user.id,
      type: finding.type,
      severity: finding.severity,
      title: finding.title,
      message: finding.message,
      related_table: finding.relatedTable ?? null,
      related_id: finding.relatedId ?? null,
    })
    setSavedIds((prev) => new Set(prev).add(index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">🔎 Auditor financiero</h2>
        <p className="text-sm text-gray-500">
          Revisa gastos anormales, duplicados, presupuesto excedido, gastos recurrentes vencidos,
          metas atrasadas y deudas nuevas.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Analizando…</p>
      ) : findings.length === 0 ? (
        <p className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
          No se encontraron hallazgos por ahora. Todo se ve consistente.
        </p>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding, index) => (
            <li key={index} className={`rounded-lg border p-4 ${SEVERITY_CLASS[finding.severity]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{finding.title}</p>
                  <p className="mt-1 text-sm opacity-90">{finding.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveAlert(finding, index)}
                  disabled={savedIds.has(index)}
                  className="shrink-0 whitespace-nowrap text-xs font-medium underline disabled:no-underline disabled:opacity-50"
                >
                  {savedIds.has(index) ? 'Guardado' : 'Guardar como alerta'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
