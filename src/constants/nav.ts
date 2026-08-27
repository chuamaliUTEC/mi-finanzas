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

/** Full navigation, grouped by the "¿Cómo estoy? / ¿Qué pasó? / ..." mental model. */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Dashboard', icon: '🏠', path: '/' },
  {
    label: 'Operación',
    icon: '💸',
    items: [
      { label: 'Ingresos', path: '/ingresos', icon: '💵' },
      { label: 'Gastos', path: '/gastos', icon: '💸' },
      { label: 'Cuentas', path: '/cuentas', icon: '🏦' },
      { label: 'Deudas', path: '/deudas', icon: '💳' },
      { label: 'Tarjetas', path: '/tarjetas', icon: '💳' },
      { label: 'Me deben', path: '/me-deben', icon: '💰' },
      { label: 'Gastos recurrentes', path: '/gastos-recurrentes', icon: '🔁' },
    ],
  },
  {
    label: 'Análisis',
    icon: '📊',
    items: [
      { label: 'Análisis', path: '/analisis', icon: '📊' },
      { label: 'Forecast', path: '/forecast', icon: '🔮' },
    ],
  },
  {
    label: 'Planificación',
    icon: '🎯',
    items: [
      { label: 'Presupuestos', path: '/presupuestos', icon: '📋' },
      { label: 'Sobres', path: '/sobres', icon: '✉️' },
      { label: 'Metas', path: '/metas', icon: '🎯' },
      { label: 'Departamento', path: '/departamento', icon: '🏠' },
      { label: 'Retiro', path: '/retiro', icon: '👵' },
      { label: 'Simulador', path: '/simulador', icon: '🔮' },
    ],
  },
  {
    label: 'Inteligencia',
    icon: '🧠',
    items: [
      { label: 'Inteligencia', path: '/inteligencia', icon: '🧠' },
      { label: 'Memoria financiera', path: '/memoria', icon: '🗂️' },
      { label: 'Documentos', path: '/documentos', icon: '📁' },
      { label: 'Calendario', path: '/calendario', icon: '📅' },
    ],
  },
  {
    label: 'Administración',
    icon: '⚙️',
    items: [
      { label: 'Cuestionario financiero', path: '/cuestionario', icon: '📝' },
      { label: 'Categorías', path: '/admin/categorias', icon: '🏷️' },
      { label: 'Tipos de ingreso', path: '/admin/ingresos', icon: '💵' },
      { label: 'Preferencias', path: '/admin/preferencias', icon: '⚙️' },
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
  { label: 'Metas', path: '/metas', icon: '🎯' },
]
