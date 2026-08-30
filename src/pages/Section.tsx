import { useLocation } from 'react-router-dom'
import { PagePlaceholder } from '@/components/ui/PagePlaceholder'
import { SECTIONS } from '@/constants/sections'

export function Section() {
  const { pathname } = useLocation()
  const section = SECTIONS[pathname] ?? { question: 'Próximamente', phase: 'una fase posterior' }
  return <PagePlaceholder question={section.question} phase={section.phase} />
}
