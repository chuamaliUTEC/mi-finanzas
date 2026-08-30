import { PagePlaceholder } from '@/components/ui/PagePlaceholder'

export function Onboarding() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <PagePlaceholder
        question="¿Quién eres y cuál es tu punto de partida financiero?"
        phase="Fase 1 (Núcleo financiero)"
      />
    </div>
  )
}
