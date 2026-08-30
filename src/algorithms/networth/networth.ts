import { computeAccountBalance, round2 } from '@/algorithms/accounts/balance'
import { computeDebtBalance } from '@/algorithms/debt/debts'
import type {
  Account,
  Asset,
  Debt,
  DebtPayment,
  Expense,
  IncomeTransaction,
  Receivable,
  ReceivablePayment,
  Transfer,
} from '@/types/database'

// Patrimonio neto (secc. 29): ACTIVOS − PASIVOS, recalculado siempre desde
// los movimientos. Distingue lo verificado de lo declarado sin comprobar.

export function receivableBalance(receivable: Receivable, payments: ReceivablePayment[]): number {
  const received = payments
    .filter((p) => p.receivable_id === receivable.id && p.deleted_at === null)
    .reduce((sum, p) => sum + p.amount, 0)
  return round2(Math.max(0, receivable.original_amount - received))
}

export interface NetWorthInputs {
  accounts: Account[]
  incomes: IncomeTransaction[]
  expenses: Expense[]
  transfers: Transfer[]
  assets: Asset[]
  receivables: Receivable[]
  receivablePayments: ReceivablePayment[]
  debts: Debt[]
  debtPayments: DebtPayment[]
}

export interface NetWorthResult {
  verifiedAssets: number
  unverifiedAssets: number
  receivablesPending: number
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

export function computeNetWorth(inputs: NetWorthInputs): NetWorthResult {
  const balanceData = {
    incomes: inputs.incomes,
    expenses: inputs.expenses,
    transfers: inputs.transfers,
  }

  let verified = 0
  let unverified = 0
  for (const account of inputs.accounts) {
    if (account.deleted_at !== null) continue
    const balance = computeAccountBalance(account, balanceData)
    if (account.is_verified) verified += balance
    else unverified += balance
  }
  for (const asset of inputs.assets) {
    if (asset.deleted_at !== null) continue
    if (asset.is_verified) verified += asset.value
    else unverified += asset.value
  }

  const receivablesPending = round2(
    inputs.receivables
      .filter((r) => r.deleted_at === null && r.status !== 'incobrable')
      .reduce((sum, r) => sum + receivableBalance(r, inputs.receivablePayments), 0),
  )

  // Pasivos: deudas activas/en mora/congeladas. Las no activadas (ej. UTEC
  // sin activar) no son pasivo corriente todavía.
  const totalLiabilities = round2(
    inputs.debts
      .filter((d) => d.deleted_at === null && d.status !== 'pagada' && d.status !== 'no_activada')
      .reduce((sum, d) => sum + computeDebtBalance(d, inputs.debtPayments), 0),
  )

  const totalAssets = round2(verified + unverified + receivablesPending)
  return {
    verifiedAssets: round2(verified),
    unverifiedAssets: round2(unverified),
    receivablesPending,
    totalAssets,
    totalLiabilities,
    netWorth: round2(totalAssets - totalLiabilities),
  }
}
