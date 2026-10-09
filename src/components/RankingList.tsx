import { useMemo, useState } from 'react'
import type { Episode, ParticipantStatus } from '@/types'
import type { Standing } from '@/lib/ranking'
import { Avatar } from './Avatar'
import { OutcomeBadge } from './OutcomeBadge'
import { FavoriteButton } from './FavoriteButton'
import { CompareIcon, HeartIcon, PinIcon, StarIcon } from './icons'
import { useFavorites } from '@/hooks/useFavorites'

type Filter = 'todos' | ParticipantStatus | 'veteranos' | 'estreantes' | 'torcida'

const filters: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'torcida', label: 'Minha torcida' },
  { id: 'ativo', label: 'Na disputa' },
  { id: 'veteranos', label: 'Veteranos' },
  { id: 'estreantes', label: 'Estreantes' },
  { id: 'eliminado', label: 'Eliminados' },
]

const matches = (s: Standing, f: Filter, fav: (id: string) => boolean) =>
  f === 'todos' ||
  (f === 'torcida' && fav(s.participant.id)) ||
  (f === 'veteranos' && s.participant.veteran) ||
  (f === 'estreantes' && !s.participant.veteran) ||
  s.status === f

const cols = 'sm:grid-cols-[2.5rem_1fr_9rem_3.5rem_4.5rem_3rem]'

interface Props {
  standings: Standing[]
  episode: Episode
  selectedParticipant: string | null
  onSelectParticipant: (id: string | null) => void
  onCompare: () => void
}

export function RankingList({ standings, episode, selectedParticipant, onSelectParticipant, onCompare }: Props) {
  const [filter, setFilter] = useState<Filter>('todos')
  const { has, ids } = useFavorites()
  const visible = useMemo(() => standings.filter((s) => matches(s, filter, has)), [standings, filter, has])

  return (
    <section id="ranking" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex w-full items-end justify-between gap-3 sm:w-auto sm:justify-start">
          <div>
            <h2 className="font-serif text-2xl tracking-tight">Classificação</h2>
            <p className="mt-0.5 text-sm text-subtle">
              Até o EP {episode.number} · ordenada por pins, destaques e idas à eliminação
            </p>
          </div>
          <button
            type="button"
            onClick={onCompare}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-fg"
          >
            <CompareIcon className="size-4" /> Comparar
          </button>
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface/60 p-0.5 text-sm" role="tablist">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-md px-3 py-1 transition-colors ${
                filter === f.id ? 'bg-elevated text-fg shadow-sm' : 'text-muted hover:text-fg'
              }`}
            >
              {f.id === 'torcida' ? (
                <span className="inline-flex items-center gap-1">
                  <HeartIcon filled={ids.size > 0} className="size-3.5 text-accent" />
                  {f.label}
                  {ids.size > 0 && <span className="text-xs text-subtle tabular-nums">{ids.size}</span>}
                </span>
              ) : (
                f.label
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line">
        <div
          className={`hidden items-center gap-4 border-b border-line bg-surface/50 px-5 py-2.5 text-xs uppercase tracking-[0.08em] text-subtle sm:grid ${cols}`}
        >
          <span>#</span>
          <span>Participante</span>
          <span>EP {episode.number}</span>
          <span className="text-right">Pins</span>
          <span className="text-right" title="Vezes entre os destaques da prova principal">
            Destaq.
          </span>
          <span className="text-right">Var.</span>
        </div>

        <ol className="divide-y divide-line">
          {visible.map((s) => (
            <RankingRow
              key={s.participant.id}
              standing={s}
              selected={s.participant.id === selectedParticipant}
              onSelect={() => onSelectParticipant(s.participant.id === selectedParticipant ? null : s.participant.id)}
            />
          ))}
          {visible.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted">
              {filter === 'torcida' ? (
                <>
                  Você ainda não torce por ninguém. Toque no <HeartIcon className="inline size-3.5 align-[-2px] text-accent" /> ao
                  lado de um nome para acompanhar seus favoritos.
                </>
              ) : (
                'Nenhum participante nesta categoria.'
              )}
            </li>
          )}
        </ol>
      </div>
    </section>
  )
}

function RankingRow({ standing: s, selected, onSelect }: { standing: Standing; selected: boolean; onSelect: () => void }) {
  const p = s.participant
  const fav = useFavorites().has(p.id)
  const out = s.status === 'eliminado'
  const pinned = s.wonChallenges.filter((c) => c.pin)

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`grid w-full grid-cols-[2rem_1fr_auto] items-center gap-4 px-5 py-3.5 text-left transition-colors ${cols} ${
          selected ? 'bg-accent-soft/60' : fav ? 'bg-accent-soft/20 hover:bg-accent-soft/40' : 'hover:bg-surface/50'
        } ${out ? 'text-muted' : ''}`}
      >
        <span className={`font-serif text-xl tabular-nums ${!out && s.pins > 0 ? 'text-accent' : 'text-subtle'}`}>
          {String(s.position).padStart(2, '0')}
        </span>

        <span className="flex min-w-0 items-center gap-3">
          <Avatar participant={p} size={40} className={out ? 'opacity-60 grayscale' : ''} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className={`truncate font-medium ${out ? 'line-through decoration-subtle/60' : ''}`}>{p.name}</span>
              {p.veteran && <StarIcon className="size-3.5 shrink-0 text-accent" aria-label="Veterano" />}
              <FavoriteButton participant={p} />
              {pinned.map((c) => (
                <span
                  key={c.name}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-px text-[11px] text-accent"
                  title={`Venceu: ${c.name}`}
                >
                  <PinIcon className="size-3" /> pin
                </span>
              ))}
            </span>
            <span className="block truncate text-sm text-subtle">
              {p.specialty ?? p.currentCompany} · {p.city}
            </span>
          </span>
        </span>

        {/* Mobile: resultado e pins compactos */}
        <span className="flex flex-col items-end gap-1 sm:hidden">
          <OutcomeBadge outcome={s.outcome} short />
          {s.pins > 0 && <span className="text-xs text-subtle">{s.pins} {s.pins === 1 ? 'pin' : 'pins'}</span>}
        </span>

        <span className="hidden sm:block">
          <OutcomeBadge outcome={s.outcome} />
        </span>
        <span className="hidden text-right font-medium tabular-nums sm:block">{s.pins}</span>
        <span className="hidden text-right tabular-nums text-muted sm:block">{s.tops}</span>
        <span className="hidden justify-end sm:flex">
          <Trend value={out ? null : s.trend} />
        </span>
      </button>
    </li>
  )
}

function Trend({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return (
      <span className="text-sm text-subtle" aria-label="Sem variação">
        —
      </span>
    )
  }
  const up = value > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-sm tabular-nums ${up ? 'text-positive' : 'text-negative'}`}
      aria-label={`${up ? 'Subiu' : 'Caiu'} ${Math.abs(value)} posição(ões)`}
    >
      <svg viewBox="0 0 12 12" className={`size-3 ${up ? '' : 'rotate-180'}`} fill="currentColor" aria-hidden>
        <path d="M6 2.5 10 8H2z" />
      </svg>
      {Math.abs(value)}
    </span>
  )
}
