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

/**
 * Una cuenta con saldo desconocido (initial_balance null) NO es una cuenta en
 * cero: es una cuenta sobre la que falta información. La diferencia importa,
 * porque presentar "S/ 0" como si fuera un dato lleva a decisiones erróneas.
 */
export function hasKnownBalance(account: Account): boolean {
  return account.initial_balance !== null
}

/**
 * Saldo de la cuenta, o null si su saldo de partida es desconocido. En ese
 * caso la interfaz debe pedir el dato en lugar de mostrar un número.
 */
export function computeAccountBalanceOrNull(
  account: Account,
  data: BalanceInputs,
): number | null {
  if (!hasKnownBalance(account)) return null
  return computeAccountBalance(account, data)
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

  const start = account.initial_balance ?? 0
  return round2(start + incomeTotal - expenseTotal + transfersIn - transfersOut)
}

/**
 * Dinero disponible real: suma de saldos de cuentas VERIFICADAS, con saldo
 * CONOCIDO y no eliminadas, en la moneda base. Es la base del "puedes
 * gastar". Las cuentas sin saldo registrado quedan fuera: contarlas como
 * cero inflaría o desinflaría la cifra con un dato que nadie confirmó.
 */
export function computeAvailableMoney(
  accounts: Account[],
  data: BalanceInputs,
  currency = 'PEN',
): number {
  return round2(
    accounts
      .filter(isLive)
      .filter((a) => a.is_verified && a.currency === currency && hasKnownBalance(a))
      .reduce((sum, a) => sum + computeAccountBalance(a, data), 0),
  )
}

/** Cuentas verificadas cuyo saldo aún no se ha registrado. */
export function accountsMissingBalance(accounts: Account[], currency = 'PEN'): Account[] {
  return accounts.filter(
    (a) => isLive(a) && a.is_verified && a.currency === currency && !hasKnownBalance(a),
  )
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
