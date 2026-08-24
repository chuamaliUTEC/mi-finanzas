import { useMemo } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import type {
  CreditCard,
  Debt,
  Expense,
  IncomeTransaction,
  Receivable,
  RecurringExpense,
  SavingsGoal,
} from '@/types/database'
import { formatCurrency, formatDate } from '@/utils/format'

interface CalendarEvent {
  date: string // ISO date
  icon: string
  label: string
  amount?: number
}

function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start, end, year: now.getFullYear(), month: now.getMonth() }
}

function dayInCurrentMonth(day: number | null, year: number, month: number): string | null {
  if (!day) return null
  const lastDay = new Date(year, month + 1, 0).getDate()
  const clamped = Math.min(day, lastDay)
  return new Date(year, month, clamped).toISOString().slice(0, 10)
}

export default function CalendarPage() {
  const { data: income } = useSupabaseTable<IncomeTransaction>('income_transactions')
  const { data: expenses } = useSupabaseTable<Expense>('expenses')
  const { data: debts } = useSupabaseTable<Debt>('debts')
  const { data: creditCards } = useSupabaseTable<CreditCard>('credit_cards')
  const { data: recurringExpenses } = useSupabaseTable<RecurringExpense>('recurring_expenses')
  const { data: savingsGoals } = useSupabaseTable<SavingsGoal>('savings_goals')
  const { data: receivables } = useSupabaseTable<Receivable>('receivables')

  const { start, end, year, month } = currentMonthRange()
  const startISO = start.toISOString().slice(0, 10)
  const endISO = end.toISOString().slice(0, 10)

  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = []

    for (const item of income) {
      if (item.received_at >= startISO && item.received_at <= endISO) {
        list.push({ date: item.received_at, icon: '💵', label: `Ingreso: ${item.description ?? 'Sin descripción'}`, amount: Number(item.amount) })
      }
    }
    for (const item of expenses) {
      if (item.spent_at >= startISO && item.spent_at <= endISO) {
        list.push({ date: item.spent_at, icon: '💸', label: `Gasto: ${item.description ?? 'Sin descripción'}`, amount: Number(item.amount) })
      }
    }
    for (const debt of debts) {
      const date = dayInCurrentMonth(debt.due_day, year, month)
      if (date && debt.status === 'active') {
        list.push({
          date,
          icon: '💳',
          label: `Vencimiento deuda: ${debt.name}`,
          amount: debt.minimum_payment ?? undefined,
        })
      }
    }
    for (const card of creditCards) {
      const dueDate = dayInCurrentMonth(card.payment_due_day, year, month)
      if (dueDate) list.push({ date: dueDate, icon: '💳', label: `Fecha de pago: ${card.name}` })
      const statementDate = dayInCurrentMonth(card.statement_day, year, month)
      if (statementDate) list.push({ date: statementDate, icon: '🧾', label: `Corte de tarjeta: ${card.name}` })
    }
    for (const recurring of recurringExpenses) {
      if (recurring.is_active && recurring.next_due_date >= startISO && recurring.next_due_date <= endISO) {
        list.push({
          date: recurring.next_due_date,
          icon: '🔁',
          label: `Gasto recurrente: ${recurring.name}`,
          amount: Number(recurring.amount),
        })
      }
    }
    for (const goal of savingsGoals) {
      if (goal.target_date && goal.target_date >= startISO && goal.target_date <= endISO) {
        list.push({ date: goal.target_date, icon: '🎯', label: `Meta objetivo: ${goal.name}` })
      }
    }
    for (const receivable of receivables) {
      if (receivable.due_date && receivable.due_date >= startISO && receivable.due_date <= endISO) {
        list.push({
          date: receivable.due_date,
          icon: '💰',
          label: `Cobro esperado: ${receivable.debtor_name}`,
          amount: Number(receivable.outstanding_amount),
        })
      }
    }

    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [income, expenses, debts, creditCards, recurringExpenses, savingsGoals, receivables, startISO, endISO, year, month])

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const list = map.get(event.date) ?? []
      list.push(event)
      map.set(event.date, list)
    }
    return Array.from(map.entries())
  }, [events])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">📅 Calendario financiero</h2>
        <p className="text-sm text-gray-500">
          Ingresos, gastos, vencimientos de deuda/tarjeta, metas y cobros esperados de este mes.
        </p>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          No hay eventos registrados para este mes.
        </p>
      ) : (
        <ul className="space-y-3">
          {grouped.map(([date, dayEvents]) => (
            <li key={date} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">{formatDate(date)}</p>
              <ul className="space-y-1">
                {dayEvents.map((event, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      {event.icon} {event.label}
                    </span>
                    {event.amount !== undefined && <span className="text-gray-500">{formatCurrency(event.amount)}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
