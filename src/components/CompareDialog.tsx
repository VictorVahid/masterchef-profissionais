import type { ReactNode } from 'react'
import type { Episode, Participant } from '@/types'
import type { Standing } from '@/lib/ranking'
import { Avatar } from './Avatar'
import { Modal } from './Modal'
import { OutcomeBadge } from './OutcomeBadge'
import { CloseIcon, PinIcon } from './icons'

interface Props {
  pair: [string, string] | null
  onChange: (pair: [string, string] | null) => void
  standings: Standing[]
  episodes: Episode[]
  participants: Participant[]
}

/** Comparação lado a lado de dois participantes ao longo da temporada */
export function CompareDialog({ pair, onChange, standings, episodes, participants }: Props) {
  const close = () => onChange(null)
  const [a, b] = (pair ?? []).map((id) => standings.find((s) => s.participant.id === id))
  const sorted = [...participants].sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'))

  const wins = (id: string) => episodes.flatMap((e) => e.challenges).filter((c) => c.winnerId === id).length

  // Em cada métrica, destaca quem leva vantagem (maior ou menor é melhor)
  const metrics: { label: string; get: (s: Standing) => number; better: 'mais' | 'menos'; fmt?: (n: number) => string }[] = [
    { label: 'Posição', get: (s) => s.position, better: 'menos', fmt: (n) => `${n}º` },
    { label: 'Pins', get: (s) => s.pins, better: 'mais' },
    { label: 'Provas vencidas', get: (s) => wins(s.participant.id), better: 'mais' },
    { label: 'Vezes entre os destaques', get: (s) => s.tops, better: 'mais' },
    { label: 'Idas à eliminação', get: (s) => s.eliminationTests, better: 'menos' },
  ]

  return (
    <Modal open={!!pair} onClose={close} label="Comparar participantes" width="max-w-3xl">
      {pair && a && b && (
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-2xl tracking-tight">Frente a frente</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar"
              className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-8">
            {[a, b].map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <Avatar participant={s.participant} size={72} className={s.status === 'eliminado' ? 'grayscale' : ''} />
                <label className="mt-3 w-full">
                  <span className="sr-only">{i === 0 ? 'Primeiro participante' : 'Segundo participante'}</span>
                  <select
                    value={s.participant.id}
                    onChange={(e) => onChange(i === 0 ? [e.target.value, pair[1]] : [pair[0], e.target.value])}
                    className="w-full truncate rounded-lg border border-line bg-bg px-2 py-1.5 text-center font-serif text-lg focus:border-accent/50 focus:outline-none"
                  >
                    {sorted.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.id === pair[1 - i]}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-1.5 text-xs text-subtle">
                  {s.participant.veteran ? s.participant.veteranOf : 'Estreante'}
                </p>
                <p className={`mt-1 text-xs ${s.status === 'eliminado' ? 'text-negative' : 'text-positive'}`}>
                  {s.status === 'ativo' ? 'Na disputa' : `Eliminado no EP ${s.eliminatedIn}`}
                </p>
              </div>
            ))}
          </div>

          <dl className="mt-6 divide-y divide-line rounded-xl border border-line">
            {metrics.map((m) => {
              const [va, vb] = [m.get(a), m.get(b)]
              const best = va === vb ? null : (m.better === 'mais') === va > vb ? 0 : 1
              return (
                <Row key={m.label} label={m.label}>
                  {[va, vb].map((v, i) => (
                    <span key={i} className={`tabular-nums ${best === i ? 'font-semibold text-accent' : 'text-muted'}`}>
                      {m.fmt ? m.fmt(v) : v}
                    </span>
                  ))}
                </Row>
              )
            })}
          </dl>

          <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-[0.08em] text-subtle">Episódio a episódio</h3>
          <dl className="divide-y divide-line rounded-xl border border-line">
            {episodes.map((ep) => (
              <Row key={ep.number} label={`EP ${ep.number}`}>
                {[a, b].map((s, i) => {
                  const pinned = ep.challenges.some((c) => c.pin && c.winnerId === s.participant.id)
                  return (
                    <span key={i} className="inline-flex items-center justify-center gap-1">
                      <OutcomeBadge outcome={ep.results[s.participant.id] ?? null} short />
                      {pinned && <PinIcon className="size-3.5 text-accent" aria-label="ganhou pin" />}
                    </span>
                  )
                })}
              </Row>
            ))}
          </dl>
        </div>
      )}
    </Modal>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_6.5rem_1fr] items-center gap-2 px-3 py-2.5 text-sm sm:grid-cols-[1fr_11rem_1fr] sm:px-4">
      {Array.isArray(children) && <span className="text-center">{children[0]}</span>}
      <dt className="text-center text-xs leading-tight text-subtle">{label}</dt>
      {Array.isArray(children) && <span className="text-center">{children[1]}</span>}
    </div>
  )
}
