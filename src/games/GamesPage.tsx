import type { Route } from '@/hooks/useRoute'
import { Copa } from './Copa'
import { Quiz } from './Quiz'
import { chefs, seasons } from './history'

interface Props {
  game: 'copa' | 'quiz' | null
  navigate: (r: Route) => void
}

const GAMES = [
  {
    id: 'copa' as const,
    title: 'Copa MasterChef',
    text: 'Monte um time com chefs de todas as temporadas e enfrente seleções aleatórias em 7 provas. Vai sair um 7 × 0?',
    emoji: '🏆',
  },
  {
    id: 'quiz' as const,
    title: 'Quiz da história',
    text: 'Campeões, vices, jurados, anos e colocações — e o modo "Quem é?" com fotos oficiais que vão se revelando.',
    emoji: '🧠',
  },
]

/** Área de jogos (carregada sob demanda, com a base histórica) */
export default function GamesPage({ game, navigate }: Props) {
  const current = GAMES.find((g) => g.id === game)

  return (
    <div>
      <section className="mb-8 max-w-2xl">
        <p className="mb-3 text-sm text-accent">
          Jogos · {seasons.length} temporadas · {chefs.length} chefs na base
        </p>
        <h1 className="font-serif text-4xl leading-[1.1] tracking-tight text-balance sm:text-5xl">
          {current ? current.title : 'Hora de jogar.'}
        </h1>
        {!current && (
          <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">
            Toda a história do MasterChef no Brasil — do primeiro programa em 2014 até hoje — virou jogo.
          </p>
        )}
      </section>

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Jogos">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => navigate({ view: 'jogos', game: g.id })}
            aria-current={game === g.id ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${game === g.id ? 'bg-fg text-bg' : 'border border-line text-muted hover:text-fg'}`}
          >
            {g.emoji} {g.title}
          </button>
        ))}
      </nav>

      {game === 'copa' && <Copa />}
      {game === 'quiz' && <Quiz />}
      {!game && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => navigate({ view: 'jogos', game: g.id })}
              className="group rounded-2xl border border-line p-6 text-left transition-colors hover:border-accent/50 hover:bg-surface/40"
            >
              <span className="text-3xl" aria-hidden>
                {g.emoji}
              </span>
              <h2 className="mt-3 font-serif text-2xl tracking-tight">{g.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{g.text}</p>
              <p className="mt-4 text-sm font-medium text-accent group-hover:underline">Jogar →</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
