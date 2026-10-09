/**
 * Etapa 1 do robô — coleta (gratuita, sem IA).
 *
 * Baixa as fotos oficiais e as matérias novas da Band, mais manchetes do Google
 * Notícias, e grava tudo em .bot/context.json junto com o JSON Schema esperado
 * da extração (.bot/schema.json). Não altera nenhum arquivo do site.
 *
 * Define needsExtraction=true só quando há matéria publicada depois do horário
 * previsto do próximo episódio (uma semana após o último, terça 22h30). Assim o
 * Claude não é acionado à toa pelas matérias de bastidores durante a semana.
 *
 *   npx tsx scripts/collect.ts           # coleta normal
 *   npx tsx scripts/collect.ts --force   # aciona a extração com as matérias que houver
 */
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { Episode } from '../src/types.ts'
import { participants } from '../src/data/participants.ts'
import { extractBandPhotos, fetchBandArticles, fetchBandSection, fetchNewsHeadlines } from './lib/sources.ts'
import { rosterAfter } from './lib/validate.ts'
import { buildSchema } from './lib/schema.ts'
import { botFile, dataFile, output, readJson, writeJson, type BotContext } from './lib/common.ts'

const WEEK = 7 * 86_400_000
const FORCE = process.argv.includes('--force')

const episodes = readJson<Episode[]>(dataFile('episodes.json'))
const last = episodes.at(-1)!
const knownIds = new Set(participants.map((p) => p.id))

const section = await fetchBandSection()
const photos = Object.fromEntries(Object.entries(extractBandPhotos(section)).filter(([id]) => knownIds.has(id)))

// Próximo episódio previsto: uma semana depois do último, às 22h30 de Brasília
const expectedNext = new Date(new Date(`${last.airDate}T22:30:00-03:00`).getTime() + WEEK)
let articles: BotContext['articles'] = []
let headlines: BotContext['headlines'] = []

if (Date.now() < expectedNext.getTime() && !FORCE) {
  console.log(`[coleta] Próximo episódio previsto para ${expectedNext.toISOString()}; nada a procurar ainda.`)
} else {
  // Matérias publicadas a partir do dia seguinte ao último episódio
  const since = new Date(new Date(`${last.airDate}T12:00:00Z`).getTime() + 86_400_000)
  const names = participants.map((p) => p.name.split(' ')[0].toLowerCase())
  articles = (await fetchBandArticles(section, since)).filter((a) => {
    const t = `${a.title} ${a.text}`.toLowerCase()
    return t.includes('profissionais') || names.some((n) => t.includes(n))
  })
  headlines = (await fetchNewsHeadlines()).filter((h) => new Date(h.publishedAt) >= since)
  console.log(`[coleta] ${articles.length} matéria(s) da Band e ${headlines.length} manchete(s) desde ${since.toISOString().slice(0, 10)}.`)
}

const { activeIds, eliminatedIds } = rosterAfter(participants, episodes)
const context: BotContext = {
  generatedAt: new Date().toISOString(),
  needsExtraction: FORCE ? articles.length > 0 : articles.some((a) => new Date(a.publishedAt) > expectedNext),
  lastEpisode: { number: last.number, airDate: last.airDate, title: last.title },
  participants: participants.map((p) => ({ id: p.id, name: p.name })),
  activeIds,
  eliminatedIds,
  photos,
  articles,
  headlines,
}

writeJson(botFile('context.json'), context)
writeJson(botFile('schema.json'), z.toJSONSchema(buildSchema([...knownIds])))
// O job do Claude roda numa pasta isolada, sem o repositório: leva as instruções junto
copyFileSync(fileURLToPath(new URL('./prompts/extract-episodes.md', import.meta.url)), botFile('instructions.md'))
output('needs_extraction', String(context.needsExtraction))
