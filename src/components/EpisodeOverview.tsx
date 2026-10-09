import type { Episode } from '@/types'
import { formatDate } from '@/lib/ranking'
import { safeHttpsUrl } from '@/lib/safe'
import { getParticipant } from '@/data'
import { PinIcon } from './icons'

interface Props {
  episode: Episode
  onOpenProfile: (id: string) => void
}

/** Resumo do episódio selecionado: provas, vencedores e eliminação */
export function EpisodeOverview({ episode, onOpenProfile }: Props) {
  // Só links https válidos (os dados vêm do robô de atualização)
  const safeSources = (episode.sources ?? []).map(safeHttpsUrl).filter((u): u is URL => u !== null)
  const eliminated = Object.entries(episode.results)
    .filter(([, o]) => o === 'eliminado')
    .map(([id]) => getParticipant(id))

  return (
    <section className="rounded-2xl border border-line p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.08em] text-subtle">
        EP {episode.number} · {formatDate(episode.airDate, { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <h2 className="mt-1 font-serif text-2xl leading-snug tracking-tight text-balance">{episode.title}</h2>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted text-pretty">{episode.summary}</p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {episode.challenges.map((c, i) => {
          const winner = c.winnerId ? getParticipant(c.winnerId) : undefined
          return (
            <li key={c.name} className="rounded-xl bg-surface/60 p-4">
              <p className="text-xs text-subtle">Prova {i + 1}</p>
              <p className="font-medium">{c.name}</p>
              <p className="mt-1 text-sm text-muted">{c.description}</p>
              {winner && (
                <button
                  type="button"
                  onClick={() => onOpenProfile(winner.id)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent underline-offset-2 hover:underline"
                >
                  {c.pin && <PinIcon className="size-3.5" />}
                  {winner.name}
                  {c.pin ? ' · pin' : ''}
                </button>
              )}
            </li>
          )
        })}
      </ol>

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
        {eliminated.length > 0 && (
          <div>
            <dt className="text-xs text-subtle">Eliminado</dt>
            <dd className="mt-0.5">
              {eliminated.map((p) => (
                <button
                  key={p!.id}
                  type="button"
                  onClick={() => onOpenProfile(p!.id)}
                  className="text-negative underline-offset-2 hover:underline"
                >
                  {p!.name}
                </button>
              ))}
            </dd>
          </div>
        )}
        {episode.guestJudges && episode.guestJudges.length > 0 && (
          <div>
            <dt className="text-xs text-subtle">Jurados convidados</dt>
            <dd className="mt-0.5 text-muted">{episode.guestJudges.join(', ')}</dd>
          </div>
        )}
      </dl>

      {safeSources.length > 0 && (
        <p className="mt-4 text-xs text-subtle">
          Fontes:{' '}
          {safeSources.map((url, i) => (
            <span key={url.href}>
              {i > 0 && ' · '}
              <a href={url.href} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-fg hover:underline">
                {url.hostname.replace(/^www\./, '')}
              </a>
            </span>
          ))}
          {episode.updatedBy === 'bot' && ' · registrado automaticamente'}
        </p>
      )}
    </section>
  )
}
