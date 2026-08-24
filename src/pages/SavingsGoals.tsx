import { EntityCrud } from '@/components/EntityCrud'
import type { SavingsGoal } from '@/types/database'

export default function SavingsGoals() {
  return (
    <EntityCrud<SavingsGoal>
      table="savings_goals"
      title="Metas de ahorro"
      description="Define objetivos de ahorro y su progreso."
      orderBy="created_at"
      labelField="name"
      dateField="target_date"
      amountField="current_amount"
      amountTone="positive"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'target_amount', label: 'Meta', type: 'number', required: true },
        { name: 'current_amount', label: 'Ahorrado', type: 'number', required: true },
        { name: 'target_date', label: 'Fecha objetivo', type: 'date' },
      ]}
    />
  )
}
