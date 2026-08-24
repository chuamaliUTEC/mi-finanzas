import { EntityCrud } from '@/components/EntityCrud'
import type { Expense } from '@/types/database'

export default function Expenses() {
  return (
    <EntityCrud<Expense>
      table="expenses"
      title="Gastos"
      description="Registra cada gasto. Se guarda en Supabase y queda disponible en cualquier dispositivo."
      orderBy="spent_at"
      labelField="description"
      dateField="spent_at"
      amountField="amount"
      amountTone="negative"
      fields={[
        { name: 'description', label: 'Descripción', type: 'text', required: true },
        { name: 'amount', label: 'Monto', type: 'number', required: true },
        { name: 'spent_at', label: 'Fecha', type: 'date', required: true },
      ]}
    />
  )
}
