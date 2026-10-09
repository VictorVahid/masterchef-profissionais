import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useToast } from '@/components/Toast'
import { CloseIcon, SearchIcon, ShareIcon } from '@/components/icons'
import { chefs, initialsOf, pick, seasonLabel, seasons, shuffle, type Chef } from './history'

const TEAM_SIZE = 5
const ROUNDS = 7

const PROVAS = [
  'Caixa misteriosa',
  'Prova em equipe',
  'Confeitaria sob pressão',
  'Reprodução de prato',
  'Prova de técnica',
  'Serviço para convidados',
  'Mercado relâmpago',
  'Prova criativa',
  'Prova de eliminação',
]

const NOMES_ADVERSARIOS = [
  'Brigada do Mezanino',
  'Esquadrão do Pin',
  'Time da Repescagem',
  'Confraria do Molho Madre',
  'Galera do Fogo Alto',
  'Os Sous-chefs',
  'Clube da Caixa Misteriosa',
  'Seleção do Avental Preto',
]

type Nivel = 'amistoso' | 'classico' | 'final'
const NIVEIS: { id: Nivel; label: string; hint: string }[] = [
  { id: 'amistoso', label: 'Amistoso', hint: 'adversários mais fracos' },
  { id: 'classico', label: 'Clássico', hint: 'nível parecido com o seu' },
  { id: 'final', label: 'Final', hint: 'só os melhores da história' },
]

interface Round {
  prova: string
  mine: Chef
  theirs: Chef
  iWon: boolean
  upset: boolean
}

interface Stats {
  jogos: number
  vitorias: number
  derrotas: number
  maiorGoleada: { placar: string; saldo: number } | null
}

const isStats = (v: unknown): v is Stats =>
  typeof v === 'object' && v !== null && typeof (v as Stats).jogos === 'number' && typeof (v as Stats).vitorias === 'number'

const avg = (team: Chef[]) => (team.length ? Math.round(team.reduce((s, c) => s + c.rating, 0) / team.length) : 0)
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function opponents(mine: Chef[], nivel: Nivel): Chef[] {
  const pool = chefs.filter((c) => !mine.some((m) => m.name === c.name))
  const target = avg(mine)
  const band =
    nivel === 'final'
      ? pool.filter((c) => c.rating >= 88)
      : nivel === 'amistoso'
        ? pool.filter((c) => c.rating <= target - 4)
        : pool.filter((c) => Math.abs(c.rating - target) <= 6)
  // Um chef por pessoa (a mesma pessoa pode ter mais de uma temporada)
  const unique = [...new Map(shuffle(band.length >= TEAM_SIZE ? band : pool).map((c) => [c.name, c])).values()]
  return unique.slice(0, TEAM_SIZE)
}

function simulate(mine: Chef[], theirs: Chef[]): Round[] {
  const provas = shuffle(PROVAS).slice(0, ROUNDS)
  const offset = Math.floor(Math.random() * TEAM_SIZE)
  return provas.map((prova, i) => {
    const a = mine[i % TEAM_SIZE]
    const b = theirs[(i + offset) % TEAM_SIZE]
    const captain = i % TEAM_SIZE === 0 ? 2 : 0
    const p = 1 / (1 + Math.exp(-(a.rating + captain - b.rating) / 7))
    const iWon = Math.random() < p
    const upset = (iWon && b.rating - a.rating >= 8) || (!iWon && a.rating - b.rating >= 8)
    return { prova, mine: a, theirs: b, iWon, upset }
  })
}

export function Copa() {
  const [team, setTeam] = useState<Chef[]>([])
  const [query, setQuery] = useState('')
  const [show, setShow] = useState('todos')
  const [nivel, setNivel] = useState<Nivel>('classico')
  const [match, setMatch] = useState<{ rival: string; theirs: Chef[]; rounds: Round[] } | null>(null)
  const [revealed, setRevealed] = useState(0)
  const [stats, setStats] = useLocalStorage<Stats>('mc:copa', { jogos: 0, vitorias: 0, derrotas: 0, maiorGoleada: null }, isStats)
  const toast = useToast()
  const recorded = useRef(false)

  const shows = useMemo(() => [...new Set(seasons.map((s) => s.show))], [])
  const results = useMemo(() => {
    const q = normalize(query.trim())
    return chefs
      .filter((c) => show === 'todos' || c.season.show === show)
      .filter((c) => !q || normalize(`${c.name} ${seasonLabel(c.season)}`).includes(q))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 40)
  }, [query, show])

  const add = (c: Chef) => {
    if (team.length >= TEAM_SIZE) return toast('Seu time já tem 5 chefs')
    if (team.some((t) => t.name === c.name)) return toast(`${c.name.split(' ')[0]} já está no time`)
    setTeam((t) => [...t, c])
  }

  const randomTeam = () => {
    const unique = [...new Map(shuffle(chefs).map((c) => [c.name, c])).values()]
    setTeam(unique.slice(0, TEAM_SIZE))
  }

  const play = () => {
    const theirs = opponents(team, nivel)
    recorded.current = false
    setMatch({ rival: pick(NOMES_ADVERSARIOS), theirs, rounds: simulate(team, theirs) })
    setRevealed(0)
  }

  // Revela uma prova por vez (instantâneo para quem prefere menos movimento)
  useEffect(() => {
    if (!match || revealed >= ROUNDS) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setRevealed((n) => n + 1), reduce ? 0 : 1100)
    return () => clearTimeout(t)
  }, [match, revealed])

  const shown = match?.rounds.slice(0, revealed) ?? []
  const us = shown.filter((r) => r.iWon).length
  const them = shown.length - us
  const done = !!match && revealed >= ROUNDS

  useEffect(() => {
    if (!done || recorded.current) return
    recorded.current = true
    const saldo = us - them
    setStats((s) => ({
      jogos: s.jogos + 1,
      vitorias: s.vitorias + (saldo > 0 ? 1 : 0),
      derrotas: s.derrotas + (saldo < 0 ? 1 : 0),
      maiorGoleada: saldo > 0 && saldo > (s.maiorGoleada?.saldo ?? 0) ? { placar: `${us} x ${them}`, saldo } : s.maiorGoleada,
    }))
  }, [done, us, them, setStats])

  const share = async () => {
    const text = `Meu time ${us > them ? 'venceu' : 'perdeu'} por ${us} x ${them} contra a ${match?.rival} na Copa MasterChef 🏆 ${location.origin}/jogos/copa`
    try {
      await navigator.clipboard.writeText(text)
      toast('Resultado copiado')
    } catch {
      toast('Não foi possível copiar')
    }
  }

  if (match) {
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-line bg-elevated p-5 sm:p-8">
          <p className="text-center text-xs uppercase tracking-[0.08em] text-subtle">Copa MasterChef · simulação</p>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div>
              <p className="font-serif text-lg sm:text-2xl">Seu time</p>
              <p className="text-xs text-subtle">média {avg(team)}</p>
            </div>
            <p className="font-serif text-5xl tabular-nums sm:text-7xl" aria-live="polite">
              {us} <span className="text-subtle">×</span> {them}
            </p>
            <div>
              <p className="font-serif text-lg sm:text-2xl">{match.rival}</p>
              <p className="text-xs text-subtle">média {avg(match.theirs)}</p>
            </div>
          </div>

          {done && (
            <div className="mt-6 animate-rise text-center">
              <p className="font-serif text-2xl text-accent">{verdict(us, them)}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={play} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
                  Jogar de novo
                </button>
                <button type="button" onClick={() => setMatch(null)} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-accent/40">
                  Mudar o time
                </button>
                <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm hover:border-accent/40">
                  <ShareIcon className="size-4" /> Compartilhar
                </button>
              </div>
            </div>
          )}
        </div>

        <ol className="space-y-2">
          {shown.map((r, i) => (
            <li key={i} className="animate-rise rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-subtle">
                <span>
                  Prova {i + 1} · {r.prova}
                </span>
                {r.upset && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">Zebra!</span>}
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                <ChefChip chef={r.mine} win={r.iWon} />
                <span className={`font-medium tabular-nums ${r.iWon ? 'text-positive' : 'text-negative'}`}>
                  {r.iWon ? 'GOL!' : 'gol deles'}
                </span>
                <ChefChip chef={r.theirs} win={!r.iWon} right />
              </div>
            </li>
          ))}
          {!done && (
            <li className="flex justify-center">
              <button type="button" onClick={() => setRevealed(ROUNDS)} className="text-sm text-muted underline-offset-2 hover:text-fg hover:underline">
                Pular para o resultado
              </button>
            </li>
          )}
        </ol>
      </section>
    )
  }

  return (
    <section className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Buscar chef</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar chef ou temporada"
              className="w-full rounded-lg border border-line bg-elevated py-2 pl-9 pr-3 text-sm placeholder:text-subtle focus:border-accent/50 focus:outline-none"
            />
          </label>
          <select
            value={show}
            onChange={(e) => setShow(e.target.value)}
            aria-label="Filtrar por programa"
            className="rounded-lg border border-line bg-elevated px-3 py-2 text-sm"
          >
            <option value="todos">Todos os programas</option>
            {shows.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {results.map((c) => {
            const inTeam = team.some((t) => t.key === c.key)
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => add(c)}
                  disabled={inTeam}
                  className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2 text-left text-sm transition-colors hover:border-accent/40 disabled:opacity-40"
                >
                  <Rating value={c.rating} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-subtle">
                      {seasonLabel(c.season)} · {c.champion ? 'campeão' : `${c.finish}º lugar`}
                      {c.wins ? ` · ${c.wins} ${c.wins === 1 ? 'prova' : 'provas'}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
          {results.length === 0 && <li className="px-2 py-6 text-sm text-subtle">Ninguém encontrado.</li>}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-subtle">
          A nota de cada chef é calculada com dados reais da temporada (colocação final e provas vencidas). As partidas são
          simulações para diversão — os resultados são fictícios. Participantes falecidos não aparecem no jogo, em respeito.
        </p>
      </div>

      <aside className="order-first h-fit space-y-4 rounded-2xl border border-line p-5 lg:order-none lg:sticky lg:top-24">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl">Seu time</h2>
          <span className="text-sm text-subtle">
            {team.length}/{TEAM_SIZE} · média <span className="tabular-nums text-fg">{avg(team) || '—'}</span>
          </span>
        </div>
        <ol className="space-y-1.5">
          {Array.from({ length: TEAM_SIZE }, (_, i) => team[i]).map((c, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-surface/60 px-2 py-1.5 text-sm">
              <span className="w-14 shrink-0 text-xs text-subtle">{i === 0 ? 'Capitão' : `Chef ${i + 1}`}</span>
              {c ? (
                <>
                  <Rating value={c.rating} small />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => setTeam((t) => t.filter((x) => x.key !== c.key))}
                    aria-label={`Tirar ${c.name} do time`}
                    className="grid size-6 place-items-center rounded text-subtle hover:text-fg"
                  >
                    <CloseIcon className="size-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </li>
          ))}
        </ol>

        <fieldset>
          <legend className="mb-1.5 text-xs uppercase tracking-[0.08em] text-subtle">Adversário</legend>
          <div className="grid grid-cols-3 gap-1">
            {NIVEIS.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNivel(n.id)}
                aria-pressed={nivel === n.id}
                title={n.hint}
                className={`rounded-lg px-2 py-1.5 text-xs transition-colors ${nivel === n.id ? 'bg-accent-soft text-accent' : 'border border-line text-muted hover:text-fg'}`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <button type="button" onClick={randomTeam} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-accent/40">
            Sortear time
          </button>
          <button
            type="button"
            onClick={play}
            disabled={team.length < TEAM_SIZE}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-40"
          >
            Jogar
          </button>
        </div>

        {stats.jogos > 0 && (
          <p className="border-t border-line pt-3 text-xs text-subtle">
            {stats.jogos} {stats.jogos === 1 ? 'jogo' : 'jogos'} · {stats.vitorias} vitórias · {stats.derrotas} derrotas
            {stats.maiorGoleada && ` · maior goleada: ${stats.maiorGoleada.placar}`}
          </p>
        )}
      </aside>
    </section>
  )
}

function verdict(us: number, them: number) {
  if (us === ROUNDS) return `${ROUNDS} x 0! Atropelo histórico!`
  if (them === ROUNDS) return `0 x ${ROUNDS}... dia de esquecer.`
  if (us - them >= 3) return 'Vitória de goleada!'
  if (us > them) return 'Vitória suada!'
  if (them - us >= 3) return 'Derrota feia. Hora de rever o time.'
  return 'Derrota por pouco.'
}

function Rating({ value, small = false }: { value: number; small?: boolean }) {
  const tone = value >= 90 ? 'bg-accent text-bg' : value >= 80 ? 'bg-accent-soft text-accent' : 'bg-surface text-muted'
  return (
    <span className={`grid shrink-0 place-items-center rounded-md font-serif tabular-nums ${tone} ${small ? 'size-6 text-xs' : 'size-9 text-base'}`}>
      {value}
    </span>
  )
}

function ChefChip({ chef, win, right = false }: { chef: Chef; win: boolean; right?: boolean }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-medium ${win ? 'bg-accent text-bg' : 'bg-surface text-subtle'}`}
        aria-hidden
      >
        {initialsOf(chef.name)}
      </span>
      <span className="min-w-0">
        <span className={`block truncate ${win ? 'font-medium' : 'text-muted'}`}>{chef.name}</span>
        <span className="block truncate text-xs text-subtle">
          {seasonLabel(chef.season)} · {chef.rating}
        </span>
      </span>
    </span>
  )
}
