import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { projectNext12Months, projectNextPeriod } from '@/algorithms/forecasting'
import type { Expense, Forecast, ForecastActual, IncomeTransaction } from '@/types/database'

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7) // YYYY-MM
}

function firstDayOfMonthsAhead(offset: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 10)
}

export function useForecast() {
  const { user } = useAuth()
  const [income, setIncome] = useState<IncomeTransaction[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [actuals, setActuals] = useState<ForecastActual[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    const [incomeRes, expensesRes, forecastsRes, actualsRes] = await Promise.all([
      supabase.from('income_transactions').select('*').eq('user_id', user.id).order('received_at'),
      supabase.from('expenses').select('*').eq('user_id', user.id).order('spent_at'),
      supabase.from('forecasts').select('*').eq('user_id', user.id).order('forecast_date', { ascending: false }),
      supabase.from('forecast_actuals').select('*').eq('user_id', user.id),
    ])
    if (incomeRes.error || expensesRes.error || forecastsRes.error || actualsRes.error) {
      setError(
        incomeRes.error?.message ??
          expensesRes.error?.message ??
          forecastsRes.error?.message ??
          actualsRes.error?.message ??
          'Error desconocido',
      )
    } else {
      setIncome((incomeRes.data ?? []) as IncomeTransaction[])
      setExpenses((expensesRes.data ?? []) as Expense[])
      setForecasts((forecastsRes.data ?? []) as Forecast[])
      setActuals((actualsRes.data ?? []) as ForecastActual[])
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Aggregate into monthly totals, most recent last, for the moving-average input.
  const monthlyIncome = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const item of income) {
      byMonth.set(monthKey(item.received_at), (byMonth.get(monthKey(item.received_at)) ?? 0) + Number(item.amount))
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, amount]) => ({ amount }))
  }, [income])

  const monthlyExpenses = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const item of expenses) {
      byMonth.set(monthKey(item.spent_at), (byMonth.get(monthKey(item.spent_at)) ?? 0) + Number(item.amount))
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, amount]) => ({ amount }))
  }, [expenses])

  const twelveMonthProjection = useMemo(
    () => projectNext12Months(monthlyIncome, monthlyExpenses),
    [monthlyIncome, monthlyExpenses],
  )

  const saveNextMonthForecast = useCallback(async () => {
    if (!user) return { error: 'No hay sesión activa' }
    const projection = projectNextPeriod(monthlyIncome, monthlyExpenses)
    const { error: insertError } = await supabase.from('forecasts').insert({
      user_id: user.id,
      forecast_date: firstDayOfMonthsAhead(1),
      projected_income: projection.projectedIncome,
      projected_expenses: projection.projectedExpenses,
      projected_balance: projection.projectedBalance,
      method: 'moving_average',
    })
    if (insertError) return { error: insertError.message }
    await refresh()
    return { error: null }
  }, [user, monthlyIncome, monthlyExpenses, refresh])

  const confirmActualForForecast = useCallback(
    async (forecast: Forecast) => {
      if (!user) return { error: 'No hay sesión activa' }
      const month = monthKey(forecast.forecast_date)
      const actualIncome = income
        .filter((i) => monthKey(i.received_at) === month)
        .reduce((sum, i) => sum + Number(i.amount), 0)
      const actualExpenses = expenses
        .filter((e) => monthKey(e.spent_at) === month)
        .reduce((sum, e) => sum + Number(e.amount), 0)

      const { error: insertError } = await supabase.from('forecast_actuals').insert({
        user_id: user.id,
        forecast_id: forecast.id,
        actual_income: actualIncome,
        actual_expenses: actualExpenses,
        actual_balance: actualIncome - actualExpenses,
      })
      if (insertError) return { error: insertError.message }
      await refresh()
      return { error: null }
    },
    [user, income, expenses, refresh],
  )

  return {
    loading,
    error,
    twelveMonthProjection,
    forecasts,
    actuals,
    saveNextMonthForecast,
    confirmActualForForecast,
  }
}
