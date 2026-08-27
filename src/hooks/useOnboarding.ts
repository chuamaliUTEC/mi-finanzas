import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { recallCurrentFact, rememberFact } from '@/algorithms/memory'
import type {
  CreditCard,
  Debt,
  Expense,
  IncomeSource,
  SavingsGoal,
} from '@/types/database'

export function useOnboarding() {
  const { user } = useAuth()
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [expensesThisMonth, setExpensesThisMonth] = useState<Expense[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [afpFact, setAfpFact] = useState<string | null>(null)
  const [insuranceFact, setInsuranceFact] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'
    const [incomeRes, expensesRes, goalsRes, debtsRes, cardsRes, afpRes, insuranceRes] = await Promise.all([
      supabase.from('income_sources').select('*').eq('user_id', user.id),
      supabase.from('expenses').select('*').eq('user_id', user.id).gte('spent_at', monthStart),
      supabase.from('savings_goals').select('*').eq('user_id', user.id),
      supabase.from('debts').select('*').eq('user_id', user.id),
      supabase.from('credit_cards').select('*').eq('user_id', user.id),
      recallCurrentFact(user.id, 'afp_info'),
      recallCurrentFact(user.id, 'seguros_info'),
    ])
    setIncomeSources((incomeRes.data ?? []) as IncomeSource[])
    setExpensesThisMonth((expensesRes.data ?? []) as Expense[])
    setSavingsGoals((goalsRes.data ?? []) as SavingsGoal[])
    setDebts((debtsRes.data ?? []) as Debt[])
    setCreditCards((cardsRes.data ?? []) as CreditCard[])
    setAfpFact((afpRes.data?.memory_value?.texto as string) ?? null)
    setInsuranceFact((insuranceRes.data?.memory_value?.texto as string) ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const addIncomeSource = useCallback(
    async (values: { name: string; source_type: string; frequency: string; earmarked_for: string }) => {
      if (!user) return { error: 'No hay sesión activa' }
      const { error } = await supabase.from('income_sources').insert({
        user_id: user.id,
        name: values.name,
        is_recurring: true,
        source_type: values.source_type,
        frequency: values.frequency || null,
        earmarked_for: values.earmarked_for || null,
      })
      if (error) return { error: error.message }
      await refresh()
      return { error: null }
    },
    [user, refresh],
  )

  const saveAfp = useCallback(
    async (texto: string) => {
      if (!user) return { error: 'No hay sesión activa' }
      const result = await rememberFact(user.id, 'afp_info', { texto }, { source: 'onboarding' })
      if (!result.error) await refresh()
      return result
    },
    [user, refresh],
  )

  const saveInsurance = useCallback(
    async (texto: string) => {
      if (!user) return { error: 'No hay sesión activa' }
      const result = await rememberFact(user.id, 'seguros_info', { texto }, { source: 'onboarding' })
      if (!result.error) await refresh()
      return result
    },
    [user, refresh],
  )

  const hasEmergencyGoal = savingsGoals.some((g) => g.name.toLowerCase().includes('emergencia'))

  const steps = useMemo(
    () => [
      { key: 'ingresos', label: 'Fuentes de ingreso registradas', done: incomeSources.length > 0 },
      { key: 'gastos', label: 'Al menos 3 gastos de este mes registrados', done: expensesThisMonth.length >= 3 },
      { key: 'afp', label: 'AFP / fondo de pensión', done: Boolean(afpFact) },
      { key: 'seguros', label: 'Seguros que tienes', done: Boolean(insuranceFact) },
      { key: 'emergencia', label: 'Meta de fondo de emergencia creada', done: hasEmergencyGoal },
      { key: 'deudas', label: 'Deudas registradas (o confirmado que no tienes)', done: debts.length > 0 },
      { key: 'tarjetas', label: 'Tarjetas de crédito registradas (o confirmado que no tienes)', done: creditCards.length > 0 },
    ],
    [incomeSources, expensesThisMonth, afpFact, insuranceFact, hasEmergencyGoal, debts, creditCards],
  )

  const completedCount = steps.filter((s) => s.done).length

  return {
    loading,
    incomeSources,
    afpFact,
    insuranceFact,
    steps,
    completedCount,
    totalSteps: steps.length,
    addIncomeSource,
    saveAfp,
    saveInsurance,
    refresh,
  }
}
