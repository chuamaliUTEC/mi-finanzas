import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS } from '@/constants/nav'

export function AppLayout() {
  const { signOut, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Sidebar: hidden on mobile, visible from md up */}
      <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white md:block">
        <div className="p-4">
          <h1 className="text-lg font-semibold text-brand-700">Mi Finanzas</h1>
        </div>
        <nav className="space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top bar: shown on all sizes, carries the mobile menu toggle */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:justify-end">
          <button
            type="button"
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Mobile nav drawer */}
        {menuOpen && (
          <nav className="space-y-1 border-b border-gray-200 bg-white px-2 py-2 md:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
