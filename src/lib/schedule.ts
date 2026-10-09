// Agenda do programa: semanal, às terças, 22h30 (horário de Brasília, UTC−3).

const WEEK = 7 * 86_400_000
/** Duração aproximada de um episódio no ar */
export const EPISODE_DURATION = 2 * 3_600_000 + 15 * 60_000

/** Horário de exibição (UTC) de uma data AAAA-MM-DD às 22h30 de Brasília */
export const airTime = (isoDate: string) => new Date(`${isoDate}T22:30:00-03:00`)

export interface NextEpisode {
  number: number
  start: Date
  /** Está no ar neste momento */
  live: boolean
}

/**
 * Próximo episódio (ou o que está no ar), contando semanas a partir do último
 * episódio registrado. Se o robô ainda não registrou um episódio que já foi ao
 * ar, a numeração avança mesmo assim.
 */
export function nextEpisode(lastNumber: number, lastAirDate: string, now = new Date()): NextEpisode {
  let number = lastNumber + 1
  let start = new Date(airTime(lastAirDate).getTime() + WEEK)
  while (now.getTime() >= start.getTime() + EPISODE_DURATION) {
    start = new Date(start.getTime() + WEEK)
    number++
  }
  return { number, start, live: now >= start }
}

/** "3d 04h 12min" / "04h 12min 09s" */
export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3_600)
  const m = Math.floor((s % 3_600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}min` : `${pad(h)}h ${pad(m)}min ${pad(s % 60)}s`
}
