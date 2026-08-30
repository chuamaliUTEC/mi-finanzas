import { useMemo } from 'react'
import { useTable } from '@/hooks/useTable'
import { computeAvailableMoney } from '@/algorithms/accounts/balance'
import { computeSpendable, upcomingPayments } from '@/algorithms/spendable/spendable'
import { isInMonth } from '@/algorithms/budget/budget'
import { committedMonthlySavings, goalCurrentAmount } from '@/algorithms/savings/savings'
import { totalActiveDebt } from '@/algorithms/debt/debts'
import { evaluateRules, type FinancialSnapshot } from '@/algorithms/rules/engine'

/**
 * Carga el estado financiero completo y calcula los derivados compartidos
 * por el dashboard, el centro de decisiones y el calendario. Centralizarlo
 * evita que dos pantallas muestren cifras distintas del mismo concepto.
 */
export function useFinancialOverview(today = new Date()) {
  const accounts = useTable('accounts')
  const incomes = useTable('income_transactions')
  const expenses = useTable('expenses')
  const transfers = useTable('transfers')
  const debts = useTable('debts')
  const debtPayments = useTable('debt_payments')
  const cards = useTable('credit_cards')
  const recurring = useTable('recurring_expenses')
  const budgets = useTable('monthly_budgets')
  const budgetCategories = useTable('budget_categories', { softDelete: false })
  const categories = useTable('expense_categories', { orderBy: 'sort_order', ascending: true })
  const goals = useTable('savings_goals')
  const contributions = useTable('savings_contributions')
  const sources = useTable('income_sources')
  const extraordinary = useTable('extraordinary_incomes')
  const allocations = useTable('extraordinary_income_allocations', { softDelete: false })
  const rules = useTable('financial_rules', { orderBy: 'sort_order', ascending: true })

  const year = today.getFullYear()
  const month = today.getMonth() + 1

  const loading =
    accounts.loading || debts.loading || rules.loading || expenses.loading || recurring.loading

  const availableMoney = useMemo(
    () =>
      computeAvailableMoney(accounts.rows, {
        incomes: incomes.rows,
        expenses: expenses.rows,
        transfers: transfers.rows,
      }),
    [accounts.rows, incomes.rows, expenses.rows, transfers.rows],
  )

  const currentBudget = budgets.rows.find((b) => b.year === year && b.month === month)
  const monthBudgetCategories = useMemo(
    () => (currentBudget ? budgetCategories.rows.filter((bc) => bc.budget_id === currentBudget.id) : []),
    [currentBudget, budgetCategories.rows],
  )
  const monthExpenses = useMemo(
    () => expenses.rows.filter((e) => isInMonth(e.date, year, month)),
    [expenses.rows, year, month],
  )

  const committedSavings = committedMonthlySavings(goals.rows)

  const spendable = useMemo(
    () =>
      computeSpendable({
        availableMoney,
        debts: debts.rows,
        debtPayments: debtPayments.rows,
        recurring: recurring.rows,
        budgetCategories: monthBudgetCategories,
        monthExpenses,
        committedSavings,
        today,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      availableMoney, debts.rows, debtPayments.rows, recurring.rows,
      monthBudgetCategories, monthExpenses, committedSavings,
    ],
  )

  const upcoming = useMemo(
    () => upcomingPayments(debts.rows, debtPayments.rows, recurring.rows, cards.rows, today, 31),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debts.rows, debtPayments.rows, recurring.rows, cards.rows],
  )

  const snapshot = useMemo<FinancialSnapshot>(
    () => ({
      today,
      availableMoney,
      debts: debts.rows,
      debtPayments: debtPayments.rows,
      cards: cards.rows,
      categories: categories.rows,
      budgetCategories: monthBudgetCategories,
      expenses: expenses.rows,
      recurring: recurring.rows,
      extraordinaryIncomes: extraordinary.rows,
      extraordinaryAllocations: allocations.rows,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      availableMoney, debts.rows, debtPayments.rows, cards.rows, categories.rows,
      monthBudgetCategories, expenses.rows, recurring.rows, extraordinary.rows, allocations.rows,
    ],
  )

  const alerts = useMemo(() => evaluateRules(rules.rows, snapshot), [rules.rows, snapshot])

  const emergencyGoal = goals.rows.find(
    (g) => g.kind === 'fondo_emergencia' && g.status === 'activa',
  )
  const emergencyFundCurrent = emergencyGoal
    ? goalCurrentAmount(emergencyGoal, contributions.rows)
    : 0

  return {
    loading,
    today,
    year,
    month,
    availableMoney,
    spendable,
    upcoming,
    upcomingTotal: upcoming.reduce((sum, p) => sum + p.amount, 0),
    totalDebt: totalActiveDebt(debts.rows, debtPayments.rows),
    alerts,
    snapshot,
    emergencyGoal,
    emergencyFundCurrent,
    monthBudgetCategories,
    monthExpenses,
    tables: {
      accounts, incomes, expenses, transfers, debts, debtPayments, cards,
      recurring, budgets, budgetCategories, categories, goals, contributions,
      sources, extraordinary, allocations, rules,
    },
  }
}
