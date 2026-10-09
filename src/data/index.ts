import type { Episode, Participant, Season, Source } from '@/types'
import { participants } from './participants'
import episodesJson from './episodes.json'
import metaJson from './meta.json'

// Camada de acesso aos dados.
// - participants.ts: perfis (estáticos, editados à mão)
// - episodes.json / photos.json / meta.json: gerados pelo robô de atualização
//   (scripts/update-season.ts), que roda no GitHub Actions após cada episódio.

const episodes = episodesJson as Episode[]

export const meta: { updatedAt: string } = metaJson

export const season: Season = {
  title: 'MasterChef Profissionais',
  edition: '6ª temporada',
  year: 2026,
  network: 'Band',
  schedule: 'Terças, 22h30',
  premiere: '2026-10-06',
  prize: 'R$ 300 mil, troféu e viagem gastronômica à Itália',
  judges: ['Erick Jacquin', 'Henrique Fogaça', 'Helena Rizzo'],
}

export const sources: Source[] = [
  { label: 'Band — MasterChef', url: 'https://www.band.com.br/entretenimento/realities/masterchef' },
  { label: 'AdoroCinema — elenco', url: 'https://www.adorocinema.com/televisao/noticias/noticia-1000225769.html' },
  { label: 'Observatório da TV — elenco', url: 'https://observatoriodatv.com.br/noticias/masterchef-profissionais-2026-conheca-os-18-participantes-da-nova-temporada' },
  { label: 'Exame — elenco', url: 'https://exame.com/pop/masterchef-profissionais-2026-quem-sao-os-participantes-da-nova-temporada/' },
]

const byId = new Map(participants.map((p) => [p.id, p]))

export function getParticipants(): Participant[] {
  return participants
}

export function getParticipant(id: string): Participant | undefined {
  return byId.get(id)
}

/** Episódios já exibidos, em ordem */
export function getEpisodes(): Episode[] {
  return episodes
}

export function getEpisode(number: number): Episode | undefined {
  return episodes.find((e) => e.number === number)
}

if (import.meta.env.DEV) {
  for (const ep of episodes) {
    const ids = [
      ...Object.keys(ep.results),
      ...ep.challenges.flatMap((c) => (c.winnerId ? [c.winnerId] : [])),
      ...(ep.saves ?? []).flatMap((s) => [s.by, s.saved]),
      ...(ep.returned ?? []),
    ]
    for (const id of ids) {
      if (!byId.has(id)) console.warn(`[dados] EP ${ep.number}: participante desconhecido "${id}"`)
    }
  }
}
