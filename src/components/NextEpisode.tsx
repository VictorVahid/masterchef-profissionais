import type { Episode } from '@/types'
import { useNow } from '@/hooks/useNow'
import { formatCountdown, nextEpisode } from '@/lib/schedule'
import { ClockIcon } from './icons'

/** Contagem regressiva para o próximo episódio, ou aviso de "no ar agora" */
export function NextEpisode({ last, network }: { last: Episode; network: string }) {
  const now = useNow(1000)
  const next = nextEpisode(last.number, last.airDate, now)
  const when = next.start.toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

  if (next.live) {
    return (
      <div className="inline-flex items-center gap-2.5 rounded-full border border-negative/30 bg-negative/10 px-4 py-2 text-sm">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-negative opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-negative" />
        </span>
        <span>
          <strong className="font-medium">No ar agora</strong> na {network} · EP {next.number}
        </span>
      </div>
    )
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-surface/60 px-4 py-2 text-sm">
      <ClockIcon className="size-4 text-accent" />
      <span className="text-muted">
        EP {next.number} · <span className="first-letter:uppercase">{when.replace(',', ' ·')}</span>
      </span>
      <span className="font-medium tabular-nums" aria-label={`Começa em ${formatCountdown(next.start.getTime() - now.getTime())}`}>
        em {formatCountdown(next.start.getTime() - now.getTime())}
      </span>
    </div>
  )
}
