import { EntityCrud } from '@/components/EntityCrud'
import type { Debt } from '@/types/database'

export default function Debts() {
  return (
    <EntityCrud<Debt>
      table="debts"
      title="Deudas"
      description="Préstamos y obligaciones pendientes. Deja el saldo vacío si aún no lo confirmas."
      orderBy="created_at"
      labelField="name"
      amountField="current_balance"
      amountTone="negative"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'creditor', label: 'Acreedor', type: 'text' },
        { name: 'original_amount', label: 'Monto original (vacío = por confirmar)', type: 'number' },
        { name: 'current_balance', label: 'Saldo actual (vacío = por confirmar)', type: 'number' },
      ]}
    />
  )
}
