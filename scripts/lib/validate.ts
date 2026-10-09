// Validações determinísticas do que o Claude extraiu. Qualquer problema faz o
// robô abrir um Pull Request para revisão em vez de publicar direto.
import type { Episode, Participant } from '../../src/types.ts'
import type { Article, Headline } from './sources.ts'
import type { ExtractedEpisode } from './schema.ts'

export interface Check {
  /** Bloqueiam a publicação automática */
  errors: string[]
  /** Também bloqueiam: exigem revisão humana */
  warnings: string[]
  /** Apenas informativos (vão para o relatório / mensagem do commit) */
  info: string[]
}

/** Quem está na disputa e quem foi eliminado depois de `episodes` */
export function rosterAfter(participants: Participant[], episodes: Episode[]) {
  const eliminated = new Set<string>()
  for (const e of episodes) {
    for (const id of e.returned ?? []) eliminated.delete(id)
    for (const [id, o] of Object.entries(e.results)) if (o === 'eliminado') eliminated.add(id)
  }
  return {
    activeIds: participants.map((p) => p.id).filter((id) => !eliminated.has(id)),
    eliminatedIds: [...eliminated],
  }
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function validateEpisode(
  e: ExtractedEpisode,
  previous: Episode[],
  participants: Participant[],
  articles: Article[],
  headlines: Headline[],
  now = new Date(),
): Check {
  const errors: string[] = []
  const warnings: string[] = []
  const info: string[] = []
  const last = previous.at(-1)!
  const { activeIds, eliminatedIds } = rosterAfter(participants, previous)
  const name = (id: string) => participants.find((p) => p.id === id)?.name ?? id

  // Sequência e datas
  if (e.number !== last.number + 1) errors.push(`Número do episódio ${e.number}; esperado ${last.number + 1}.`)
  const air = new Date(`${e.airDate}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.airDate) || Number.isNaN(air.getTime())) errors.push(`Data inválida: ${e.airDate}.`)
  else {
    if (e.airDate <= last.airDate) errors.push(`Data ${e.airDate} não é posterior ao EP ${last.number} (${last.airDate}).`)
    if (air.getTime() > now.getTime() + 86_400_000) errors.push(`Data ${e.airDate} está no futuro.`)
  }

  // Participantes
  const ids = e.results.map((r) => r.participantId)
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupes.length) errors.push(`Participantes repetidos em results: ${[...new Set(dupes)].map(name).join(', ')}.`)
  const competing = new Set([...activeIds, ...e.returned])
  for (const id of activeIds) if (!ids.includes(id)) errors.push(`${name(id)} está na disputa mas não tem resultado.`)
  for (const id of ids) {
    if (!competing.has(id)) errors.push(`${name(id)} já tinha sido eliminado(a) e não consta como repescado(a).`)
  }
  for (const id of e.returned) if (!eliminatedIds.includes(id)) errors.push(`${name(id)} marcado(a) como repescado(a) sem ter sido eliminado(a).`)

  // Provas e salvamentos
  if (e.challenges.length === 0) errors.push('Nenhuma prova registrada.')
  for (const c of e.challenges) {
    if (c.winnerId && !ids.includes(c.winnerId)) errors.push(`Vencedor(a) da "${c.name}" (${name(c.winnerId)}) não competiu no episódio.`)
  }
  for (const s of e.saves) {
    if (!ids.includes(s.by) || !ids.includes(s.saved)) errors.push(`Salvamento inválido: ${name(s.by)} → ${name(s.saved)}.`)
  }

  // Fontes
  const known = new Set(articles.map((a) => a.url))
  if (e.sourceUrls.length === 0) errors.push('Nenhuma fonte citada.')
  for (const url of e.sourceUrls) if (!known.has(url)) errors.push(`Fonte desconhecida: ${url}.`)

  // Confirmação cruzada das eliminações: nome citado em ao menos 2 fontes distintas
  const corpus = [
    ...articles.map((a) => ({ origin: a.url, text: normalize(`${a.title} ${a.text}`) })),
    ...headlines.map((h) => ({ origin: h.outlet, text: normalize(h.title) })),
  ]
  for (const r of e.results.filter((r) => r.outcome === 'eliminado')) {
    const first = normalize(name(r.participantId).split(' ')[0])
    const full = normalize(name(r.participantId))
    const origins = new Set(
      corpus.filter((c) => (c.text.includes(full) || c.text.includes(first)) && /elimina/.test(c.text)).map((c) => c.origin),
    )
    if (origins.size < 2) warnings.push(`Eliminação de ${name(r.participantId)} confirmada por apenas ${origins.size} fonte(s).`)
  }

  if (e.confidence !== 'alta') warnings.push(`Confiança da extração: ${e.confidence}.`)
  if (e.notes.trim()) info.push(`Observações do extrator: ${e.notes.trim()}`)
  const unknown = e.results.filter((r) => r.outcome === 'participou').length
  if (unknown > 0) info.push(`${unknown} participante(s) sem desempenho detalhado ("participou").`)

  return { errors, warnings, info }
}
