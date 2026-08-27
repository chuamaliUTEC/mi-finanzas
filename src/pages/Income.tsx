import { EntityCrud } from '@/components/EntityCrud'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import type { IncomeSource, IncomeTransaction } from '@/types/database'

export default function Income() {
  const { data: sources, loading } = useSupabaseTable<IncomeSource>('income_sources', {
    orderBy: 'name',
    ascending: true,
  })

  if (loading) return <p className="text-sm text-gray-500">Cargando…</p>

  return (
    <EntityCrud<IncomeTransaction>
      table="income_transactions"
      title="Ingresos"
      description="Registra cada ingreso con su fuente. Se guarda en Supabase y queda disponible en cualquier dispositivo."
      orderBy="received_at"
      labelField="description"
      dateField="received_at"
      amountField="amount"
      amountTone="positive"
      fields={[
        { name: 'description', label: 'Descripción', type: 'text', required: true },
        { name: 'amount', label: 'Monto', type: 'number', required: true },
        {
          name: 'source_id',
          label: 'Fuente de ingreso',
          type: 'select',
          placeholder: 'Sin fuente específica',
          options: sources.map((s) => ({ value: s.id, label: s.name })),
        },
        { name: 'received_at', label: 'Fecha', type: 'date', required: true },
      ]}
    />
  )
}
