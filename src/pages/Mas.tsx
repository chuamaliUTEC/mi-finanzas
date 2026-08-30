import { Link } from 'react-router-dom'
import { NAV_ITEMS } from '@/constants/nav'
import { useAuth } from '@/hooks/authContext'
import { PageHeader } from '@/components/ui/PageHeader'

// Índice de secciones. En mobile es el destino de "Más" (bottom nav); en
// escritorio funciona como mapa completo de la plataforma.
export function Mas() {
  const { signOut } = useAuth()
  const secondaryItems = NAV_ITEMS.filter((item) => !item.mobilePrimary)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Más" subtitle="Todas las secciones." />
      <div className="grid gap-2 sm:grid-cols-2">
        {secondaryItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card flex items-center gap-3 !p-4 text-sm font-medium text-ink-700 transition-shadow hover:shadow-md"
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
      <button onClick={() => void signOut()} className="btn-secondary mt-6 w-full sm:w-auto">
        Cerrar sesión
      </button>
    </div>
  )
}
