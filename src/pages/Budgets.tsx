import { EntityCrud } from '@/components/EntityCrud'
import type { MonthlyBudget } from '@/types/database'

export default function Budgets() {
  return (
    <EntityCrud<MonthlyBudget>
      table="monthly_budgets"
      title="Presupuestos mensuales"
      description="Planifica tus ingresos y gastos esperados por mes."
      orderBy="period_month"
      labelField="notes"
      dateField="period_month"
      amountField="planned_expenses"
      amountTone="negative"
      fields={[
        { name: 'period_month', label: 'Mes (1er día)', type: 'date', required: true },
        { name: 'planned_income', label: 'Ingreso planeado', type: 'number', required: true },
        { name: 'planned_expenses', label: 'Gasto planeado', type: 'number', required: true },
        { name: 'notes', label: 'Notas', type: 'text' },
      ]}
    />
  )
}
