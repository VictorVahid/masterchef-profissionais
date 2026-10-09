import type { Episode, Participant } from '@/types'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useNow } from '@/hooks/useNow'
import { nextEpisode } from '@/lib/schedule'
import { isStringRecord } from '@/lib/safe'
import { Avatar } from './Avatar'
import { useToast } from './Toast'
import { CheckIcon, LockIcon } from './icons'

interface Props {
  episodes: Episode[]
  /** Participantes ainda na disputa */
  active: Participant[]
  byId: (id: string) => Participant | undefined
}

type Verdict = 'acertou' | 'errou' | 'sem-eliminacao' | 'aguardando'

/**
 * Bolão pessoal: palpite de quem sai no próximo episódio. Trava quando o
 * episódio começa e é conferido quando o robô registra o resultado.
 */
export function Predictions({ episodes, active, byId }: Props) {
  const [picks, setPicks] = useLocalStorage<Record<string, string>>('mc:palpites', {}, isStringRecord)
  const toast = useToast()
  const now = useNow(30_000)
  const last = episodes.at(-1)!
  const next = nextEpisode(last.number, last.airDate, now)
  const locked = next.live
  const current = picks[next.number]

  const verdict = (ep: number, id: string): Verdict => {
    const e = episodes.find((x) => x.number === ep)
    if (!e) return 'aguardando'
    const out = Object.entries(e.results).filter(([, o]) => o === 'eliminado').map(([pid]) => pid)
    if (out.length === 0) return 'sem-eliminacao'
    return out.includes(id) ? 'acertou' : 'errou'
  }

  const history = Object.entries(picks)
    .map(([ep, id]) => ({ ep: Number(ep), id, v: verdict(Number(ep), id) }))
    .filter((h) => h.ep !== next.number || h.v !== 'aguardando')
    .sort((a, b) => b.ep - a.ep)
  const judged = history.filter((h) => h.v === 'acertou' || h.v === 'errou')
  const hits = judged.filter((h) => h.v === 'acertou').length

  const choose = (id: string) => {
    if (locked) return
    const same = current === id
    setPicks((p) => {
      const copy = { ...p }
      if (same) delete copy[next.number]
      else copy[next.number] = id
      return copy
    })
    toast(same ? 'Palpite removido' : `Palpite salvo: ${byId(id)?.name.split(' ')[0]} sai no EP ${next.number}`)
  }

  const closes = next.start.toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

  return (
    <section className="rounded-2xl border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-subtle">Bolão</p>
          <h2 className="mt-1 font-serif text-2xl tracking-tight">Quem sai no EP {next.number}?</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            {locked ? (
              <>
                <LockIcon className="size-3.5" /> Palpites fechados — o episódio está no ar.
              </>
            ) : (
              <>Palpites até {closes}. Fica salvo só neste navegador.</>
            )}
          </p>
        </div>
        {judged.length > 0 && (
          <div className="rounded-xl bg-surface/70 px-4 py-2 text-right">
            <p className="font-serif text-2xl tabular-nums leading-none">
              {hits}
              <span className="text-base text-subtle">/{judged.length}</span>
            </p>
            <p className="mt-1 text-xs text-subtle">acertos</p>
          </div>
        )}
      </div>

      <ul className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-6 xl:grid-cols-9">
        {active.map((p) => {
          const picked = current === p.id
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => choose(p.id)}
                disabled={locked && !picked}
                aria-pressed={picked}
                title={p.name}
                className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors ${
                  picked ? 'bg-accent-soft' : 'hover:bg-surface'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="relative">
                  <Avatar participant={p} size={44} className={picked ? 'ring-2 ring-accent' : ''} />
                  {picked && (
                    <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-accent text-bg">
                      <CheckIcon className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="w-full truncate text-xs">{p.name.split(' ')[0]}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {history.length > 0 && (
        <ol className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
          {history.map(({ ep, id, v }) => (
            <li key={ep} className="flex flex-wrap items-center gap-x-2 text-muted">
              <span className="w-12 font-medium tabular-nums text-accent">EP {ep}</span>
              <span>
                Você apostou em <span className="text-fg">{byId(id)?.name ?? id}</span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  v === 'acertou'
                    ? 'bg-positive/12 text-positive'
                    : v === 'errou'
                      ? 'bg-negative/12 text-negative'
                      : 'bg-surface text-subtle'
                }`}
              >
                {{ acertou: 'Acertou', errou: 'Errou', 'sem-eliminacao': 'Sem eliminação', aguardando: 'Aguardando resultado' }[v]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
