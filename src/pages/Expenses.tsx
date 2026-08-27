import { EntityCrud } from '@/components/EntityCrud'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import type { Expense, ExpenseCategory } from '@/types/database'

export default function Expenses() {
  const { data: categories, loading } = useSupabaseTable<ExpenseCategory>('expense_categories', {
    orderBy: 'name',
    ascending: true,
  })

  if (loading) return <p className="text-sm text-gray-500">Cargando…</p>

  return (
    <EntityCrud<Expense>
      table="expenses"
      title="Gastos"
      description="Registra cada gasto con su categoría. Se guarda en Supabase y queda disponible en cualquier dispositivo."
      orderBy="spent_at"
      labelField="description"
      dateField="spent_at"
      amountField="amount"
      amountTone="negative"
      fields={[
        { name: 'description', label: 'Descripción', type: 'text', required: true },
        { name: 'amount', label: 'Monto', type: 'number', required: true },
        {
          name: 'category_id',
          label: 'Categoría',
          type: 'select',
          required: true,
          placeholder: 'Elige una categoría',
          options: categories.map((c) => ({ value: c.id, label: c.name })),
        },
        { name: 'spent_at', label: 'Fecha', type: 'date', required: true },
      ]}
    />
  )
}
