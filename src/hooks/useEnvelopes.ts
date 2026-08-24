import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { BudgetCategory, Expense, ExpenseCategory, MonthlyBudget } from '@/types/database'

export interface Envelope {
  categoryId: string
  categoryName: string
  budgetCategoryId: string | null
  planned: number
  spent: number
  remaining: number
  overBudget: boolean
}

function monthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function useEnvelopes(periodMonth: string = monthStart()) {
  const { user } = useAuth()
  const [budget, setBudget] = useState<MonthlyBudget | null>(null)
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)

    const [budgetRes, categoriesRes] = await Promise.all([
      supabase
        .from('monthly_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_month', periodMonth)
        .maybeSingle(),
      supabase.from('expense_categories').select('*').eq('user_id', user.id).order('name'),
    ])

    if (budgetRes.error) {
      setError(budgetRes.error.message)
      setLoading(false)
      return
    }
    setCategories((categoriesRes.data ?? []) as ExpenseCategory[])

    const currentBudget = budgetRes.data as MonthlyBudget | null
    setBudget(currentBudget)

    const monthEnd = new Date(periodMonth)
    monthEnd.setMonth(monthEnd.getMonth() + 1)
    const monthEndISO = monthEnd.toISOString().slice(0, 10)

    const [budgetCategoriesRes, expensesRes] = await Promise.all([
      currentBudget
        ? supabase.from('budget_categories').select('*').eq('budget_id', currentBudget.id)
        : Promise.resolve({ data: [] as BudgetCategory[], error: null }),
      supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('spent_at', periodMonth)
        .lt('spent_at', monthEndISO),
    ])

    setBudgetCategories((budgetCategoriesRes.data ?? []) as BudgetCategory[])
    setExpenses((expensesRes.data ?? []) as Expense[])
    setError(null)
    setLoading(false)
  }, [user, periodMonth])

  useEffect(() => {
    refresh()
  }, [refresh])

  const ensureBudget = useCallback(
    async (plannedIncome: number) => {
      if (!user) return { error: 'No hay sesión activa' }
      const { error: insertError } = await supabase.from('monthly_budgets').insert({
        user_id: user.id,
        period_month: periodMonth,
        planned_income: plannedIncome,
        planned_expenses: 0,
      })
      if (insertError) return { error: insertError.message }
      await refresh()
      return { error: null }
    },
    [user, periodMonth, refresh],
  )

  const setEnvelopeAmount = useCallback(
    async (categoryId: string, amount: number) => {
      if (!user || !budget) return { error: 'Primero crea el presupuesto del mes' }
      const existing = budgetCategories.find((bc) => bc.category_id === categoryId)
      const result = existing
        ? await supabase.from('budget_categories').update({ planned_amount: amount }).eq('id', existing.id)
        : await supabase
            .from('budget_categories')
            .insert({ user_id: user.id, budget_id: budget.id, category_id: categoryId, planned_amount: amount })
      if (result.error) return { error: result.error.message }
      await refresh()
      return { error: null }
    },
    [user, budget, budgetCategories, refresh],
  )

  const envelopes = useMemo<Envelope[]>(() => {
    return categories.map((category) => {
      const bc = budgetCategories.find((b) => b.category_id === category.id)
      const planned = Number(bc?.planned_amount ?? 0)
      const spent = expenses
        .filter((e) => e.category_id === category.id)
        .reduce((sum, e) => sum + Number(e.amount), 0)
      return {
        categoryId: category.id,
        categoryName: category.name,
        budgetCategoryId: bc?.id ?? null,
        planned,
        spent,
        remaining: planned - spent,
        overBudget: spent > planned && planned > 0,
      }
    })
  }, [categories, budgetCategories, expenses])

  const totalPlanned = envelopes.reduce((sum, e) => sum + e.planned, 0)
  const totalIncome = Number(budget?.planned_income ?? 0)
  const unallocated = totalIncome - totalPlanned

  return {
    periodMonth,
    budget,
    envelopes,
    totalPlanned,
    totalIncome,
    unallocated,
    loading,
    error,
    ensureBudget,
    setEnvelopeAmount,
    refresh,
  }
}
