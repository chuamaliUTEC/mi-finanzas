interface PagePlaceholderProps {
  question: string
  phase: string
}

// Placeholder de Fase 0: la navegación y el shell ya funcionan; el
// contenido real de cada sección se construye en su fase correspondiente
// (ver docs/ARQUITECTURA.md).
export function PagePlaceholder({ question, phase }: PagePlaceholderProps) {
  return (
    <div className="card max-w-lg">
      <p className="text-sm font-medium text-lavender-600">{question}</p>
      <p className="mt-2 text-sm text-ink-500">
        Esta sección se construye en la {phase}. Por ahora solo confirma que la
        navegación, la autenticación y el diseño base funcionan.
      </p>
    </div>
  )
}
