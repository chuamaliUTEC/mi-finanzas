import { EntityCrud } from '@/components/EntityCrud'
import type { Receivable } from '@/types/database'

export default function Receivables() {
  return (
    <EntityCrud<Receivable>
      table="receivables"
      title="💰 Me deben"
      description="Dinero que terceros te deben a ti. Completamente separado de tus propias deudas."
      orderBy="created_at"
      labelField="debtor_name"
      dateField="due_date"
      amountField="outstanding_amount"
      amountTone="positive"
      fields={[
        { name: 'debtor_name', label: 'Quién te debe', type: 'text', required: true },
        { name: 'original_amount', label: 'Monto original', type: 'number', required: true },
        { name: 'outstanding_amount', label: 'Saldo pendiente', type: 'number', required: true },
        { name: 'due_date', label: 'Fecha esperada', type: 'date' },
      ]}
    />
  )
}
