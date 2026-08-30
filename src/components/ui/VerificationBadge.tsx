import type { VerificationStatus } from '@/types/database'

// Distinción visual entre una cifra confirmada y una proyección (secc. 13).
// Es la diferencia entre saber cuánto tienes y creer que lo sabes.

const STYLES: Record<VerificationStatus, { icon: string; label: string; className: string }> = {
  confirmado: {
    icon: '🟢',
    label: 'Confirmado',
    className: 'bg-positive/10 text-positive',
  },
  estimado: {
    icon: '🟡',
    label: 'Estimado',
    className: 'bg-warning/10 text-warning',
  },
  pendiente: {
    icon: '🔴',
    label: 'Pendiente',
    className: 'bg-critical/10 text-critical',
  },
  no_verificado: {
    icon: '⚪',
    label: 'No verificado',
    className: 'bg-ink-100 text-ink-500',
  },
}

interface VerificationBadgeProps {
  status: VerificationStatus
  /** Texto que reemplaza la etiqueta por defecto (ej. "Pendiente de cobro"). */
  label?: string
  title?: string
}

export function VerificationBadge({ status, label, title }: VerificationBadgeProps) {
  const style = STYLES[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
      title={title}
    >
      <span aria-hidden="true">{style.icon}</span>
      {label ?? style.label}
    </span>
  )
}
