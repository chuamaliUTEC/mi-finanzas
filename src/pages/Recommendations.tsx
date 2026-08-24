import { useMemo, useState } from 'react'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { useCalculatorMemory } from '@/hooks/useCalculatorMemory'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { calculateLiquidity } from '@/algorithms/networth'
import { calculateSpendable } from '@/algorithms/budgeting/spendable'
import { avalancheOrder } from '@/algorithms/debt'
import { projectDepartamento } from '@/algorithms/goals/departamento'
import { projectRetiro } from '@/algorithms/goals/retiro'
import { buildRecommendations, type ExplainedRecommendation } from '@/algorithms/recommendations/engine'
import type { Account, Debt, Expense, IncomeTransaction, Receivable, SavingsGoal } from '@/types/database'

const DEPARTAMENTO_DEFAULTS = {
  precioObjetivo: '', cuotaInicialPct: '20', gastosCompra: '', ahorroActual: '', ahorroMensual: '',
  mesesHastaObjetivo: '60', tasaRendimientoAnual: '5', tasaHipotecaAnual: '9', plazoHipotecaMeses: '240',
}
const RETIRO_DEFAULTS = {
  edadActual: '25', edadObjetivo: '60', capitalActual: '', aporteMensual: '', tasaRendimientoAnual: '6',
  inflacionAnual: '3', ingresoDeseadoMensualRetiro: '', aniosEsperadosDeRetiro: '25',
}

export default function Recommendations() {
  const { user } = useAuth()
  const { data: accounts } = useSupabaseTable<Account>('accounts')
  const { data: receivables } = useSupabaseTable<Receivable>('receivables')
  const { data: savingsGoals } = useSupabaseTable<SavingsGoal>('savings_goals')
  const { data: debts } = useSupabaseTable<Debt>('debts')
  const { data: income } = useSupabaseTable<IncomeTransaction>('income_transactions')
  const { data: expenses } = useSupabaseTable<Expense>('expenses')
  const { params: departamentoParams, loading: loadingDep } = useCalculatorMemory('departamento_parametros', DEPARTAMENTO_DEFAULTS)
  const { params: retiroParams, loading: loadingRet } = useCalculatorMemory('retiro_parametros', RETIRO_DEFAULTS)
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())

  const recommendations = useMemo<ExplainedRecommendation[]>(() => {
    const balance = income.reduce((s, i) => s + Number(i.amount), 0) - expenses.reduce((s, e) => s + Number(e.amount), 0)
    const cashOnHand = accounts.reduce((s, a) => s + Number(a.opening_balance), 0) + balance
    const liquidity = calculateLiquidity({ cashOnHand, committedThisMonth: 0, savingsGoals, receivables, invested: 0 })
    const spendable = calculateSpendable({
      liquidity: liquidity.disponible, reliableIncome: 0, essentialExpenses: 0, debtPayments: 0,
      savingsTarget: 0, goalContributions: 0, safetyMargin: 0,
    })
    const avalanche = avalancheOrder(debts)
    const hasExpensiveDebt = debts.some((d) => d.status === 'active' && d.interest_rate > 15)

    const departamento =
      Number(departamentoParams.precioObjetivo) > 0
        ? projectDepartamento({
            precioObjetivo: Number(departamentoParams.precioObjetivo) || 0,
            cuotaInicialPct: (Number(departamentoParams.cuotaInicialPct) || 0) / 100,
            gastosCompra: Number(departamentoParams.gastosCompra) || 0,
            ahorroActual: Number(departamentoParams.ahorroActual) || 0,
            ahorroMensual: Number(departamentoParams.ahorroMensual) || 0,
            mesesHastaObjetivo: Number(departamentoParams.mesesHastaObjetivo) || 1,
            tasaRendimientoAnual: (Number(departamentoParams.tasaRendimientoAnual) || 0) / 100,
            tasaHipotecaAnual: (Number(departamentoParams.tasaHipotecaAnual) || 0) / 100,
            plazoHipotecaMeses: Number(departamentoParams.plazoHipotecaMeses) || 1,
          })
        : undefined

    const retiro =
      Number(retiroParams.ingresoDeseadoMensualRetiro) > 0
        ? projectRetiro({
            edadActual: Number(retiroParams.edadActual) || 0,
            edadObjetivo: Number(retiroParams.edadObjetivo) || 0,
            capitalActual: Number(retiroParams.capitalActual) || 0,
            aporteMensual: Number(retiroParams.aporteMensual) || 0,
            tasaRendimientoAnual: (Number(retiroParams.tasaRendimientoAnual) || 0) / 100,
            inflacionAnual: (Number(retiroParams.inflacionAnual) || 0) / 100,
            ingresoDeseadoMensualRetiro: Number(retiroParams.ingresoDeseadoMensualRetiro),
            aniosEsperadosDeRetiro: Number(retiroParams.aniosEsperadosDeRetiro) || 1,
          })
        : undefined

    return buildRecommendations({
      spendable,
      netWorth: { totalAssets: 0, totalLiabilities: 0, netWorth: 0, hasUnknownValues: false },
      avalanche,
      hasExpensiveDebt,
      departamento,
      retiro,
    })
  }, [accounts, receivables, savingsGoals, debts, income, expenses, departamentoParams, retiroParams])

  const handleSave = async (rec: ExplainedRecommendation, index: number) => {
    if (!user) return
    await supabase.from('recommendation_history').insert({
      user_id: user.id,
      category: rec.category,
      title: rec.title,
      description: `${rec.motivo}\n\nDatos: ${rec.datosUtilizados.join(', ')}\n\nImpacto: ${rec.impacto}`,
      status: 'pending',
    })
    setSavedIds((prev) => new Set(prev).add(index))
  }

  const loading = loadingDep || loadingRet

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">💡 Recomendaciones</h2>
        <p className="text-sm text-gray-500">
          Cada recomendación explica su motivo, los datos usados, el impacto y qué tan confiable es.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Calculando…</p>
      ) : (
        <ul className="space-y-4">
          {recommendations.map((rec, index) => (
            <li key={index} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{rec.motivo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSave(rec, index)}
                  disabled={savedIds.has(index)}
                  className="shrink-0 whitespace-nowrap text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                >
                  {savedIds.has(index) ? 'Guardada' : 'Guardar'}
                </button>
              </div>
              <details className="mt-2 text-xs text-gray-500">
                <summary className="cursor-pointer select-none">Ver datos utilizados</summary>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {rec.datosUtilizados.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  <span className="font-medium">Impacto:</span> {rec.impacto}
                </p>
                <p className="mt-1">
                  <span className="font-medium">Confianza:</span> {(rec.confianza * 100).toFixed(0)}% ·{' '}
                  <span className="font-medium">Fecha:</span> {rec.fecha}
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
