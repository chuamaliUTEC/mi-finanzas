import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { suggestBudgetAdjustments, type BudgetAdjustmentSuggestion } from '@/algorithms/learning'
import type { BudgetCategory, Expense, ExpenseCategory, MonthlyBudget } from '@/types/database'

export function useLearning() {
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [budgetsRes, categoriesRes, expensesRes] = await Promise.all([
      supabase.from('monthly_budgets').select('*').eq('user_id', user.id).order('period_month'),
      supabase.from('expense_categories').select('*').eq('user_id', user.id),
      supabase.from('expenses').select('*').eq('user_id', user.id),
    ])
    if (budgetsRes.error || categoriesRes.error || expensesRes.error) {
      setError(budgetsRes.error?.message ?? categoriesRes.error?.message ?? expensesRes.error?.message ?? 'Error')
      setLoading(false)
      return
    }
    const budgetRows = (budgetsRes.data ?? []) as MonthlyBudget[]
    setBudgets(budgetRows)
    setCategories((categoriesRes.data ?? []) as ExpenseCategory[])
    setExpenses((expensesRes.data ?? []) as Expense[])

    const budgetIds = budgetRows.map((b) => b.id)
    if (budgetIds.length > 0) {
      const bcRes = await supabase.from('budget_categories').select('*').in('budget_id', budgetIds)
      setBudgetCategories((bcRes.data ?? []) as BudgetCategory[])
    } else {
      setBudgetCategories([])
    }
    setError(null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const suggestions = useMemo<BudgetAdjustmentSuggestion[]>(() => {
    const budgetById = new Map(budgets.map((b) => [b.id, b]))

    const byCategory = new Map<string, { monthlyActuals: number[]; currentPlanned: number; categoryName: string }>()

    for (const category of categories) {
      const bcForCategory = budgetCategories
        .filter((bc) => bc.category_id === category.id)
        .map((bc) => ({ bc, budget: budgetById.get(bc.budget_id) }))
        .filter((x): x is { bc: BudgetCategory; budget: MonthlyBudget } => Boolean(x.budget))
        .sort((a, b) => a.budget.period_month.localeCompare(b.budget.period_month))

      if (bcForCategory.length === 0) continue

      const monthlyActuals = bcForCategory.map(({ budget }) => {
        const monthStart = budget.period_month.slice(0, 7)
        return expenses
          .filter((e) => e.category_id === category.id && e.spent_at.startsWith(monthStart))
          .reduce((sum, e) => sum + Number(e.amount), 0)
      })

      const currentPlanned = Number(bcForCategory[bcForCategory.length - 1].bc.planned_amount)
      byCategory.set(category.id, { monthlyActuals, currentPlanned, categoryName: category.name })
    }

    return suggestBudgetAdjustments(
      Array.from(byCategory.entries()).map(([categoryId, v]) => ({ categoryId, ...v })),
    )
  }, [categories, budgetCategories, budgets, expenses])

  const approveSuggestion = useCallback(
    async (suggestion: BudgetAdjustmentSuggestion) => {
      if (!user) return { error: 'No hay sesión activa' }
      const currentMonth = new Date().toISOString().slice(0, 7) + '-01'
      let budget = budgets.find((b) => b.period_month === currentMonth)

      if (!budget) {
        const { data, error: insertBudgetError } = await supabase
          .from('monthly_budgets')
          .insert({ user_id: user.id, period_month: currentMonth, planned_income: 0, planned_expenses: 0 })
          .select()
          .single()
        if (insertBudgetError) return { error: insertBudgetError.message }
        budget = data as MonthlyBudget
      }

      const existingBc = budgetCategories.find(
        (bc) => bc.budget_id === budget!.id && bc.category_id === suggestion.categoryId,
      )
      const upsertResult = existingBc
        ? await supabase
            .from('budget_categories')
            .update({ planned_amount: suggestion.suggestedPlanned })
            .eq('id', existingBc.id)
        : await supabase.from('budget_categories').insert({
            user_id: user.id,
            budget_id: budget.id,
            category_id: suggestion.categoryId,
            planned_amount: suggestion.suggestedPlanned,
          })
      if (upsertResult.error) return { error: upsertResult.error.message }

      const { error: adjustmentError } = await supabase.from('learning_adjustments').insert({
        user_id: user.id,
        adjustment_type: 'budget_category_planned_amount',
        previous_value: { planned_amount: suggestion.currentPlanned, category_id: suggestion.categoryId },
        new_value: { planned_amount: suggestion.suggestedPlanned, category_id: suggestion.categoryId },
        reason: suggestion.reason,
      })
      if (adjustmentError) return { error: adjustmentError.message }

      await refresh()
      return { error: null }
    },
    [user, budgets, budgetCategories, refresh],
  )

  return { suggestions, loading, error, approveSuggestion }
}
