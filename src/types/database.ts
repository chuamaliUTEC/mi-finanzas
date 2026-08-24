// Hand-written types mirroring supabase/migrations/*.sql.
// If the schema changes, update this file (or regenerate with `supabase gen types typescript`).

export type UUID = string
export type ISODate = string // YYYY-MM-DD
export type ISODateTime = string

export interface Profile {
  id: UUID
  full_name: string | null
  currency: string
  locale: string
  timezone: string
  avatar_url: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment' | 'other'

export interface Account {
  id: UUID
  user_id: UUID
  name: string
  type: AccountType
  currency: string
  opening_balance: number
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface IncomeSource {
  id: UUID
  user_id: UUID
  name: string
  is_recurring: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface IncomeTransaction {
  id: UUID
  user_id: UUID
  account_id: UUID | null
  source_id: UUID | null
  amount: number
  currency: string
  description: string | null
  received_at: ISODate
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ExpenseCategory {
  id: UUID
  user_id: UUID
  name: string
  icon: string | null
  color: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface Expense {
  id: UUID
  user_id: UUID
  account_id: UUID | null
  category_id: UUID | null
  amount: number
  currency: string
  description: string | null
  spent_at: ISODate
  created_at: ISODateTime
  updated_at: ISODateTime
}

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export interface RecurringExpense {
  id: UUID
  user_id: UUID
  category_id: UUID | null
  name: string
  amount: number
  frequency: RecurringFrequency
  next_due_date: ISODate
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

export type DebtStatus = 'active' | 'paid_off' | 'defaulted'

export interface Debt {
  id: UUID
  user_id: UUID
  name: string
  creditor: string | null
  original_amount: number
  current_balance: number
  interest_rate: number
  minimum_payment: number | null
  due_day: number | null
  status: DebtStatus
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface DebtPayment {
  id: UUID
  user_id: UUID
  debt_id: UUID
  amount: number
  paid_at: ISODate
  notes: string | null
  created_at: ISODateTime
}

export interface CreditCard {
  id: UUID
  user_id: UUID
  name: string
  issuer: string | null
  last_four: string | null
  credit_limit: number
  current_balance: number
  statement_day: number | null
  payment_due_day: number | null
  interest_rate: number
  created_at: ISODateTime
  updated_at: ISODateTime
}

export type CreditCardTransactionType = 'purchase' | 'payment' | 'fee' | 'refund' | 'interest'

export interface CreditCardTransaction {
  id: UUID
  user_id: UUID
  credit_card_id: UUID
  amount: number
  description: string | null
  transaction_type: CreditCardTransactionType
  occurred_at: ISODate
  installments: number | null
  created_at: ISODateTime
}

export type ReceivableStatus = 'pending' | 'partially_paid' | 'paid' | 'written_off'

export interface Receivable {
  id: UUID
  user_id: UUID
  debtor_name: string
  original_amount: number
  outstanding_amount: number
  due_date: ISODate | null
  status: ReceivableStatus
  notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ReceivablePayment {
  id: UUID
  user_id: UUID
  receivable_id: UUID
  amount: number
  paid_at: ISODate
  created_at: ISODateTime
}

export type SavingsGoalStatus = 'active' | 'completed' | 'abandoned'

export interface SavingsGoal {
  id: UUID
  user_id: UUID
  name: string
  target_amount: number
  current_amount: number
  target_date: ISODate | null
  status: SavingsGoalStatus
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface SavingsContribution {
  id: UUID
  user_id: UUID
  goal_id: UUID
  amount: number
  contributed_at: ISODate
  created_at: ISODateTime
}

export interface MonthlyBudget {
  id: UUID
  user_id: UUID
  period_month: ISODate
  planned_income: number
  planned_expenses: number
  notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface BudgetCategory {
  id: UUID
  user_id: UUID
  budget_id: UUID
  category_id: UUID | null
  planned_amount: number
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface Forecast {
  id: UUID
  user_id: UUID
  forecast_date: ISODate
  projected_income: number
  projected_expenses: number
  projected_balance: number
  method: string
  created_at: ISODateTime
}

export interface ForecastActual {
  id: UUID
  user_id: UUID
  forecast_id: UUID
  actual_income: number
  actual_expenses: number
  actual_balance: number
  recorded_at: ISODate
  created_at: ISODateTime
}

export type AlertType = 'overspend' | 'due_date' | 'low_balance' | 'goal_at_risk' | 'anomaly' | 'other'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface FinancialAlert {
  id: UUID
  user_id: UUID
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string | null
  related_table: string | null
  related_id: UUID | null
  is_read: boolean
  created_at: ISODateTime
}

export interface FinancialEvent {
  id: UUID
  user_id: UUID
  event_type: string
  payload: Record<string, unknown>
  occurred_at: ISODateTime
}

export interface FinancialMemory {
  id: UUID
  user_id: UUID
  memory_key: string
  memory_value: Record<string, unknown>
  confidence: number
  source: string
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface FinancialSnapshot {
  id: UUID
  user_id: UUID
  snapshot_date: ISODate
  total_income: number
  total_expenses: number
  net_worth: number
  total_debt: number
  total_savings: number
  created_at: ISODateTime
}

export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed'

export interface RecommendationHistoryItem {
  id: UUID
  user_id: UUID
  category: string
  title: string
  description: string | null
  status: RecommendationStatus
  created_at: ISODateTime
  responded_at: ISODateTime | null
}

export interface LearningAdjustment {
  id: UUID
  user_id: UUID
  recommendation_id: UUID | null
  adjustment_type: string
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  reason: string | null
  created_at: ISODateTime
}

export interface UploadedFile {
  id: UUID
  user_id: UUID
  bucket_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  related_table: string | null
  related_id: UUID | null
  created_at: ISODateTime
}

export interface AuditLog {
  id: UUID
  user_id: UUID
  action: string
  table_name: string | null
  record_id: UUID | null
  changes: Record<string, unknown> | null
  created_at: ISODateTime
}
