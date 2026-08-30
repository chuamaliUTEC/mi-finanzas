import { NavLink, Outlet } from 'react-router-dom'
import { NAV_ITEMS, MOBILE_MORE_LABEL } from '@/constants/nav'
import { useAuth } from '@/hooks/authContext'

function navLinkClass(isActive: boolean, mobile = false): string {
  const base = mobile
    ? 'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors'
    : 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
  const focus =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-600'
  const state = isActive
    ? mobile
      ? 'text-lavender-700'
      : 'bg-lavender-50 text-lavender-700'
    : mobile
      ? 'text-ink-500 hover:text-ink-700'
      : 'text-ink-600 hover:bg-ink-50'
  return `${base} ${focus} ${state}`
}

export function AppShell() {
  const { profile, signOut } = useAuth()
  const mobileItems = NAV_ITEMS.filter((item) => item.mobilePrimary)

  return (
    <div className="min-h-screen bg-ink-50 md:flex">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-lavender-700 focus:shadow-card"
      >
        Saltar al contenido
      </a>

      <aside className="hidden w-64 flex-col border-r border-ink-100 bg-white p-4 md:flex">
        <div className="mb-6 px-2">
          <p className="text-lg font-semibold text-ink-900">Mi Finanzas</p>
          {profile?.full_name && <p className="text-sm text-ink-500">{profile.full_name}</p>}
        </div>
        <nav aria-label="Navegación principal" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={() => void signOut()} className="btn-secondary mt-4">
          Cerrar sesión
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <main id="contenido" className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">
          <Outlet />
        </main>

        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-10 flex border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {mobileItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => navLinkClass(isActive, true)}
            >
              <span aria-hidden="true" className="text-lg">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/mas" className={({ isActive }) => navLinkClass(isActive, true)}>
            <span aria-hidden="true" className="text-lg">
              ⋯
            </span>
            {MOBILE_MORE_LABEL}
          </NavLink>
        </nav>
      </div>
    </div>
  )
}
