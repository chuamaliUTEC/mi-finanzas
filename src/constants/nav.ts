export interface NavItem {
  to: string
  label: string
  icon: string
  mobilePrimary?: boolean
}

// Navegación completa (sidebar de escritorio). El subconjunto con
// mobilePrimary=true es el que se muestra en el bottom nav de mobile
// (secc. 35): Inicio, Registrar, Deudas, Metas, Más.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Inicio', icon: '💵', mobilePrimary: true },
  { to: '/registrar', label: 'Registrar', icon: '➕', mobilePrimary: true },
  { to: '/cuentas', label: 'Cuentas', icon: '🏦' },
  { to: '/ingresos', label: 'Ingresos', icon: '💰' },
  { to: '/me-deben', label: 'Me deben', icon: '🤝' },
  { to: '/deudas', label: 'Deudas y tarjetas', icon: '💳', mobilePrimary: true },
  { to: '/presupuesto', label: 'Presupuesto', icon: '📊' },
  { to: '/metas', label: 'Metas', icon: '🎯', mobilePrimary: true },
  { to: '/decisiones', label: '¿Qué debo hacer?', icon: '🧠' },
  { to: '/mi-situacion', label: 'Mi situación', icon: '🧭' },
  { to: '/calendario', label: 'Calendario', icon: '📅' },
  { to: '/pronostico', label: 'Pronóstico', icon: '📈' },
  { to: '/reportes', label: 'Reportes', icon: '🗂️' },
  { to: '/reglas', label: 'Mis reglas', icon: '📐' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️' },
]

export const MOBILE_MORE_LABEL = 'Más'
