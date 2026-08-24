import { EntityCrud } from '@/components/EntityCrud'
import type { ExpenseCategory } from '@/types/database'

export default function Categories() {
  return (
    <EntityCrud<ExpenseCategory>
      table="expense_categories"
      title="🏷️ Categorías de gasto"
      description="Define las categorías que usarás para clasificar tus gastos en toda la app."
      orderBy="name"
      ascending
      labelField="name"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'icon', label: 'Ícono (emoji, opcional)', type: 'text' },
        { name: 'color', label: 'Color (hex, opcional)', type: 'text' },
      ]}
    />
  )
}
