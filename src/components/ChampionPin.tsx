import type { Challenge, Episode, Participant } from '@/types'
import { formatDate } from '@/lib/ranking'
import { getParticipant } from '@/data'
import { Avatar } from './Avatar'
import { PinIcon } from './icons'

interface Props {
  episode: Episode
  challenge: Challenge
  champion: Participant
  onOpenProfile: (id: string) => void
}

/** Destaque fixado: campeão(ã) da prova principal de um episódio */
export function ChampionPin({ episode, challenge, champion, onOpenProfile }: Props) {
  const otherPins = episode.challenges.filter((c) => c !== challenge && c.pin && c.winnerId)
  const saved = episode.saves?.find((s) => s.by === champion.id)
  const savedName = saved && getParticipant(saved.saved)?.name

  return (
    <article className="relative overflow-hidden rounded-2xl border border-accent/30 bg-accent-soft/50 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-accent">
        <span className="grid size-6 place-items-center rounded-full bg-accent text-bg">
          <PinIcon className="size-3.5 rotate-45" />
        </span>
        Fixado · Campeã(o) da prova do Programa {episode.number}
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar participant={champion} size={72} className="ring-2 ring-accent/40" />
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-2xl tracking-tight">{champion.name}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {champion.veteranOf ?? 'Estreante'} · {champion.city}
          </p>
          <p className="mt-3 text-sm text-muted">
            <span className="text-fg">{challenge.name}</span> — {challenge.description}
          </p>
          {savedName && (
            <p className="mt-1 text-sm text-muted">
              Usou a vantagem para salvar <span className="text-fg">{savedName}</span>.
            </p>
          )}
        </div>
        <div className="flex items-end justify-between gap-6 sm:flex-col sm:items-end">
          <div className="sm:text-right">
            <p className="text-sm text-fg">Pin conquistado</p>
            <p className="text-xs text-subtle">exibido em {formatDate(episode.airDate)}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenProfile(champion.id)}
            className="rounded-lg border border-line bg-elevated px-3 py-1.5 text-sm transition-colors hover:border-accent/40"
          >
            Ver perfil
          </button>
        </div>
      </div>

      {otherPins.length > 0 && (
        <ul className="mt-5 space-y-1 border-t border-accent/20 pt-4 text-sm text-muted">
          {otherPins.map((c) => {
            const w = getParticipant(c.winnerId!)
            return (
              <li key={c.name} className="flex flex-wrap items-center gap-1.5">
                <PinIcon className="size-3.5 text-accent" />
                Também ganhou pin no episódio:
                <button type="button" onClick={() => onOpenProfile(c.winnerId!)} className="text-fg underline-offset-2 hover:underline">
                  {w?.name}
                </button>
                <span>({c.name.toLowerCase()})</span>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
