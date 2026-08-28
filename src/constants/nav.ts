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
 * Navegación reducida a lo esencial: gasto, ingreso, deuda y presupuesto.
 * Las páginas que no aparecen aquí (Departamento, Retiro, Simulador,
 * Inteligencia, Memoria financiera, Documentos, Calendario, Cuentas,
 * Administración, Pronóstico) ya no existen en el código — se borraron por
 * completo, no solo del menú.
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
