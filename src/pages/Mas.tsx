import { Link } from 'react-router-dom'
import { NAV_ITEMS } from '@/constants/nav'
import { useAuth } from '@/hooks/useAuth'

export function Mas() {
  const { signOut } = useAuth()
  const secondaryItems = NAV_ITEMS.filter((item) => !item.mobilePrimary)

  return (
    <div className="space-y-2 md:hidden">
      <h1 className="mb-4 text-lg font-semibold text-ink-900">Más</h1>
      {secondaryItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="card flex items-center gap-3 !p-4 text-sm font-medium text-ink-700"
        >
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </Link>
      ))}
      <button onClick={() => void signOut()} className="btn-secondary mt-4 w-full">
        Cerrar sesión
      </button>
    </div>
  )
}
