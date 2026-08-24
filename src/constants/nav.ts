export interface NavItem {
  label: string
  path: string
  icon: string
}

/** Full navigation, shown in the desktop sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: '🏠' },
  { label: 'Ingresos', path: '/ingresos', icon: '💵' },
  { label: 'Gastos', path: '/gastos', icon: '💸' },
  { label: 'Deudas', path: '/deudas', icon: '💳' },
  { label: 'Tarjetas', path: '/tarjetas', icon: '💳' },
  { label: 'Me deben', path: '/me-deben', icon: '💰' },
  { label: 'Presupuestos', path: '/presupuestos', icon: '📊' },
  { label: 'Sobres', path: '/sobres', icon: '✉️' },
  { label: 'Metas', path: '/metas', icon: '🎯' },
  { label: 'Departamento', path: '/departamento', icon: '🏠' },
  { label: 'Retiro', path: '/retiro', icon: '👵' },
  { label: 'Forecast', path: '/forecast', icon: '🔮' },
  { label: 'Auditor', path: '/auditor', icon: '🔎' },
  { label: 'Aprendizaje', path: '/aprendizaje', icon: '📈' },
  { label: 'Recomendaciones', path: '/recomendaciones', icon: '💡' },
  { label: 'Simulador', path: '/simulador', icon: '🔮' },
  { label: 'Calendario', path: '/calendario', icon: '📅' },
  { label: 'Documentos', path: '/documentos', icon: '📁' },
  { label: 'Memoria financiera', path: '/memoria', icon: '🧠' },
]

/** Primary shortcuts shown in the mobile bottom nav (max 4 + "Más"). */
export const MOBILE_PRIMARY_ITEMS: NavItem[] = [
  { label: 'Inicio', path: '/', icon: '🏠' },
  { label: 'Gastos', path: '/gastos', icon: '💸' },
  { label: 'Deudas', path: '/deudas', icon: '💳' },
  { label: 'Metas', path: '/metas', icon: '🎯' },
]

/** Everything not in the mobile primary row, surfaced under "Más". */
export const MOBILE_MORE_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => !MOBILE_PRIMARY_ITEMS.some((primary) => primary.path === item.path),
)
