import { EntityCrud } from '@/components/EntityCrud'
import type { IncomeSource } from '@/types/database'

export default function IncomeTypes() {
  return (
    <EntityCrud<IncomeSource>
      table="income_sources"
      title="💵 Tipos de ingreso"
      description="Fuentes de ingreso (salario, consultoría, bonos...). Se usan al registrar un ingreso."
      orderBy="name"
      ascending
      labelField="name"
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'source_type', label: 'Tipo (fijo/variable/extraordinario/destinado_especifico)', type: 'text', defaultValue: 'fijo' },
        { name: 'frequency', label: 'Frecuencia (semanal/quincenal/mensual/irregular)', type: 'text' },
        { name: 'earmarked_for', label: 'Destinado a (si aplica)', type: 'text' },
      ]}
    />
  )
}
