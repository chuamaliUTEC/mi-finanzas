export interface NavItem {
  label: string
  path: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/' },
  { label: 'Ingresos', path: '/ingresos' },
  { label: 'Gastos', path: '/gastos' },
  { label: 'Deudas', path: '/deudas' },
  { label: 'Tarjetas', path: '/tarjetas' },
  { label: 'Presupuestos', path: '/presupuestos' },
  { label: 'Metas', path: '/metas' },
]
