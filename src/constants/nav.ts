export interface NavItem {
  label: string
  path: string
  icon: string
}

export interface NavGroup {
  label: string
  icon: string
  /** If set, the group itself is a single link (no sub-items shown). */
  path?: string
  items?: NavItem[]
}

/**
 * Navegación reducida a lo que Carmen pidió mirar de momento: gasto, presupuesto
 * del próximo mes y cuánto lleva gastado. El resto de páginas (Cuentas, Metas,
 * Departamento, Retiro, Simulador, Inteligencia, Memoria financiera, Documentos,
 * Calendario, Administración) sigue existiendo y es accesible por su URL directa
 * — solo se sacaron del menú para no repetir el exceso de opciones que ya le
 * falló en otras apps. Si hace falta traer alguna de vuelta, es un cambio de un
 * minuto en este archivo.
 */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Dashboard', icon: '🏠', path: '/' },
  {
    label: 'Operación',
    icon: '💸',
    items: [
      { label: 'Ingresos', path: '/ingresos', icon: '💵' },
      { label: 'Gastos', path: '/gastos', icon: '💸' },
      { label: 'Gastos recurrentes', path: '/gastos-recurrentes', icon: '🔁' },
      { label: 'Deudas', path: '/deudas', icon: '💳' },
      { label: 'Tarjetas', path: '/tarjetas', icon: '💳' },
      { label: 'Me deben', path: '/me-deben', icon: '💰' },
    ],
  },
  {
    label: 'Presupuesto y análisis',
    icon: '📊',
    items: [
      { label: 'Análisis', path: '/analisis', icon: '📊' },
      { label: 'Sobres', path: '/sobres', icon: '✉️' },
      { label: 'Presupuestos', path: '/presupuestos', icon: '📋' },
      { label: 'Metas', path: '/metas', icon: '🎯' },
    ],
  },
]

/** Flat list of every navigable item, used by the mobile "Más" sheet and search. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) =>
  group.path ? [{ label: group.label, path: group.path, icon: group.icon }] : group.items ?? [],
)

/** Primary shortcuts shown in the mobile bottom nav (max 4 + "Más"). */
export const MOBILE_PRIMARY_ITEMS: NavItem[] = [
  { label: 'Inicio', path: '/', icon: '🏠' },
  { label: 'Gastos', path: '/gastos', icon: '💸' },
  { label: 'Deudas', path: '/deudas', icon: '💳' },
  { label: 'Análisis', path: '/analisis', icon: '📊' },
]
