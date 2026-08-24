import type { BudgetCategory, Expense } from '@/types/database'

export interface CategoryVariance {
  categoryId: string | null
  planned: number
  actual: number
  variance: number
  overBudget: boolean
}

/** Compares planned amounts per category against actual expenses in the same period. */
export function calculateBudgetVariance(
  budgetCategories: BudgetCategory[],
  expenses: Expense[],
): CategoryVariance[] {
  return budgetCategories.map((budgetCategory) => {
    const actual = expenses
      .filter((expense) => expense.category_id === budgetCategory.category_id)
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
    const planned = Number(budgetCategory.planned_amount)
    return {
      categoryId: budgetCategory.category_id,
      planned,
      actual,
      variance: planned - actual,
      overBudget: actual > planned,
    }
  })
}
