// Base histórica (gerada por scripts/build-history.ts a partir da Wikipédia).
// Carregada só na área de jogos.
import data from '@/data/history.json'

export interface HistoryContestant {
  name: string
  age?: number
  hometown?: string
  occupation?: string
  finish?: number
  wins?: number
  result: 'campeao' | 'vice' | 'eliminado' | 'desistiu' | 'desclassificado' | 'outro'
  deceased?: boolean
}

export interface HistorySeason {
  id: string
  show: string
  edition: string
  year?: number
  episodes?: number
  judges: string[]
  contestants: HistoryContestant[]
  source: { url: string; revision: number }
}

export const seasons = (data as { seasons: HistorySeason[] }).seasons

export const seasonLabel = (s: HistorySeason) => `${s.show} ${s.year ?? ''}`.trim()

/** Chef jogável: participante com colocação conhecida, com nota derivada de dados reais */
export interface Chef {
  key: string
  name: string
  season: HistorySeason
  finish: number
  total: number
  wins?: number
  rating: number
  champion: boolean
}

/**
 * Nota do jogo (45–99), calculada só a partir de dados reais:
 * colocação final relativa ao tamanho do elenco (até 32 pts), provas vencidas
 * (1,2 pt cada, até 9), bônus de campeão (5) e de temporada profissional (3).
 * Distribuição resultante: campeões 92–97, vices 81–89, mediana ~67.
 */
function rate(finish: number, total: number, wins: number | undefined, show: string): number {
  const placement = total > 1 ? 1 - (finish - 1) / (total - 1) : 1
  let r = 48 + 32 * placement + Math.min(9, (wins ?? 0) * 1.2)
  if (finish === 1) r += 5
  if (show.includes('Profissionais')) r += 3
  return Math.round(Math.max(45, Math.min(99, r)))
}

export const chefs: Chef[] = seasons.flatMap((s) => {
  const ranked = s.contestants.filter((c) => c.finish)
  const total = Math.max(...ranked.map((c) => c.finish!), ranked.length)
  return ranked
    .filter((c) => !c.deceased) // em respeito, falecidos não entram no jogo de times
    .map((c) => ({
      key: `${s.id}:${c.name}`,
      name: c.name,
      season: s,
      finish: c.finish!,
      total,
      wins: c.wins,
      rating: rate(c.finish!, total, c.wins, s.show),
      champion: c.finish === 1,
    }))
})

/** Sorteio com semente opcional */
export function shuffle<T>(list: T[], rand = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const pick = <T,>(list: T[], rand = Math.random): T => list[Math.floor(rand() * list.length)]

export const initialsOf = (name: string) => {
  const parts = name.replace(/".*?"/g, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase()
}
