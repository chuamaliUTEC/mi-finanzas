interface StatCardProps {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative'
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-gray-900',
  positive: 'text-brand-600',
  negative: 'text-red-600',
}

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClasses[tone]}`}>{value}</p>
    </div>
  )
}
