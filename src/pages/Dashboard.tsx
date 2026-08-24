import { useMemo } from 'react'
import { StatCard } from '@/components/StatCard'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { calculateLiquidity, calculateNetWorth } from '@/algorithms/networth'
import { calculateSpendable } from '@/algorithms/budgeting/spendable'
import type {
  Account,
  CreditCard,
  Debt,
  Expense,
  IncomeTransaction,
  Receivable,
  SavingsGoal,
} from '@/types/database'
import { formatCurrency } from '@/utils/format'

export default function Dashboard() {
  const { data: income, loading: l1 } = useSupabaseTable<IncomeTransaction>('income_transactions', {
    orderBy: 'received_at',
  })
  const { data: expenses, loading: l2 } = useSupabaseTable<Expense>('expenses', { orderBy: 'spent_at' })
  const { data: accounts, loading: l3 } = useSupabaseTable<Account>('accounts')
  const { data: receivables, loading: l4 } = useSupabaseTable<Receivable>('receivables')
  const { data: savingsGoals, loading: l5 } = useSupabaseTable<SavingsGoal>('savings_goals')
  const { data: debts, loading: l6 } = useSupabaseTable<Debt>('debts')
  const { data: creditCards, loading: l7 } = useSupabaseTable<CreditCard>('credit_cards')

  const loading = l1 || l2 || l3 || l4 || l5 || l6 || l7

  const totals = useMemo(() => {
    const totalIncome = income.reduce((sum, item) => sum + Number(item.amount), 0)
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0)
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses }
  }, [income, expenses])

  const netWorth = useMemo(
    () => calculateNetWorth(accounts, receivables, savingsGoals, debts, creditCards),
    [accounts, receivables, savingsGoals, debts, creditCards],
  )

  const liquidity = useMemo(() => {
    const cashOnHand = accounts.reduce((sum, a) => sum + Number(a.opening_balance), 0) + totals.balance
    return calculateLiquidity({
      cashOnHand,
      committedThisMonth: 0,
      savingsGoals,
      receivables,
      invested: 0,
    })
  }, [accounts, totals.balance, savingsGoals, receivables])

  const spendable = useMemo(
    () =>
      calculateSpendable({
        liquidity: liquidity.disponible,
        reliableIncome: 0,
        essentialExpenses: 0,
        debtPayments: 0,
        savingsTarget: 0,
        goalContributions: 0,
        safetyMargin: 0,
      }),
    [liquidity],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">💜 Mi situación financiera</h2>
        <p className="text-sm text-gray-500">Vista general de tus finanzas registradas.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando datos…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Puedes gastar" value={formatCurrency(spendable.amount)} tone="positive" />
            <StatCard
              label="Patrimonio neto"
              value={formatCurrency(netWorth.netWorth) + (netWorth.hasUnknownValues ? ' *' : '')}
              tone={netWorth.netWorth >= 0 ? 'positive' : 'negative'}
            />
            <StatCard label="Ingresos totales" value={formatCurrency(totals.totalIncome)} tone="positive" />
            <StatCard label="Gastos totales" value={formatCurrency(totals.totalExpenses)} tone="negative" />
          </div>
          {netWorth.hasUnknownValues && (
            <p className="text-xs text-amber-600">
              * Hay deudas o tarjetas con saldo "por confirmar" que no se incluyeron en este total.
            </p>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Liquidez</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-gray-500">Disponible</p>
                <p className="text-sm font-semibold text-brand-700">{formatCurrency(liquidity.disponible)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Comprometido</p>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(liquidity.comprometido)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Reservado (metas)</p>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(liquidity.reservado)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Invertido</p>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(liquidity.invertido)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Por cobrar</p>
                <p className="text-sm font-semibold text-gray-700">{formatCurrency(liquidity.porCobrar)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-700">Movimientos recientes</h3>
        {income.length === 0 && expenses.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aún no registras movimientos. Empieza agregando un ingreso o un gasto.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {[...income.slice(0, 5).map((i) => ({ ...i, kind: 'Ingreso' as const })), ...expenses
              .slice(0, 5)
              .map((e) => ({ ...e, kind: 'Gasto' as const }))]
              .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
              .slice(0, 8)
              .map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between py-2">
                  <span className="text-gray-600">
                    {item.kind}: {item.description || 'Sin descripción'}
                  </span>
                  <span className={item.kind === 'Ingreso' ? 'text-brand-600' : 'text-red-600'}>
                    {formatCurrency(Number(item.amount))}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  )
}
