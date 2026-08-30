// Tipos que reflejan el esquema de Postgres. Se amplía en cada fase a medida
// que se agregan tablas (ver docs/ARQUITECTURA.md, sección 4).

export type Reliability = 'alta' | 'media' | 'baja'
export type IncomeStatus = 'realizado' | 'esperado' | 'estimado' | 'pendiente' | 'no_verificado'
export type PaymentMethod =
  | 'efectivo'
  | 'yape'
  | 'plin'
  | 'transferencia'
  | 'debito'
  | 'credito'
  | 'credito_cuotas'
export type AccountType =
  | 'bancaria'
  | 'ahorro'
  | 'sueldo'
  | 'efectivo'
  | 'yape'
  | 'plin'
  | 'inversion'

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  base_currency: string
  birth_date: string | null
  employer: string | null
  employment_start_date: string | null
  financial_priority: string | null
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  entity_type: string
  entity_id: string
  action: 'create' | 'update' | 'delete'
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  institution: string | null
  currency: string
  initial_balance: number
  is_verified: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface IncomeSource {
  id: string
  user_id: string
  name: string
  kind: 'fijo' | 'variable' | 'extraordinario'
  recurrence: 'mensual' | 'quincenal' | 'semanal' | 'eventual'
  expected_amount: number | null
  currency: string
  reliability: Reliability
  is_verified: boolean
  expected_day: number | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface IncomeTransaction {
  id: string
  user_id: string
  source_id: string | null
  account_id: string | null
  amount: number
  currency: string
  date: string
  status: IncomeStatus
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ExtraordinaryIncome {
  id: string
  user_id: string
  name: string
  expected_amount: number
  currency: string
  expected_date: string | null
  status: 'esperado' | 'recibido' | 'cancelado'
  received_amount: number | null
  received_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ExtraordinaryIncomeAllocation {
  id: string
  user_id: string
  extraordinary_income_id: string
  target_type: 'deuda' | 'meta' | 'cuenta' | 'libre'
  target_id: string | null
  percent: number
  created_at: string
}

export interface ExpenseCategory {
  id: string
  user_id: string
  name: string
  icon: string | null
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ExpenseSubcategory {
  id: string
  user_id: string
  category_id: string
  name: string
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  account_id: string | null
  credit_card_id: string | null
  category_id: string | null
  subcategory_id: string | null
  amount: number
  currency: string
  date: string
  payment_method: PaymentMethod
  merchant: string | null
  description: string | null
  tags: string[]
  is_recurring: boolean
  necessity: 'necesario' | 'deseo'
  is_emotional: boolean
  status: 'confirmado' | 'pendiente' | 'anulado'
  receipt_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreditCard {
  id: string
  user_id: string
  name: string
  issuer: string | null
  credit_line: number
  cash_line: number
  currency: string
  tea_purchases: number | null
  tea_cash: number | null
  tea_usd: number | null
  membership_fee: number
  insurance_monthly: number
  closing_day: number | null
  payment_day: number | null
  benefits: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Debt {
  id: string
  user_id: string
  creditor: string
  name: string | null
  type: 'revolvente' | 'cuotas' | 'prestamo_personal' | 'sin_intereses' | 'otro'
  credit_card_id: string | null
  initial_balance: number
  currency: string
  tea: number | null
  tcea: number | null
  rate_type: 'tea' | 'tcea' | 'sin_interes'
  installment_amount: number | null
  minimum_payment: number | null
  num_installments: number | null
  installments_paid: number
  insurance_monthly: number
  fees_monthly: number
  due_day: number | null
  target_payoff_date: string | null
  priority: 'baja' | 'media' | 'alta' | 'muy_alta'
  status: 'activa' | 'pagada' | 'en_mora' | 'congelada' | 'no_activada'
  allows_early_payoff: 'si' | 'no' | 'desconocido'
  payment_strategy: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DebtPayment {
  id: string
  user_id: string
  debt_id: string
  account_id: string | null
  date: string
  amount: number
  principal_amount: number
  interest_amount: number
  insurance_amount: number
  fees_amount: number
  penalty_amount: number
  is_extra_payment: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Transfer {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string
  amount: number
  currency: string
  date: string
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface MonthlyBudget {
  id: string
  user_id: string
  year: number
  month: number
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface BudgetCategory {
  id: string
  user_id: string
  budget_id: string
  category_id: string
  planned_amount: number
  is_protected: boolean
  created_at: string
  updated_at: string
}

export interface RecurringExpense {
  id: string
  user_id: string
  name: string
  amount: number
  currency: string
  category_id: string | null
  due_day: number | null
  is_active: boolean
  needs_verification: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  kind:
    | 'fondo_emergencia'
    | 'eliminar_deuda'
    | 'viaje'
    | 'vivienda'
    | 'inversion'
    | 'retiro'
    | 'mudanza'
    | 'extranjero'
    | 'otro'
  target_amount: number
  currency: string
  target_date: string | null
  monthly_contribution: number | null
  priority: 'baja' | 'media' | 'alta' | 'muy_alta'
  status: 'activa' | 'pausada' | 'lograda' | 'cancelada'
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SavingsContribution {
  id: string
  user_id: string
  goal_id: string
  account_id: string | null
  date: string
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Receivable {
  id: string
  user_id: string
  person: string
  original_amount: number
  currency: string
  expected_date: string | null
  status: 'pendiente' | 'parcial' | 'cobrado' | 'incobrable'
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ReceivablePayment {
  id: string
  user_id: string
  receivable_id: string
  account_id: string | null
  date: string
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Asset {
  id: string
  user_id: string
  name: string
  kind: 'inversion' | 'fondo' | 'bien' | 'otro'
  value: number
  currency: string
  is_verified: boolean
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// Mapa nombre-de-tabla → tipo de fila, usado por el hook CRUD genérico.
export interface TableRows {
  profiles: Profile
  audit_logs: AuditLog
  accounts: Account
  income_sources: IncomeSource
  income_transactions: IncomeTransaction
  extraordinary_incomes: ExtraordinaryIncome
  extraordinary_income_allocations: ExtraordinaryIncomeAllocation
  expense_categories: ExpenseCategory
  expense_subcategories: ExpenseSubcategory
  expenses: Expense
  transfers: Transfer
  credit_cards: CreditCard
  debts: Debt
  debt_payments: DebtPayment
  monthly_budgets: MonthlyBudget
  budget_categories: BudgetCategory
  recurring_expenses: RecurringExpense
  savings_goals: SavingsGoal
  savings_contributions: SavingsContribution
  receivables: Receivable
  receivable_payments: ReceivablePayment
  assets: Asset
}

export type TableName = keyof TableRows
