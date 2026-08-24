import { EntityCrud } from '@/components/EntityCrud'
import type { IncomeTransaction } from '@/types/database'

export default function Income() {
  return (
    <EntityCrud<IncomeTransaction>
      table="income_transactions"
      title="Ingresos"
      description="Registra cada ingreso. Se guarda en Supabase y queda disponible en cualquier dispositivo."
      orderBy="received_at"
      labelField="description"
      dateField="received_at"
      amountField="amount"
      amountTone="positive"
      fields={[
        { name: 'description', label: 'Descripción', type: 'text', required: true },
        { name: 'amount', label: 'Monto', type: 'number', required: true },
        { name: 'received_at', label: 'Fecha', type: 'date', required: true },
      ]}
    />
  )
}
