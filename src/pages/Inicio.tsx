import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTable } from '@/hooks/useTable'
import { computeAvailableMoney } from '@/algorithms/accounts/balance'
import { totalActiveDebt } from '@/algorithms/debt/debts'
import {
  computeSpendable,
  monthlyExpectedIncome,
  upcomingPayments,
} from '@/algorithms/spendable/spendable'
import { isInMonth } from '@/algorithms/budget/budget'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatDate } from '@/utils/format'

// Dashboard minimalista (secc. 13-14): una cifra protagonista ("puedes
// gastar"), y debajo la pregunta que guía a cada sección. Sin saturación.

const QUESTIONS = [
  { to: '/deudas', icon: '💳', label: '¿Cuánto debo?' },
  { to: '/calendario', icon: '📅', label: '¿Qué tengo que pagar?' },
  { to: '/presupuesto', icon: '📉', label: '¿Estoy gastando demasiado?' },
  { to: '/metas', icon: '🎯', label: '¿Cómo voy con mis metas?' },
  { to: '/decisiones', icon: '🧠', label: '¿Qué debería hacer hoy?' },
]

export function Inicio() {
  const { profile } = useAuth()
  const accounts = useTable('accounts')
  const incomes = useTable('income_transactions')
  const expenses = useTable('expenses')
  const transfers = useTable('transfers')
  const debts = useTable('debts')
  const debtPayments = useTable('debt_payments')
  const recurring = useTable('recurring_expenses')
  const cards = useTable('credit_cards')
  const budgets = useTable('monthly_budgets')
  const budgetCategories = useTable('budget_categories', { softDelete: false })
  const sources = useTable('income_sources')
  const [showBreakdown, setShowBreakdown] = useState(false)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const balanceData = useMemo(
    () => ({ incomes: incomes.rows, expenses: expenses.rows, transfers: transfers.rows }),
    [incomes.rows, expenses.rows, transfers.rows],
  )
  const availableMoney = computeAvailableMoney(accounts.rows, balanceData)
  const totalDebt = totalActiveDebt(debts.rows, debtPayments.rows)

  const currentBudget = budgets.rows.find((b) => b.year === year && b.month === month)
  const monthBudgetCategories = currentBudget
    ? budgetCategories.rows.filter((bc) => bc.budget_id === currentBudget.id)
    : []
  const monthExpensesRows = useMemo(
    () => expenses.rows.filter((e) => isInMonth(e.date, year, month)),
    [expenses.rows, year, month],
  )

  const spendable = useMemo(
    () =>
      computeSpendable({
        availableMoney,
        debts: debts.rows,
        debtPayments: debtPayments.rows,
        recurring: recurring.rows,
        budgetCategories: monthBudgetCategories,
        monthExpenses: monthExpensesRows,
        today: now,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableMoney, debts.rows, debtPayments.rows, recurring.rows, monthBudgetCategories, monthExpensesRows],
  )

  const upcoming = useMemo(
    () => upcomingPayments(debts.rows, debtPayments.rows, recurring.rows, cards.rows, now, 31),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debts.rows, debtPayments.rows, recurring.rows, cards.rows],
  )

  const expectedIncomeMonth = sources.rows.reduce((sum, s) => sum + monthlyExpectedIncome(s), 0)
  const realIncomeMonth = incomes.rows
    .filter((i) => i.deleted_at === null && i.status === 'realizado' && isInMonth(i.date, year, month))
    .reduce((sum, i) => sum + i.amount, 0)

  const totalPlanned = monthBudgetCategories.reduce((s, bc) => s + bc.planned_amount, 0)
  const totalSpentMonth = monthExpensesRows
    .filter((e) => e.deleted_at === null && e.status === 'confirmado')
    .reduce((s, e) => s + e.amount, 0)

  const greeting = profile?.full_name ? `Hola, ${profile.full_name}` : 'Hola'
  const loading = accounts.loading || debts.loading

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{greeting}</h1>
        <p className="text-sm text-ink-500">Esto es lo que importa hoy.</p>
      </div>

      {/* 1. LA cifra */}
      <div className="card border-lavender-200 bg-gradient-to-br from-white to-lavender-50">
        <p className="text-sm font-medium text-ink-500">💵 Puedes gastar hoy</p>
        <p
          className={`mt-1 text-5xl font-semibold tracking-tight ${
            spendable.today < 0 ? 'text-critical' : 'text-ink-900'
          }`}
        >
          {loading ? '…' : formatCurrency(spendable.today)}
        </p>
        <p className="mt-2 text-sm text-ink-500">
          Esta semana: <strong>{formatCurrency(spendable.week)}</strong> · este mes:{' '}
          <strong>{formatCurrency(spendable.month)}</strong>
        </p>
        {spendable.month < 0 && (
          <p className="mt-2 text-sm text-critical">
            🔴 Tus obligaciones del mes superan tu dinero disponible.
          </p>
        )}
        <button
          className="mt-3 text-sm font-medium text-lavender-700"
          onClick={() => setShowBreakdown(!showBreakdown)}
        >
          {showBreakdown ? 'Ocultar cálculo' : '¿Cómo se calculó?'}
        </button>
        {showBreakdown && (
          <dl className="mt-3 space-y-1 border-t border-lavender-100 pt-3 text-sm text-ink-600">
            <div className="flex justify-between">
              <dt>Dinero disponible real</dt>
              <dd>{formatCurrency(spendable.breakdown.availableMoney)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Obligaciones de deuda del mes</dt>
              <dd>−{formatCurrency(spendable.breakdown.debtObligations)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Gastos recurrentes pendientes</dt>
              <dd>−{formatCurrency(spendable.breakdown.recurringPending)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Presupuesto protegido restante</dt>
              <dd>−{formatCurrency(spendable.breakdown.protectedBudgetRemaining)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>− Ahorro comprometido</dt>
              <dd>−{formatCurrency(spendable.breakdown.committedSavings)}</dd>
            </div>
            <div className="flex justify-between font-medium text-ink-900">
              <dt>= Realmente gastable este mes</dt>
              <dd>{formatCurrency(spendable.month)}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* 2-5: cifras secundarias, una por tarjeta, sin gráficos */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/deudas" className="card block transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-ink-500">💳 Deudas</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">{formatCurrency(totalDebt)}</p>
          <p className="mt-1 text-xs text-ink-400">Total pendiente activo</p>
        </Link>
        <div className="card">
          <p className="text-sm font-medium text-ink-500">💰 Ingresos del mes</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {formatCurrency(realIncomeMonth)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            de ~{formatCurrency(expectedIncomeMonth)} esperados
          </p>
        </div>
        <Link to="/presupuesto" className="card block transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-ink-500">📊 Gastos del mes</p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {formatCurrency(totalSpentMonth)}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {totalPlanned > 0
              ? `de ${formatCurrency(totalPlanned)} presupuestados`
              : 'sin presupuesto este mes'}
          </p>
        </Link>
        <div className="card">
          <p className="text-sm font-medium text-ink-500">📅 Próximos pagos</p>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-sm text-ink-400">Nada en los próximos 31 días.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {upcoming.slice(0, 4).map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-ink-700">
                    {formatDate(p.date)} · {p.label}
                  </span>
                  {p.amount > 0 && (
                    <span className="shrink-0 font-medium text-ink-900">
                      {formatCurrency(p.amount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ¿Qué necesitas saber? */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink-500">¿Qué necesitas saber?</p>
        <div className="flex flex-wrap gap-2">
          {QUESTIONS.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-sm text-ink-700 transition-colors hover:border-lavender-300 hover:bg-lavender-50"
            >
              {q.icon} {q.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
