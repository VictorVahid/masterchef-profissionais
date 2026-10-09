import type { ReactNode } from 'react'
import type { Episode } from '@/types'
import { formatDate, type Standing } from '@/lib/ranking'
import { getParticipant } from '@/data'
import { Avatar } from './Avatar'
import { OutcomeBadge } from './OutcomeBadge'
import { FavoriteButton } from './FavoriteButton'
import { useToast } from './Toast'
import { CloseIcon, CompareIcon, PinIcon, ShareIcon, StarIcon } from './icons'

interface Props {
  standing: Standing
  episodes: Episode[]
  selectedEpisode: number
  onClose: () => void
  onSelectEpisode: (n: number) => void
  onCompare: (id: string) => void
}

export function ParticipantProfile({ standing, episodes, selectedEpisode, onClose, onSelectEpisode, onCompare }: Props) {
  const { participant: p, position, pins, status, eliminatedIn } = standing
  const toast = useToast()

  const share = async () => {
    const url = `${location.origin}${location.pathname}?p=${p.id}`
    const data = { title: `${p.name} · MasterChef Profissionais 2026`, text: `Acompanhe ${p.name} no MasterChef Profissionais 2026`, url }
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share(data)
      else {
        await navigator.clipboard.writeText(url)
        toast('Link do perfil copiado')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast('Não foi possível compartilhar')
    }
  }

  return (
    <article className="animate-rise rounded-2xl border border-line bg-elevated p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)] sm:p-7">
      <div className="flex items-start gap-5">
        <Avatar participant={p} size={88} className={`size-16! sm:size-22! ${status === 'eliminado' ? 'grayscale' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={p.veteran ? 'accent' : undefined}>
              {p.veteran && <StarIcon className="size-3" />}
              {p.veteran ? `Veterano · ${p.veteranOf}` : 'Estreante'}
            </Badge>
            <Badge>{status === 'ativo' ? 'Na disputa' : `Eliminado no EP ${eliminatedIn}`}</Badge>
          </div>
          <h2 className="mt-2 flex items-center gap-1 font-serif text-3xl leading-tight tracking-tight">
            {p.name}
            <FavoriteButton participant={p} size="md" />
          </h2>
          <p className="mt-1 text-sm text-muted">
            {p.age} anos · {p.city}
            {p.livesIn ? ` · vive em ${p.livesIn}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar perfil"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 sm:grid-cols-4">
        <Fact label="Especialidade" value={p.specialty ?? 'Não informada'} muted={!p.specialty} />
        <Fact label="Atuação atual" value={p.currentCompany} className="col-span-2 sm:col-span-1" />
        <Fact label={`Posição · EP ${selectedEpisode}`} value={`${position}º`} />
        <Fact label="Pins" value={String(pins)} />
      </dl>

      <p className="mt-5 max-w-prose leading-relaxed text-pretty">{p.bio}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <ActionButton onClick={() => onCompare(p.id)} icon={<CompareIcon className="size-4" />}>
          Comparar
        </ActionButton>
        <ActionButton onClick={share} icon={<ShareIcon className="size-4" />}>
          Compartilhar
        </ActionButton>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-subtle">Destaques</h3>
          <ul className="space-y-1.5 text-sm">
            {p.highlights.map((h) => (
              <li key={h} className="flex gap-2.5">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-subtle">Onde já trabalhou</h3>
          {p.restaurants.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-muted">
              {p.restaurants.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-subtle">Não informado pelas fontes.</p>
          )}
        </div>
      </div>

      <Timeline participantId={p.id} episodes={episodes} selectedEpisode={selectedEpisode} onSelectEpisode={onSelectEpisode} />
    </article>
  )
}

/** Trajetória do participante, episódio a episódio */
function Timeline({
  participantId,
  episodes,
  selectedEpisode,
  onSelectEpisode,
}: {
  participantId: string
  episodes: Episode[]
  selectedEpisode: number
  onSelectEpisode: (n: number) => void
}) {
  return (
    <section className="mt-7">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-subtle">Trajetória na temporada</h3>
      <ol className="divide-y divide-line rounded-xl border border-line">
        {episodes.map((ep) => {
          const outcome = ep.results[participantId] ?? null
          const won = ep.challenges.filter((c) => c.winnerId === participantId)
          const saved = ep.saves?.filter((s) => s.by === participantId).map((s) => getParticipant(s.saved)?.name)
          const savedBy = ep.saves?.find((s) => s.saved === participantId)
          return (
            <li key={ep.number}>
              <button
                type="button"
                onClick={() => onSelectEpisode(ep.number)}
                className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm transition-colors hover:bg-surface/60 ${
                  ep.number === selectedEpisode ? 'bg-surface/50' : ''
                }`}
              >
                <span className="w-12 shrink-0 font-medium tabular-nums text-accent">EP {ep.number}</span>
                <span className="text-subtle">{formatDate(ep.airDate, { day: '2-digit', month: '2-digit' })}</span>
                <OutcomeBadge outcome={outcome} />
                {won.map((c) => (
                  <span key={c.name} className="inline-flex items-center gap-1 text-accent">
                    <PinIcon className="size-3.5" /> venceu a {c.name.toLowerCase()}
                  </span>
                ))}
                {saved && saved.length > 0 && <span className="text-muted">salvou {saved.join(', ')}</span>}
                {savedBy && <span className="text-muted">salvo por {getParticipant(savedBy.by)?.name}</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function ActionButton({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-fg"
    >
      {icon}
      {children}
    </button>
  )
}

function Badge({ children, tone }: { children: ReactNode; tone?: 'accent' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
        tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'
      }`}
    >
      {children}
    </span>
  )
}

function Fact({ label, value, className = '', muted = false }: { label: string; value: string; className?: string; muted?: boolean }) {
  return (
    <div className={className}>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium ${muted ? 'text-subtle' : ''}`}>{value}</dd>
    </div>
  )
}
