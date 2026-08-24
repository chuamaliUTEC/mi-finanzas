import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS, MOBILE_PRIMARY_ITEMS, MOBILE_MORE_ITEMS } from '@/constants/nav'

export function AppLayout() {
  const { signOut, user } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

  const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  const bottomLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
      isActive ? 'text-brand-700' : 'text-gray-500'
    }`

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Sidebar: desktop only */}
      <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto">
        <div className="p-4">
          <h1 className="text-lg font-semibold text-brand-700">💜 Mi Finanzas</h1>
        </div>
        <nav className="space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'} className={sidebarLinkClass}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h1 className="text-base font-semibold text-brand-700 md:hidden">💜 Mi Finanzas</h1>
          <div className="ml-auto flex items-center gap-3">
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

        <main className="flex-1 p-4 pb-20 sm:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav: mobile only */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-gray-200 bg-white shadow-[0_-1px_4px_rgba(0,0,0,0.05)] md:hidden">
        {MOBILE_PRIMARY_ITEMS.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={bottomLinkClass}>
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
            moreOpen ? 'text-brand-700' : 'text-gray-500'
          }`}
        >
          <span className="text-lg leading-none">☰</span>
          Más
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-14 z-20 max-h-[70vh] overflow-y-auto border-t border-gray-200 bg-white p-2 shadow-lg md:hidden">
          <div className="grid grid-cols-3 gap-1">
            {MOBILE_MORE_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-1 rounded-md px-2 py-3 text-xs text-gray-600 hover:bg-gray-100"
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
