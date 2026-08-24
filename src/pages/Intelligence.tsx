import { useMemo, useState } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { useEnvelopes } from '@/hooks/useEnvelopes'
import { useLearning } from '@/hooks/useLearning'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { runFullAudit } from '@/algorithms/audit/rules'
import { calculateBudgetVariance } from '@/algorithms/budgeting'
import { avalancheOrder } from '@/algorithms/debt'
import { calculateLiquidity } from '@/algorithms/networth'
import { calculateSpendable } from '@/algorithms/budgeting/spendable'
import { buildRecommendations } from '@/algorithms/recommendations/engine'
import { formatCurrency } from '@/utils/format'
import type {
  Account,
  Debt,
  Expense,
  IncomeTransaction,
  Receivable,
  RecurringExpense,
  SavingsGoal,
} from '@/types/database'

type FeedSeverity = 'critical' | 'warning' | 'info'
type FeedSource = 'Auditor' | 'Aprendizaje' | 'Recomendación'

interface FeedItem {
  key: string
  source: FeedSource
  severity: FeedSeverity
  title: string
  message: string
  action?: { label: string; run: () => unknown | Promise<unknown> }
}

const SEVERITY_ICON: Record<FeedSeverity, string> = { critical: '🔴', warning: '🟡', info: '🔵' }
const SEVERITY_ORDER: Record<FeedSeverity, number> = { critical: 0, warning: 1, info: 2 }
const SOURCE_BADGE: Record<FeedSource, string> = {
  Auditor: 'bg-red-50 text-red-700',
  Aprendizaje: 'bg-blue-50 text-blue-700',
  Recomendación: 'bg-brand-50 text-brand-700',
}

export default function Intelligence() {
  const { user } = useAuth()
  const { data: expenses } = useSupabaseTable<Expense>('expenses')
  const { data: recurringExpenses } = useSupabaseTable<RecurringExpense>('recurring_expenses')
  const { data: savingsGoals } = useSupabaseTable<SavingsGoal>('savings_goals')
  const { data: debts } = useSupabaseTable<Debt>('debts')
  const { data: accounts } = useSupabaseTable<Account>('accounts')
  const { data: receivables } = useSupabaseTable<Receivable>('receivables')
  const { data: income } = useSupabaseTable<IncomeTransaction>('income_transactions')
  const { budget, envelopes } = useEnvelopes()
  const { suggestions: learningSuggestions, approveSuggestion } = useLearning()
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set())

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

  const auditFindings = useMemo(
    () => runFullAudit({ expenses, budgetVariances, recurringExpenses, savingsGoals, debts }),
    [expenses, budgetVariances, recurringExpenses, savingsGoals, debts],
  )

  const recommendations = useMemo(() => {
    const balance = income.reduce((s, i) => s + Number(i.amount), 0) - expenses.reduce((s, e) => s + Number(e.amount), 0)
    const cashOnHand = accounts.reduce((s, a) => s + Number(a.opening_balance), 0) + balance
    const liquidity = calculateLiquidity({ cashOnHand, committedThisMonth: 0, savingsGoals, receivables, invested: 0 })
    const spendable = calculateSpendable({
      liquidity: liquidity.disponible, reliableIncome: 0, essentialExpenses: 0, debtPayments: 0,
      savingsTarget: 0, goalContributions: 0, safetyMargin: 0,
    })
    const avalanche = avalancheOrder(debts)
    const hasExpensiveDebt = debts.some((d) => d.status === 'active' && d.interest_rate > 15)
    return buildRecommendations({
      spendable,
      netWorth: { totalAssets: 0, totalLiabilities: 0, netWorth: 0, hasUnknownValues: false },
      avalanche,
      hasExpensiveDebt,
    })
  }, [income, expenses, accounts, savingsGoals, receivables, debts])

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []

    for (const finding of auditFindings) {
      const key = `auditor-${finding.title}-${finding.relatedId ?? finding.message.slice(0, 20)}`
      items.push({
        key,
        source: 'Auditor',
        severity: finding.severity,
        title: finding.title,
        message: finding.message,
        action: user
          ? {
              label: 'Guardar como alerta',
              run: () =>
                supabase.from('financial_alerts').insert({
                  user_id: user.id,
                  type: finding.type,
                  severity: finding.severity,
                  title: finding.title,
                  message: finding.message,
                  related_table: finding.relatedTable ?? null,
                  related_id: finding.relatedId ?? null,
                }),
            }
          : undefined,
      })
    }

    for (const suggestion of learningSuggestions) {
      items.push({
        key: `aprendizaje-${suggestion.categoryId}`,
        source: 'Aprendizaje',
        severity: 'info',
        title: `Ajustar presupuesto de ${suggestion.categoryName}`,
        message: `${suggestion.reason} Sugerido: ${formatCurrency(suggestion.suggestedPlanned)} (actual: ${formatCurrency(suggestion.currentPlanned)}).`,
        action: { label: 'Aprobar ajuste', run: () => approveSuggestion(suggestion) },
      })
    }

    for (const rec of recommendations) {
      items.push({
        key: `recomendacion-${rec.category}-${rec.title}`,
        source: 'Recomendación',
        severity: 'info',
        title: rec.title,
        message: rec.motivo,
      })
    }

    return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }, [auditFindings, learningSuggestions, recommendations, user, approveSuggestion])

  const handleAction = async (item: FeedItem) => {
    if (!item.action) return
    await item.action.run()
    setDoneKeys((prev) => new Set(prev).add(item.key))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">🧠 Inteligencia</h2>
        <p className="text-sm text-gray-500">
          Todo lo que tu cerebro financiero detectó, aprendió y recomienda, en un solo lugar.
        </p>
      </div>

      {feed.length === 0 ? (
        <p className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
          No hay hallazgos, sugerencias ni recomendaciones por ahora. Todo se ve consistente.
        </p>
      ) : (
        <ul className="space-y-3">
          {feed.map((item) => (
            <li key={item.key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span>{SEVERITY_ICON[item.severity]}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[item.source]}`}>
                      {item.source}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                </div>
                {item.action && (
                  <button
                    type="button"
                    onClick={() => handleAction(item)}
                    disabled={doneKeys.has(item.key)}
                    className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                  >
                    {doneKeys.has(item.key) ? 'Listo' : item.action.label}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
