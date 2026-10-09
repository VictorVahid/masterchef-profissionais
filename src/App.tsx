import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from '@/components/Header'
import { FilterSidebar } from '@/components/FilterSidebar'
import { ChampionPin } from '@/components/ChampionPin'
import { ParticipantProfile } from '@/components/ParticipantProfile'
import { SeasonSummary } from '@/components/SeasonSummary'
import { RankingList } from '@/components/RankingList'
import { EpisodeOverview } from '@/components/EpisodeOverview'
import { NextEpisode } from '@/components/NextEpisode'
import { Predictions } from '@/components/Predictions'
import { CompareDialog } from '@/components/CompareDialog'
import { CommandPalette } from '@/components/CommandPalette'
import { ChatLauncher } from '@/chat/ChatLauncher'
import { useRoute } from '@/hooks/useRoute'

// Jogos e base histórica só são baixados quando alguém abre a aba Jogos
const GamesPage = lazy(() => import('@/games/GamesPage'))
import { getEpisode, getEpisodes, getParticipant, getParticipants, meta, season, sources } from '@/data'
import { computeStandings } from '@/lib/ranking'
import { useUrlFilters } from '@/hooks/useUrlFilters'

const participants = getParticipants()
const episodes = getEpisodes()
const latestEpisode = episodes.at(-1)!.number
/** Episódio cujo campeão fica fixado no topo */
const PINNED_EPISODE = 1

export default function App() {
  const [route, navigate] = useRoute()
  const [filters, setFilters] = useUrlFilters({ episode: latestEpisode, participant: null }, (f) => ({
    episode: getEpisode(f.episode) ? f.episode : latestEpisode,
    participant: f.participant && getParticipant(f.participant) ? f.participant : null,
  }))

  const episode = getEpisode(filters.episode)!
  const standings = useMemo(() => computeStandings(participants, episodes, filters.episode), [filters.episode])
  const selected = standings.find((s) => s.participant.id === filters.participant) ?? null

  // Campeão(ã) da prova principal (primeira prova com pin) do episódio fixado
  const pinnedEpisode = getEpisode(PINNED_EPISODE)
  const pinnedChallenge = pinnedEpisode?.challenges.find((c) => c.pin && c.winnerId)
  const pinnedChampion = pinnedChallenge && getParticipant(pinnedChallenge.winnerId!)

  const setEpisode = useCallback((n: number) => setFilters((f) => ({ ...f, episode: n })), [setFilters])
  const setParticipant = useCallback((id: string | null) => setFilters((f) => ({ ...f, participant: id })), [setFilters])
  // Vindo da busca rápida: volta para a temporada antes de abrir o perfil/episódio
  const goParticipant = useCallback((id: string) => (navigate({ view: 'temporada' }), setParticipant(id)), [navigate, setParticipant])
  const goEpisode = useCallback((n: number) => (navigate({ view: 'temporada' }), setEpisode(n)), [navigate, setEpisode])

  // Situação da temporada inteira (para o bolão e o comparador)
  const seasonStandings = useMemo(() => computeStandings(participants, episodes, latestEpisode), [])
  const activeNow = useMemo(
    () => seasonStandings.filter((s) => s.status === 'ativo').map((s) => s.participant).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [seasonStandings],
  )

  // Comparador: abre com o participante escolhido (ou o líder) contra o próximo da tabela
  const [comparePair, setComparePair] = useState<[string, string] | null>(null)
  const openCompare = useCallback(
    (id?: string) => {
      const a = id ?? filters.participant ?? seasonStandings[0].participant.id
      const b = seasonStandings.find((s) => s.participant.id !== a)!.participant.id
      setComparePair([a, b])
    },
    [filters.participant, seasonStandings],
  )

  // Busca rápida: Ctrl/⌘+K ou "/" · Esc fecha o perfil aberto
  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setPaletteOpen(true)
      } else if (e.key === 'Escape' && !typing && !paletteOpen && !comparePair && filters.participant) {
        setParticipant(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, comparePair, filters.participant, setParticipant])

  // Leva o perfil à vista quando um participante é escolhido
  const profileRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (filters.participant) profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [filters.participant])

  return (
    <div className="flex min-h-dvh flex-col">
      <Header onOpenSearch={() => setPaletteOpen(true)} route={route} navigate={navigate} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-12 sm:px-6 sm:pt-16">
        {route.view === 'jogos' ? (
          <Suspense fallback={<p className="py-20 text-center text-sm text-muted">Carregando os jogos…</p>}>
            <GamesPage game={route.game} navigate={navigate} />
          </Suspense>
        ) : (
        <>
        <section className="mb-10 max-w-2xl">
          <p className="mb-4 text-sm text-accent">
            {season.edition} · {season.year} · {season.network} · {season.schedule}
          </p>
          <h1 className="font-serif text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Quem está no comando da cozinha.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted text-pretty">
            Nove veteranos e nove estreantes disputam {season.prize}, sob o olhar de{' '}
            {season.judges.slice(0, -1).join(', ')} e {season.judges.at(-1)}. Filtre por episódio, abra o perfil de
            cada chef e veja quem levou cada pin.
          </p>
          <div className="mt-6">
            <NextEpisode last={episodes.at(-1)!} network={season.network} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <FilterSidebar
            episodes={episodes}
            standings={standings}
            selectedEpisode={filters.episode}
            onSelectEpisode={setEpisode}
            selectedParticipant={filters.participant}
            onSelectParticipant={setParticipant}
          />

          <div className="min-w-0 space-y-10">
            {pinnedEpisode && pinnedChallenge && pinnedChampion && (
              <ChampionPin
                episode={pinnedEpisode}
                challenge={pinnedChallenge}
                champion={pinnedChampion}
                onOpenProfile={setParticipant}
              />
            )}

            {selected && (
              <div ref={profileRef} key={selected.participant.id} className="scroll-mt-24">
                <ParticipantProfile
                  onCompare={openCompare}
                  standing={selected}
                  episodes={episodes}
                  selectedEpisode={filters.episode}
                  onClose={() => setParticipant(null)}
                  onSelectEpisode={setEpisode}
                />
              </div>
            )}

            <EpisodeOverview episode={episode} onOpenProfile={setParticipant} />

            <Predictions episodes={episodes} active={activeNow} byId={getParticipant} />

            <SeasonSummary episode={episode} standings={standings} />

            <RankingList
              standings={standings}
              episode={episode}
              selectedParticipant={filters.participant}
              onSelectParticipant={setParticipant}
              onCompare={() => openCompare()}
            />
          </div>
        </div>
        </>
        )}
      </main>

      <ChatLauncher last={episodes.at(-1)!} />

      <CompareDialog
        pair={comparePair}
        onChange={setComparePair}
        standings={seasonStandings}
        episodes={episodes}
        participants={participants}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        participants={participants}
        episodes={episodes}
        onParticipant={goParticipant}
        onEpisode={goEpisode}
        onCompare={() => (navigate({ view: 'temporada' }), openCompare())}
      />

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-6 text-sm text-subtle sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Projeto independente de fãs, sem vínculo oficial com a Band ou o programa.</span>
            <span>
              Atualizado automaticamente após o EP {latestEpisode} ·{' '}
              {new Date(meta.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          </div>
          <p className="text-xs">Fotos dos participantes: divulgação/Band.</p>
          <p className="text-xs">
            Fontes:{' '}
            {sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ' · '}
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-fg hover:underline">
                  {s.label}
                </a>
              </span>
            ))}
          </p>
        </div>
      </footer>
    </div>
  )
}
