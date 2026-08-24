import { EntityCrud } from '@/components/EntityCrud'
import type { Debt } from '@/types/database'

export default function Debts() {
  return (
    <EntityCrud<Debt>
      table="debts"
      title="Deudas"
      description="Préstamos y obligaciones pendientes."
      orderBy="created_at"
      labelField="name"
      amountField="current_balance"
      amountTone="negative"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'creditor', label: 'Acreedor', type: 'text' },
        { name: 'original_amount', label: 'Monto original', type: 'number', required: true },
        { name: 'current_balance', label: 'Saldo actual', type: 'number', required: true },
      ]}
    />
  )
}
