import type { Account, Expense, IncomeTransaction, Transfer } from '@/types/database'

// Reglas centrales (secc. 3, 7 y 30 del prompt maestro):
// - Solo los ingresos con status 'realizado' suman al saldo.
// - Las transferencias mueven dinero entre cuentas propias: nunca son
//   ingreso ni gasto netos.
// - Las cuentas no verificadas (p. ej. trading declarado) NUNCA cuentan
//   como dinero disponible, aunque sí como activo (patrimonio, Fase 5).

interface BalanceInputs {
  incomes: IncomeTransaction[]
  expenses: Expense[]
  transfers: Transfer[]
}

function isLive<T extends { deleted_at: string | null }>(row: T): boolean {
  return row.deleted_at === null
}

export function computeAccountBalance(account: Account, data: BalanceInputs): number {
  const incomeTotal = data.incomes
    .filter(isLive)
    .filter((i) => i.account_id === account.id && i.status === 'realizado')
    .reduce((sum, i) => sum + i.amount, 0)

  const expenseTotal = data.expenses
    .filter(isLive)
    .filter((e) => e.account_id === account.id && e.status === 'confirmado')
    .reduce((sum, e) => sum + e.amount, 0)

  const transfersIn = data.transfers
    .filter(isLive)
    .filter((t) => t.to_account_id === account.id)
    .reduce((sum, t) => sum + t.amount, 0)

  const transfersOut = data.transfers
    .filter(isLive)
    .filter((t) => t.from_account_id === account.id)
    .reduce((sum, t) => sum + t.amount, 0)

  return round2(account.initial_balance + incomeTotal - expenseTotal + transfersIn - transfersOut)
}

/**
 * Dinero disponible real: suma de saldos de cuentas VERIFICADAS y no
 * eliminadas, en la moneda base. Es la base del "puedes gastar" (Fase 4).
 */
export function computeAvailableMoney(
  accounts: Account[],
  data: BalanceInputs,
  currency = 'PEN',
): number {
  return round2(
    accounts
      .filter(isLive)
      .filter((a) => a.is_verified && a.currency === currency)
      .reduce((sum, a) => sum + computeAccountBalance(a, data), 0),
  )
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
