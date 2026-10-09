import type { Outcome } from '@/types'
import { outcomeLabel } from '@/lib/ranking'

const tone: Record<Outcome, string> = {
  destaque: 'bg-positive/12 text-positive',
  salvo: 'bg-surface text-muted',
  eliminatoria: 'bg-accent-soft text-accent',
  eliminado: 'bg-negative/12 text-negative line-through decoration-negative/40',
  participou: 'bg-surface text-subtle',
  campeao: 'bg-accent text-bg',
  vice: 'bg-accent-soft text-accent',
}

export function OutcomeBadge({ outcome, short = false }: { outcome: Outcome | null; short?: boolean }) {
  if (!outcome) return <span className="text-sm text-subtle">—</span>
  const label = short && outcome === 'eliminatoria' ? 'Eliminação' : outcomeLabel[outcome]
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${tone[outcome]}`} title={outcomeLabel[outcome]}>
      {label}
    </span>
  )
}
