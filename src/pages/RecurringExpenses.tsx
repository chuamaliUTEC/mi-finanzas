import { EntityCrud } from '@/components/EntityCrud'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import type { ExpenseCategory, RecurringExpense } from '@/types/database'

export default function RecurringExpenses() {
  const { data: categories, loading } = useSupabaseTable<ExpenseCategory>('expense_categories', {
    orderBy: 'name',
    ascending: true,
  })

  if (loading) return <p className="text-sm text-gray-500">Cargando…</p>

  return (
    <EntityCrud<RecurringExpense>
      table="recurring_expenses"
      title="🔁 Gastos recurrentes"
      description="Suscripciones y gastos fijos que se repiten (Spotify, internet, comida del gato...). Deja la fecha vacía si no sabes el día exacto de cobro."
      orderBy="name"
      ascending
      labelField="name"
      amountField="amount"
      amountTone="negative"
      dateField="next_due_date"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'amount', label: 'Monto', type: 'number', required: true },
        {
          name: 'category_id',
          label: 'Categoría',
          type: 'select',
          placeholder: 'Sin categoría',
          options: categories.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          name: 'frequency',
          label: 'Frecuencia',
          type: 'select',
          required: true,
          defaultValue: 'monthly',
          options: [
            { value: 'weekly', label: 'Semanal' },
            { value: 'biweekly', label: 'Quincenal' },
            { value: 'monthly', label: 'Mensual' },
            { value: 'yearly', label: 'Anual' },
          ],
        },
        { name: 'next_due_date', label: 'Próxima fecha de cobro (opcional)', type: 'date', defaultValue: '' },
      ]}
    />
  )
}
