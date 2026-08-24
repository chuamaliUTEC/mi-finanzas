import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { QuickAddModal } from '@/components/QuickAddModal'
import { NAV_GROUPS, MOBILE_PRIMARY_ITEMS } from '@/constants/nav'
import type { NavGroup } from '@/constants/nav'

function groupIsActive(group: NavGroup, pathname: string): boolean {
  if (group.path) return group.path === '/' ? pathname === '/' : pathname.startsWith(group.path)
  return (group.items ?? []).some((item) => pathname.startsWith(item.path))
}

export function AppLayout() {
  const { signOut, user } = useAuth()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(
    NAV_GROUPS.find((g) => groupIsActive(g, pathname))?.label ?? null,
  )

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
      <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto">
        <div className="p-4">
          <h1 className="text-lg font-semibold text-brand-700">💜 Mi Finanzas</h1>
        </div>
        <nav className="space-y-1 px-2 pb-4">
          {NAV_GROUPS.map((group) =>
            group.path ? (
              <NavLink key={group.label} to={group.path} end className={sidebarLinkClass}>
                <span>{group.icon}</span>
                {group.label}
              </NavLink>
            ) : (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => setOpenGroup((g) => (g === group.label ? null : group.label))}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
                    groupIsActive(group, pathname) ? 'text-brand-700' : 'text-gray-600'
                  } hover:bg-gray-100`}
                >
                  <span className="flex items-center gap-2">
                    <span>{group.icon}</span>
                    {group.label}
                  </span>
                  <span className={`text-xs transition-transform ${openGroup === group.label ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
                {openGroup === group.label && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-gray-100 pl-3">
                    {group.items?.map((item) => (
                      <NavLink key={item.path} to={item.path} className={sidebarLinkClass}>
                        <span>{item.icon}</span>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h1 className="text-base font-semibold text-brand-700 md:hidden">💜 Mi Finanzas</h1>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              + Registrar
            </button>
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

      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} />}

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
        <div className="fixed inset-x-0 bottom-14 z-20 max-h-[70vh] overflow-y-auto border-t border-gray-200 bg-white p-3 shadow-lg md:hidden">
          {NAV_GROUPS.filter((g) => !MOBILE_PRIMARY_ITEMS.some((p) => p.path === g.path)).map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.icon} {group.label}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {(group.path ? [{ label: group.label, path: group.path, icon: group.icon }] : group.items ?? []).map(
                  (item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className="flex flex-col items-center gap-1 rounded-md px-2 py-3 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      <span className="text-lg leading-none">{item.icon}</span>
                      {item.label}
                    </NavLink>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
