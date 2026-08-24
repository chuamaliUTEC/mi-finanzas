import type { DataStatus } from '@/types/database'

const STATUS_LABEL: Record<DataStatus, string> = {
  actual: 'Actual',
  historico: 'Histórico',
  desactualizado: 'Desactualizado',
  confirmado: 'Confirmado',
  por_confirmar: 'Por confirmar',
}

const STATUS_CLASS: Record<DataStatus, string> = {
  actual: 'bg-brand-100 text-brand-700',
  historico: 'bg-gray-100 text-gray-500',
  desactualizado: 'bg-amber-100 text-amber-700',
  confirmado: 'bg-brand-100 text-brand-700',
  por_confirmar: 'bg-amber-100 text-amber-700',
}

export function StatusBadge({ status }: { status: DataStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** For nullable money fields where null means "unknown", not zero. */
export function UnknownAmount() {
  return <span className="text-xs font-medium text-amber-600">Por confirmar</span>
}
