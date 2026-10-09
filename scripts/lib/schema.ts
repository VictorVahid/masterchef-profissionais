// Formato que o Claude Code deve gravar em .bot/extracted.json, e conversão
// para o formato salvo em src/data/episodes.json.
import { z } from 'zod'
import { OUTCOMES, type Episode } from '../../src/types.ts'

/** Matérias aceitas como fonte: só a seção de MasterChef do site da Band */
export const SOURCE_PREFIX = 'https://www.band.com.br/entretenimento/realities/masterchef/'

// Limites de tamanho: textos vêm de um modelo que lê conteúdo da web, então
// tudo é restrito ao mínimo necessário (defesa contra injeção de prompt).
// Textos de episódio nunca têm links nem marcação: se aparecerem, é suspeito.
const SUSPICIOUS = /https?:|www\.|javascript:|data:|<|>|!\[|\]\(|@\w/i
const text = (max: number) =>
  z.string().trim().min(1).max(max).refine((s) => !SUSPICIOUS.test(s), 'contém link, marcação ou menção')

export function buildSchema(ids: string[]) {
  const Id = z.enum(ids as [string, ...string[]])
  return z.object({
    newEpisodes: z
      .array(
        z.object({
          number: z.number().int().min(1).max(99),
          airDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Data de exibição no formato AAAA-MM-DD'),
          title: text(120),
          summary: text(600),
          challenges: z
            .array(
              z.object({
                name: text(80),
                description: text(300),
                winnerId: Id.nullable(),
                pin: z.boolean(),
              }),
            )
            .min(1)
            .max(6),
          results: z.array(z.object({ participantId: Id, outcome: z.enum(OUTCOMES) })).max(ids.length),
          saves: z.array(z.object({ by: Id, saved: Id })).max(10),
          returned: z.array(Id).max(ids.length),
          guestJudges: z.array(text(60)).max(10),
          sourceUrls: z.array(z.string().max(300).startsWith(SOURCE_PREFIX)).min(1).max(10),
          confidence: z.enum(['alta', 'media', 'baixa']),
          notes: z.string().trim().max(600).refine((s) => !SUSPICIOUS.test(s), 'contém link, marcação ou menção').describe('Divergências entre fontes ou lacunas; vazio se não houver'),
        }),
      )
      .max(3),
  })
}

export type Extraction = z.infer<ReturnType<typeof buildSchema>>
export type ExtractedEpisode = Extraction['newEpisodes'][number]

/** Converte o formato extraído para o formato salvo em episodes.json */
export function toEpisode(e: ExtractedEpisode): Episode {
  return {
    number: e.number,
    title: e.title,
    airDate: e.airDate,
    summary: e.summary,
    challenges: e.challenges.map((c) => ({
      name: c.name,
      description: c.description,
      ...(c.winnerId ? { winnerId: c.winnerId } : {}),
      pin: c.pin,
    })),
    results: Object.fromEntries(e.results.map((r) => [r.participantId, r.outcome])),
    ...(e.saves.length ? { saves: e.saves } : {}),
    ...(e.returned.length ? { returned: e.returned } : {}),
    ...(e.guestJudges.length ? { guestJudges: e.guestJudges } : {}),
    sources: e.sourceUrls,
    updatedBy: 'bot',
  }
}
