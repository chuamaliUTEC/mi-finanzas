// Pregunta central y fase de construcción de cada sección, usadas por el
// placeholder de Fase 0 (ver src/pages/Section.tsx).
export const SECTIONS: Record<string, { question: string; phase: string }> = {
  '/': { question: '¿Cuánto puedo gastar?', phase: 'Fase 4 (Dashboard)' },
  '/registrar': { question: '¿Qué movimiento quieres registrar?', phase: 'Fase 1 (Núcleo financiero)' },
  '/cuentas': { question: '¿Cuánto dinero tengo realmente?', phase: 'Fase 1 (Núcleo financiero)' },
  '/deudas': { question: '¿Cuánto debo?', phase: 'Fase 2 (Deudas)' },
  '/presupuesto': { question: '¿Estoy cumpliendo mi presupuesto?', phase: 'Fase 3 (Presupuesto)' },
  '/metas': { question: '¿Cómo voy con mis metas?', phase: 'Fase 5 (Metas)' },
  '/decisiones': { question: '¿Qué debería hacer hoy?', phase: 'Fase 6 (Inteligencia)' },
  '/calendario': { question: '¿Qué tengo que pagar?', phase: 'Fase 6 (Inteligencia)' },
  '/pronostico': { question: '¿Qué pasará con mis finanzas?', phase: 'Fase 7 (Forecasting)' },
  '/reportes': { question: '¿Cómo evolucionaron mis finanzas?', phase: 'una fase posterior al núcleo financiero' },
  '/reglas': { question: '¿Qué reglas gobiernan mis decisiones?', phase: 'Fase 6 (Inteligencia)' },
  '/configuracion': { question: '¿Cómo quieres configurar tu cuenta?', phase: 'una fase posterior' },
}
