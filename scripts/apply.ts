/**
 * Etapa 3 do robô — aplicação (gratuita, sem IA).
 *
 * Lê .bot/context.json (coleta) e, se existir, .bot/extracted.json (gravado pelo
 * Claude Code), valida tudo e atualiza src/data: fotos, episódios e meta.
 * Sinaliza ao workflow: noop (nada mudou), publish (commit direto) ou review
 * (abrir PR para revisão humana).
 *
 * Tudo o que vem da extração é tratado como NÃO CONFIÁVEL (o modelo lê conteúdo
 * da web e pode ser alvo de injeção de prompt): tamanho limitado, varredura de
 * credenciais, schema estrito e texto neutralizado antes de ir para commit/PR.
 *
 *   npx tsx scripts/apply.ts
 */
import { existsSync, statSync } from 'node:fs'
import type { Episode } from '../src/types.ts'
import { participants } from '../src/data/participants.ts'
import { buildSchema, toEpisode } from './lib/schema.ts'
import { validateEpisode, type Check } from './lib/validate.ts'
import { findSecrets, plain } from './lib/secrets.ts'
import { botFile, dataFile, output, readJson, writeJson, type BotContext } from './lib/common.ts'

function fail(message: string): never {
  console.error(`[aplicação] ${message}`)
  output('status', 'error')
  process.exit(1)
}

const context = readJson<BotContext>(botFile('context.json'))
const episodes = readJson<Episode[]>(dataFile('episodes.json'))
const photos = readJson<Record<string, string>>(dataFile('photos.json'))

let status: 'noop' | 'publish' | 'review' = 'noop'
const summary: string[] = []

// Fotos oficiais: só https em img.band.com.br, e só para participantes conhecidos
const knownIds = new Set(participants.map((p) => p.id))
const PHOTO_URL = /^https:\/\/img\.band\.com\.br\/image\/[\w./-]{1,200}\.(png|jpe?g|webp)$/i
const officialPhotos = Object.fromEntries(
  Object.entries(context.photos ?? {}).filter(([id, url]) => knownIds.has(id) && typeof url === 'string' && PHOTO_URL.test(url)),
)
const newPhotos = Object.entries(officialPhotos).filter(([id, url]) => photos[id] !== url)
if (newPhotos.length) {
  writeJson(dataFile('photos.json'), Object.fromEntries(Object.entries({ ...photos, ...officialPhotos }).sort()))
  summary.push(`Fotos oficiais atualizadas: ${newPhotos.map(([id]) => id).join(', ')}`)
  status = 'publish'
}

// Episódios extraídos pelo Claude
const extractedPath = botFile('extracted.json')
if (context.needsExtraction && existsSync(extractedPath)) {
  if (statSync(extractedPath).size > 200_000) fail('.bot/extracted.json grande demais; descartado.')
  const raw = readJson<unknown>(extractedPath)

  // Bloqueio de vazamento: nada que pareça credencial chega a commit, PR ou site
  const leaked = findSecrets(raw)
  if (leaked.length) fail(`Possível credencial na extração (${leaked.join(', ')}); nada foi publicado.`)

  const parsed = buildSchema(participants.map((p) => p.id)).safeParse(raw)
  // JSON fora do formato: não grava nada, mas avisa com falha no workflow
  if (!parsed.success) fail('.bot/extracted.json não segue o schema:\n' + parsed.error.message)

  const extracted = parsed.data.newEpisodes.sort((a, b) => a.number - b.number)
  if (extracted.length === 0) console.log('[aplicação] O Claude não encontrou episódio novo.')

  const working = [...episodes]
  const report: string[] = []
  let blocked = false
  for (const e of extracted) {
    const check = validateEpisode(e, working, participants, context.articles, context.headlines)
    working.push(toEpisode(e))
    blocked ||= check.errors.length + check.warnings.length > 0
    report.push(formatReport(working.at(-1)!, check))
    summary.push(`EP ${e.number} (${e.airDate}): ${plain(e.title, 120)}`)
  }
  if (extracted.length) {
    writeJson(dataFile('episodes.json'), working)
    output('report', report.join('\n\n'))
    status = blocked ? 'review' : 'publish'
  }
} else if (context.needsExtraction) {
  fail('Havia matérias novas, mas .bot/extracted.json não foi gerado.')
}

if (status !== 'noop') writeJson(dataFile('meta.json'), { updatedAt: new Date().toISOString() })
output('status', status)
output('summary', summary.join('\n') || 'Sem alterações')

function formatReport(ep: Episode, check: Check): string {
  const name = (id: string) => participants.find((p) => p.id === id)?.name ?? id
  // Textos vindos da extração são neutralizados: sem links, imagens, HTML ou menções
  const lines = [`### EP ${ep.number} — ${plain(ep.title, 120)} (${ep.airDate})`, '', plain(ep.summary, 600), '']
  for (const c of ep.challenges) {
    lines.push(`- **${plain(c.name, 80)}:** ${c.winnerId ? name(c.winnerId) : 'sem vencedor individual'}${c.pin ? ' (pin)' : ''}`)
  }
  const out = Object.entries(ep.results).filter(([, o]) => o === 'eliminado').map(([id]) => name(id))
  lines.push(`- **Eliminado(s):** ${out.join(', ') || 'ninguém'}`)
  if (check.errors.length) lines.push('', '**Erros:**', ...check.errors.map((x) => `- ${plain(x, 400)}`))
  if (check.warnings.length) lines.push('', '**Para revisar:**', ...check.warnings.map((x) => `- ${plain(x, 400)}`))
  if (check.info.length) lines.push('', '**Observações:**', ...check.info.map((x) => `- ${plain(x, 700)}`))
  lines.push('', '**Fontes:**', ...(ep.sources ?? []).map((u) => `- \`${u.replace(/`/g, '')}\``))
  return lines.join('\n')
}
