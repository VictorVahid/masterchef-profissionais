import { useCallback, useEffect, useMemo, useState } from 'react'
import { getParticipants } from '@/data'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useNow } from '@/hooks/useNow'
import { safeImageUrl } from '@/lib/safe'
import { useToast } from '@/components/Toast'
import { CheckIcon, CloseIcon, ShareIcon } from '@/components/icons'
import { pick, seasonLabel, seasons, shuffle, type HistorySeason } from './history'

type Mode = 'classico' | 'quem-e'
const QUESTIONS = 10
const SECONDS = 20

interface Question {
  prompt: string
  options: string[]
  answer: string
  explain: string
  source?: string
  photo?: string
}

const ranked = (s: HistorySeason) => s.contestants.filter((c) => c.finish)
const champion = (s: HistorySeason) => s.contestants.find((c) => c.finish === 1)
const vice = (s: HistorySeason) => s.contestants.find((c) => c.finish === 2)
const ordinal = (n: number) => `${n}º lugar`

/** Monta 4 opções únicas com a correta embaralhada; null se não houver opções suficientes */
function options(answer: string, pool: string[]): string[] | null {
  const others = shuffle([...new Set(pool)].filter((o) => o !== answer)).slice(0, 3)
  return others.length === 3 ? shuffle([answer, ...others]) : null
}

// Cada gerador cria uma pergunta a partir de dados reais (ou null se não der)
const generators: ((s: HistorySeason) => Question | null)[] = [
  (s) => {
    const c = champion(s)
    const opts = c && options(c.name, ranked(s).filter((x) => x.finish! <= 8).map((x) => x.name))
    return c && opts
      ? { prompt: `Quem venceu o ${seasonLabel(s)}?`, options: opts, answer: c.name, explain: `${c.name} foi campeã(o) do ${seasonLabel(s)}.`, source: s.source.url }
      : null
  },
  (s) => {
    const v = vice(s)
    const opts = v && options(v.name, ranked(s).filter((x) => x.finish! <= 8).map((x) => x.name))
    return v && opts
      ? { prompt: `Quem foi vice-campeã(o) do ${seasonLabel(s)}?`, options: opts, answer: v.name, explain: `${v.name} terminou em 2º lugar no ${seasonLabel(s)}; ${champion(s)?.name ?? '—'} venceu.`, source: s.source.url }
      : null
  },
  (s) => {
    const c = champion(s)
    if (!c || !s.year) return null
    const years = [...seasons.filter((x) => x.year).map((x) => String(x.year)), String(s.year - 1), String(s.year + 1)]
    const opts = options(String(s.year), years)
    return opts ? { prompt: `Em que ano ${c.name} venceu o ${s.show}?`, options: opts, answer: String(s.year), explain: `${c.name} venceu o ${s.show} em ${s.year} (${s.edition}).`, source: s.source.url } : null
  },
  (s) => {
    if (s.judges.length < 3 || !s.year) return null
    const answer = s.judges.join(', ')
    const allJudges = [...new Set(seasons.flatMap((x) => x.judges))]
    const variants = [
      ...seasons.filter((x) => x.judges.length >= 3).map((x) => x.judges.join(', ')),
      ...allJudges.flatMap((j) => s.judges.map((_, i) => s.judges.map((x, k) => (k === i ? j : x))).filter((t) => new Set(t).size === t.length).map((t) => t.join(', '))),
    ]
    const opts = options(answer, variants)
    return opts ? { prompt: `Quem formava o júri do ${seasonLabel(s)}?`, options: opts, answer, explain: `O júri do ${seasonLabel(s)} era: ${answer}.`, source: s.source.url } : null
  },
  (s) => {
    const c = pick(ranked(s).filter((x) => x.finish! >= 2 && x.finish! <= 8))
    if (!c) return null
    const opts = options(ordinal(c.finish!), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ordinal))
    return opts ? { prompt: `Em que colocação ${c.name} terminou o ${seasonLabel(s)}?`, options: opts, answer: ordinal(c.finish!), explain: `${c.name} terminou em ${c.finish}º lugar no ${seasonLabel(s)}.`, source: s.source.url } : null
  },
  (s) => {
    const c = pick(s.contestants)
    if (!c || !s.year) return null
    // Evita ambiguidade: a pessoa não pode ter competido em outra temporada listada como opção
    const elsewhere = new Set(seasons.filter((x) => x.contestants.some((y) => y.name === c.name)).map(seasonLabel))
    const opts = options(seasonLabel(s), seasons.filter((x) => x.year && !elsewhere.has(seasonLabel(x))).map(seasonLabel))
    return opts ? { prompt: `Em qual edição ${c.name} competiu?`, options: opts, answer: seasonLabel(s), explain: `${c.name} participou do ${seasonLabel(s)}.`, source: s.source.url } : null
  },
]

function photoQuestion(): Question | null {
  const cast = getParticipants().filter((p) => safeImageUrl(p.photo))
  const p = pick(cast)
  const opts = p && options(p.name, cast.map((x) => x.name))
  return p && opts
    ? { prompt: 'Quem é? (elenco do MasterChef Profissionais 2026)', options: opts, answer: p.name, explain: `É ${p.name}, ${p.specialty ? p.specialty.toLowerCase() : 'chef'}, de ${p.city}.`, photo: safeImageUrl(p.photo)! }
    : null
}

function buildQuiz(mode: Mode): Question[] {
  const out: Question[] = []
  const seen = new Set<string>()
  for (let tries = 0; out.length < QUESTIONS && tries < 500; tries++) {
    const wantPhoto = mode === 'quem-e' || (out.length % 5 === 4) // no clássico, 2 de 10 são de foto
    const q = wantPhoto ? photoQuestion() : pick(generators)(pick(seasons))
    if (q && !seen.has(q.prompt + q.answer)) {
      seen.add(q.prompt + q.answer)
      out.push(q)
    }
  }
  return out
}

interface Best {
  classico: number
  'quem-e': number
}
const isBest = (v: unknown): v is Best =>
  typeof v === 'object' && v !== null && typeof (v as Best).classico === 'number' && typeof (v as Best)['quem-e'] === 'number'

export function Quiz() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [quiz, setQuiz] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [hits, setHits] = useState(0)
  const [streak, setStreak] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [best, setBest] = useLocalStorage<Best>('mc:quiz', { classico: 0, 'quem-e': 0 }, isBest)
  const toast = useToast()
  const now = useNow(250)

  const start = (m: Mode) => {
    setMode(m)
    setQuiz(buildQuiz(m))
    setIndex(0)
    setChosen(null)
    setScore(0)
    setHits(0)
    setStreak(0)
    setStartedAt(Date.now())
  }

  const q = quiz[index]
  const elapsed = (now.getTime() - startedAt) / 1000
  const left = Math.max(0, SECONDS - elapsed)
  const finished = mode !== null && index >= quiz.length

  const answer = useCallback(
    (opt: string | null) => {
      if (!q || chosen !== null) return
      setChosen(opt ?? '')
      if (opt === q.answer) {
        const bonus = Math.round(Math.max(0, SECONDS - (Date.now() - startedAt) / 1000) * 5)
        setScore((s) => s + 100 + bonus + streak * 20)
        setHits((h) => h + 1)
        setStreak((s) => s + 1)
      } else {
        setStreak(0)
      }
    },
    [q, chosen, startedAt, streak],
  )

  // Tempo esgotado conta como erro
  useEffect(() => {
    if (q && chosen === null && left <= 0) answer(null)
  }, [q, chosen, left, answer])

  const next = () => {
    setIndex((i) => i + 1)
    setChosen(null)
    setStartedAt(Date.now())
  }

  useEffect(() => {
    if (finished && mode && score > best[mode]) setBest((b) => ({ ...b, [mode]: score }))
  }, [finished, mode, score, best, setBest])

  // Foto vai ficando nítida com o tempo (modo "Quem é?")
  const blur = useMemo(() => (chosen !== null ? 0 : Math.max(0, 18 * (left / SECONDS))), [chosen, left])

  if (!mode) {
    return (
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModeCard title="Clássico" text="10 perguntas sobre todas as temporadas: campeões, vices, jurados, anos e colocações — e algumas fotos." best={best.classico} onStart={() => start('classico')} />
        <ModeCard title="Quem é?" text="A foto oficial começa desfocada e vai ficando nítida. Quanto antes acertar, mais pontos." best={best['quem-e']} onStart={() => start('quem-e')} />
        <p className="text-xs leading-relaxed text-subtle sm:col-span-2">
          Perguntas geradas automaticamente a partir de dados públicos (Wikipédia, CC BY-SA) e das fotos oficiais de divulgação
          da Band. Cada resposta mostra a fonte.
        </p>
      </section>
    )
  }

  if (finished) {
    const record = score >= best[mode] && score > 0
    return (
      <section className="animate-rise rounded-2xl border border-line bg-elevated p-6 text-center sm:p-10">
        <p className="text-xs uppercase tracking-[0.08em] text-subtle">Resultado</p>
        <p className="mt-2 font-serif text-6xl tabular-nums">{score}</p>
        <p className="mt-1 text-muted">
          {hits} de {quiz.length} acertos{record ? ' · novo recorde!' : ` · recorde: ${best[mode]}`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => start(mode)} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90">
            Jogar de novo
          </button>
          <button type="button" onClick={() => setMode(null)} className="rounded-lg border border-line px-4 py-2 text-sm hover:border-accent/40">
            Trocar modo
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`Fiz ${score} pontos (${hits}/${quiz.length}) no Quiz MasterChef 🍳 ${location.origin}/jogos/quiz`)
                toast('Resultado copiado')
              } catch {
                toast('Não foi possível copiar')
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm hover:border-accent/40"
          >
            <ShareIcon className="size-4" /> Compartilhar
          </button>
        </div>
      </section>
    )
  }

  if (!q) return null
  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between text-sm text-subtle">
        <span>
          Pergunta {index + 1}/{quiz.length}
        </span>
        <span className="tabular-nums">
          {score} pts{streak >= 2 ? ` · sequência ${streak} 🔥` : ''}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="Tempo restante" aria-valuenow={Math.ceil(left)} aria-valuemin={0} aria-valuemax={SECONDS}>
        <div className={`h-full rounded-full transition-[width] duration-200 ${left < 5 ? 'bg-negative' : 'bg-accent'}`} style={{ width: `${(left / SECONDS) * 100}%` }} />
      </div>

      <div key={index} className="mt-5 animate-rise rounded-2xl border border-line bg-elevated p-5 sm:p-7">
        {q.photo && (
          <div className="mx-auto mb-5 size-40 overflow-hidden rounded-2xl bg-surface sm:size-48">
            <img
              src={q.photo}
              alt="Foto do participante (desfocada até você responder)"
              referrerPolicy="no-referrer"
              className="size-full object-cover object-top transition-[filter] duration-300"
              style={{ filter: `blur(${blur}px)` }}
              draggable={false}
            />
          </div>
        )}
        <h2 className="font-serif text-2xl leading-snug tracking-tight text-balance">{q.prompt}</h2>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {q.options.map((opt) => {
            const isAnswer = opt === q.answer
            const state = chosen === null ? 'idle' : isAnswer ? 'right' : opt === chosen ? 'wrong' : 'dim'
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => answer(opt)}
                  disabled={chosen !== null}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    state === 'right'
                      ? 'border-positive/50 bg-positive/12'
                      : state === 'wrong'
                        ? 'border-negative/50 bg-negative/12'
                        : state === 'dim'
                          ? 'border-line opacity-50'
                          : 'border-line hover:border-accent/50 hover:bg-surface/60'
                  }`}
                >
                  <span>{opt}</span>
                  {state === 'right' && <CheckIcon className="size-4 shrink-0 text-positive" />}
                  {state === 'wrong' && <CloseIcon className="size-4 shrink-0 text-negative" />}
                </button>
              </li>
            )
          })}
        </ul>

        {chosen !== null && (
          <div className="mt-5 animate-rise border-t border-line pt-4">
            <p className="text-sm">
              <strong className={chosen === q.answer ? 'text-positive' : 'text-negative'}>
                {chosen === q.answer ? 'Acertou!' : chosen === '' ? 'Tempo esgotado.' : 'Errou.'}
              </strong>{' '}
              <span className="text-muted">{q.explain}</span>
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              {q.source ? (
                <a href={q.source} target="_blank" rel="noopener noreferrer" className="text-xs text-subtle underline-offset-2 hover:text-fg hover:underline">
                  Fonte: Wikipédia
                </a>
              ) : (
                <span className="text-xs text-subtle">Foto: divulgação/Band</span>
              )}
              <button type="button" onClick={next} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg hover:opacity-90" autoFocus>
                {index + 1 < quiz.length ? 'Próxima' : 'Ver resultado'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function ModeCard({ title, text, best, onStart }: { title: string; text: string; best: number; onStart: () => void }) {
  return (
    <button type="button" onClick={onStart} className="group rounded-2xl border border-line p-6 text-left transition-colors hover:border-accent/50 hover:bg-surface/40">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
      <p className="mt-4 flex items-center justify-between text-sm">
        <span className="text-subtle">{best > 0 ? `Recorde: ${best} pts` : 'Ainda sem recorde'}</span>
        <span className="font-medium text-accent group-hover:underline">Jogar →</span>
      </p>
    </button>
  )
}
