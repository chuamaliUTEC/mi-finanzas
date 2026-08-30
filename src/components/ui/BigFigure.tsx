import { formatCurrency } from '@/utils/format'

interface BigFigureProps {
  label: string
  amount: number
  currency?: string
  hint?: string
  tone?: 'default' | 'positive' | 'critical'
}

// "Una cifra a la vez" (secc. 13): el número protagonista de cada pantalla.
export function BigFigure({ label, amount, currency = 'PEN', hint, tone = 'default' }: BigFigureProps) {
  const toneClass =
    tone === 'positive' ? 'text-positive' : tone === 'critical' ? 'text-critical' : 'text-ink-900'
  return (
    <div className="card">
      <p className="text-sm font-medium text-ink-500">{label}</p>
      <p className={`mt-1 text-4xl font-semibold tracking-tight ${toneClass}`}>
        {formatCurrency(amount, currency)}
      </p>
      {hint && <p className="mt-2 text-sm text-ink-500">{hint}</p>}
    </div>
  )
}
