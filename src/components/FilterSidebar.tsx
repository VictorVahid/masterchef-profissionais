import { useMemo, useState, type ReactNode } from 'react'
import type { Episode } from '@/types'
import type { Standing } from '@/lib/ranking'
import { Avatar } from './Avatar'
import { CloseIcon, HeartIcon, PinIcon, SearchIcon } from './icons'
import { useFavorites } from '@/hooks/useFavorites'

interface Props {
  episodes: Episode[]
  standings: Standing[]
  selectedEpisode: number
  onSelectEpisode: (n: number) => void
  selectedParticipant: string | null
  onSelectParticipant: (id: string | null) => void
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function FilterSidebar({
  episodes,
  standings,
  selectedEpisode,
  onSelectEpisode,
  selectedParticipant,
  onSelectParticipant,
}: Props) {
  const [query, setQuery] = useState('')
  const { has } = useFavorites()

  const people = useMemo(() => {
    const q = normalize(query.trim())
    const sorted = [...standings].sort(
      (a, b) =>
        Number(has(b.participant.id)) - Number(has(a.participant.id)) ||
        a.participant.name.localeCompare(b.participant.name, 'pt-BR'),
    )
    return q
      ? sorted.filter((s) => normalize(`${s.participant.name} ${s.participant.specialty}`).includes(q))
      : sorted
  }, [standings, query, has])

  return (
    <aside className="min-w-0 space-y-8 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-2">
      {/* Episódios */}
      <section>
        <SectionTitle>Episódio</SectionTitle>
        <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-8 lg:grid-cols-1 lg:gap-0.5">
          {episodes.map((ep) => {
            const active = ep.number === selectedEpisode
            return (
              <li key={ep.number}>
                <button
                  type="button"
                  onClick={() => onSelectEpisode(ep.number)}
                  aria-pressed={active}
                  title={ep.title}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors lg:border-transparent ${
                    active
                      ? 'border-accent/40 bg-accent-soft text-fg lg:border-transparent'
                      : 'border-line text-muted hover:bg-surface hover:text-fg'
                  }`}
                >
                  <span className={`font-medium tabular-nums ${active ? 'text-accent' : ''}`}>EP {ep.number}</span>
                  <span className="hidden min-w-0 flex-1 truncate lg:block">{ep.title}</span>
                  {ep.number === 1 && (
                    <PinIcon className="hidden size-3.5 shrink-0 text-accent lg:block" aria-label="Campeão fixado" />
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Participantes */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle className="mb-0">Participante</SectionTitle>
          {selectedParticipant && (
            <button
              type="button"
              onClick={() => onSelectParticipant(null)}
              className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Limpar
            </button>
          )}
        </div>

        <label className="relative mb-2 block">
          <span className="sr-only">Buscar participante</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou especialidade"
            className="w-full rounded-lg border border-line bg-elevated py-2 pl-9 pr-3 text-sm placeholder:text-subtle focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
        </label>

        {/* Celular: carrossel horizontal de fotos · Desktop: lista */}
        <ul className="scrollbar-none -mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0">
          {people.map(({ participant: p, status }) => {
            const active = p.id === selectedParticipant
            return (
              <li key={p.id} className="shrink-0 snap-start lg:shrink">
                <button
                  type="button"
                  onClick={() => onSelectParticipant(active ? null : p.id)}
                  aria-pressed={active}
                  title={p.name}
                  className={`flex w-[4.5rem] flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center text-xs transition-colors lg:w-full lg:flex-row lg:gap-3 lg:rounded-lg lg:px-2 lg:py-1.5 lg:text-left lg:text-sm ${
                    active ? 'bg-accent-soft text-fg' : 'hover:bg-surface'
                  } ${status === 'eliminado' && !active ? 'text-subtle' : ''}`}
                >
                  <span className="relative">
                    <Avatar
                      participant={p}
                      size={28}
                      className={`size-12! lg:size-7! ${status === 'eliminado' ? 'opacity-50 grayscale' : ''} ${active ? 'ring-2 ring-accent' : ''}`}
                    />
                    {has(p.id) && (
                      <HeartIcon filled className="absolute -right-1 -top-1 size-3.5 text-accent lg:hidden" aria-label="Na sua torcida" />
                    )}
                  </span>
                  <span className="w-full min-w-0 truncate lg:flex-1">
                    <span className="lg:hidden">{p.name.split(' ')[0]}</span>
                    <span className="hidden lg:inline">{p.name}</span>
                  </span>
                  {has(p.id) && !active && (
                    <HeartIcon filled className="hidden size-3 shrink-0 text-accent lg:block" aria-label="Na sua torcida" />
                  )}
                  {active && <CloseIcon className="hidden size-3.5 text-muted lg:block" />}
                </button>
              </li>
            )
          })}
          {people.length === 0 && <li className="px-2 py-3 text-sm text-subtle">Ninguém encontrado.</li>}
        </ul>
      </section>
    </aside>
  )
}

function SectionTitle({ children, className = 'mb-3' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-xs font-medium uppercase tracking-[0.08em] text-subtle ${className}`}>{children}</h2>
}
