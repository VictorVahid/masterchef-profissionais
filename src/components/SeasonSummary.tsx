import type { Episode } from '@/types'
import type { Standing } from '@/lib/ranking'

interface Props {
  episode: Episode
  standings: Standing[]
}

export function SeasonSummary({ episode, standings }: Props) {
  const active = standings.filter((s) => s.status === 'ativo')
  const pins = standings.reduce((sum, s) => sum + s.pins, 0)
  const veterans = active.filter((s) => s.participant.veteran).length

  const stats = [
    { label: 'Na disputa', value: String(active.length), note: `de ${standings.length}` },
    { label: 'Veteranos', value: String(veterans), note: `× ${active.length - veterans} estreantes` },
    { label: 'Pins', value: String(pins), note: 'conquistados' },
    { label: 'Eliminados', value: String(standings.length - active.length), note: `até o EP ${episode.number}` },
  ]

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-bg px-5 py-4">
          <dt className="text-xs uppercase tracking-[0.08em] text-subtle">{s.label}</dt>
          <dd className="mt-1 flex items-baseline gap-1.5 font-serif text-2xl tracking-tight">
            {s.value}
            <span className="truncate font-sans text-xs text-subtle">{s.note}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
