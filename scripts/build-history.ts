/**
 * Monta src/data/history.json com todas as temporadas brasileiras do MasterChef
 * (exceto o MasterChef Júnior, que tem participantes menores de idade, e a
 * temporada atual do Profissionais, acompanhada pelo robô).
 *
 * Fonte: Wikipédia (en), via API pública. Usa só a tabela principal de
 * participantes (nome, idade, cidade, profissão, resultado, provas vencidas,
 * colocação) e os jurados do quadro de informações. Guarda o id da revisão de
 * cada página para que qualquer dado possa ser conferido depois.
 *
 *   npx tsx scripts/build-history.ts
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

interface SeasonSource {
  id: string
  page: string
  show: string
  edition: string
}

const SEASONS: SeasonSource[] = [
  ...Array.from({ length: 13 }, (_, i) => ({
    id: `brasil-${i + 1}`,
    page: `MasterChef (Brazilian TV series) season ${i + 1}`,
    show: 'MasterChef Brasil',
    edition: `${i + 1}ª temporada`,
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `profissionais-${i + 1}`,
    page: `MasterChef Profissionais season ${i + 1}`,
    show: 'MasterChef Profissionais',
    edition: `${i + 1}ª temporada`,
  })),
  { id: 'confeitaria-1', page: 'MasterChef Confeitaria season 1', show: 'MasterChef Confeitaria', edition: '1ª temporada' },
  { id: 'confeitaria-2', page: 'MasterChef Confeitaria season 2', show: 'MasterChef Confeitaria', edition: '2ª temporada' },
  { id: 'revanche-1', page: 'MasterChef: A Revanche', show: 'MasterChef: A Revanche', edition: 'Temporada única' },
  { id: 'mais-1', page: 'MasterChef + (Brazilian TV series) season 1', show: 'MasterChef+', edition: '1ª temporada' },
  { id: 'mais-2', page: 'MasterChef + (Brazilian TV series) season 2', show: 'MasterChef+', edition: '2ª temporada' },
  { id: 'celebridades-1', page: 'MasterChef Celebridades', show: 'MasterChef Celebridades', edition: 'Temporada única' },
]

export interface HistoryContestant {
  name: string
  age?: number
  hometown?: string
  occupation?: string
  /** Colocação final (1 = campeão) */
  finish?: number
  /** Provas vencidas (coluna "Winnings"), quando informada */
  wins?: number
  /** Resultado: campeao, vice, eliminado, desistiu... */
  result: 'campeao' | 'vice' | 'eliminado' | 'desistiu' | 'desclassificado' | 'outro'
  /** Falecido(a) (marcado com † na fonte) */
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

const API = 'https://en.wikipedia.org/w/api.php'
const UA = 'MasterChefFanSite/1.0 (projeto de fãs; dados para quiz)'

async function wikitext(page: string): Promise<{ text: string; revision: number; title: string } | null> {
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext|revid&redirects=1&format=json&formatversion=2&maxlag=5`
  // A API limita requisições: tenta de novo com espera crescente
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    const body = await res.text()
    try {
      const json = JSON.parse(body) as { parse?: { wikitext: string; revid: number; title: string } }
      return json.parse ? { text: json.parse.wikitext, revision: json.parse.revid, title: json.parse.title } : null
    } catch {
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)))
    }
  }
  throw new Error(`Wikipédia indisponível para ${page}`)
}

/** Remove marcação wiki de uma célula */
function clean(cell: string): string {
  let s = cell
  // Atributos da célula: "bgcolor=... | conteúdo"
  const attr = s.match(/^\s*(?:[a-z-]+\s*=\s*("[^"]*"|[^\s|]+)\s*)+\|(?!\|)/i)
  if (attr) s = s.slice(attr[0].length)
  for (let i = 0; i < 4; i++) {
    s = s
      .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/\{\{(?:nowrap|white|small|nobr|sortname)\|([^{}]*)\}\}/gi, (_, x) => x.replace(/\|/g, ' '))
      .replace(/\{\{(?:n\/a|na|sort)\|([^{}]*)\}\}/gi, '$1')
      .replace(/\{\{[^{}]*\}\}/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/'''?/g, '')
  }
  return s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function infobox(text: string, key: string): string | undefined {
  const m = text.match(new RegExp(`\\|\\s*${key}\\s*=([\\s\\S]*?)(?=\\n\\s*\\|\\s*[a-z_0-9]+\\s*=|\\n\\}\\})`, 'i'))
  return m?.[1]
}

function judges(text: string): string[] {
  const raw = infobox(text, 'judges') ?? infobox(text, 'judge') ?? ''
  return [
    ...new Set(
      raw
        .split(/\n\*|<br\s*\/?>|,|\{\{plainlist\||\{\{ubl\|/i)
        .map(clean)
        .map((s) => s.replace(/^\*\s*/, '').replace(/[{}|]/g, '').trim())
        .filter((s) => /^[A-ZÀ-Ý][\p{L} .'-]{2,40}$/u.test(s)),
    ),
  ]
}

/** Encontra a tabela de participantes (cabeçalho com "Contestant"/"Name" e "Finish"/"Result") */
function contestantTable(text: string): { headers: string[]; rows: string[][] } | null {
  const tables = text.match(/\{\|[\s\S]*?\n\|\}/g) ?? []
  for (const t of tables) {
    const lines = t.split('\n')
    const headers: string[] = []
    for (const l of lines) {
      if (l.startsWith('!')) headers.push(...l.slice(1).split('!!').map((h) => clean(h).toLowerCase()))
      if (l.startsWith('|-') && headers.length) break
    }
    const has = (re: RegExp) => headers.some((h) => re.test(h))
    if (!(has(/contestant|name|celebrity/) && has(/finish|result|status|place/))) continue

    const rows: string[][] = []
    let row: string[] | null = null
    for (const l of lines.slice(1)) {
      if (l.startsWith('|-') || l.startsWith('|}')) {
        if (row?.length) rows.push(row)
        row = []
      } else if (row && l.startsWith('|') && !l.startsWith('|+')) {
        row.push(...l.slice(1).split('||'))
      } else if (row && l.startsWith('!')) {
        row.push(...l.slice(1).split('!!'))
      } else if (row?.length && !l.startsWith('!')) {
        row[row.length - 1] += '\n' + l
      }
    }
    return { headers, rows: rows.filter((r) => r.length >= Math.min(4, headers.length)) }
  }
  return null
}

function parseResult(s: string): HistoryContestant['result'] {
  const t = s.toLowerCase()
  if (/winner|champion|campe/.test(t)) return 'campeao'
  if (/runner|second|vice/.test(t)) return 'vice'
  if (/withdr|quit|desist|left/.test(t)) return 'desistiu'
  if (/disqualif|expel/.test(t)) return 'desclassificado'
  if (/eliminat/.test(t)) return 'eliminado'
  return 'outro'
}

function parseSeason(src: SeasonSource, text: string, revision: number, title: string): HistorySeason | null {
  const table = contestantTable(text)
  if (!table) return null
  const col = (re: RegExp) => table.headers.findIndex((h) => re.test(h))
  const iName = col(/contestant|name|celebrity/)
  const iAge = col(/^age/)
  const iTown = col(/hometown|from|city/)
  const iJob = col(/occupation|profession/)
  const iResult = col(/result|status/)
  const iWins = col(/winnings|wins/)
  const iFinish = col(/finish|place/)

  const contestants: HistoryContestant[] = []
  for (const r of table.rows) {
    if (r.length !== table.headers.length) continue // linhas com mesclagem: descartadas por segurança
    const rawName = r[iName] ?? ''
    const name = clean(rawName).replace(/[†‡*]/g, '').trim()
    // Linhas de cabeçalho repetidas no meio da tabela
    if (!name || name.length > 60 || table.headers.includes(name.toLowerCase())) continue
    const resultText = clean(r[iResult] ?? '')
    const finish = Number(clean(r[iFinish] ?? '').match(/^(\d{1,2})/)?.[1])
    const wins = Number(clean(r[iWins] ?? '').match(/^(\d{1,2})$/)?.[1])
    const age = Number(clean(r[iAge] ?? '').match(/^(\d{2})/)?.[1])
    contestants.push({
      name,
      ...(age ? { age } : {}),
      ...(iTown >= 0 && clean(r[iTown]) ? { hometown: clean(r[iTown]) } : {}),
      ...(iJob >= 0 && clean(r[iJob]) ? { occupation: clean(r[iJob]) } : {}),
      ...(finish ? { finish } : {}),
      ...(Number.isFinite(wins) && iWins >= 0 ? { wins } : {}),
      result: finish === 1 ? 'campeao' : finish === 2 ? 'vice' : parseResult(resultText),
      ...(/†/.test(rawName) ? { deceased: true } : {}),
    })
  }
  // Quem voltou por repescagem aparece duas vezes: mantém a linha com a colocação final
  const byName = new Map<string, HistoryContestant>()
  for (const c of contestants) {
    const prev = byName.get(c.name)
    if (!prev || (prev.finish === undefined && c.finish !== undefined)) byName.set(c.name, { ...prev, ...c })
  }
  contestants.splice(0, contestants.length, ...byName.values())
  if (contestants.length < 5) return null

  const year = Number(text.match(/first_aired\s*=[^\n]*?(\d{4})/i)?.[1]) || undefined
  const episodes = Number(infobox(text, 'num_episodes')?.match(/\d+/)?.[0]) || undefined
  return {
    id: src.id,
    show: src.show,
    edition: src.edition,
    ...(year ? { year } : {}),
    ...(episodes ? { episodes } : {}),
    judges: judges(text),
    contestants: contestants.sort((a, b) => (a.finish ?? 99) - (b.finish ?? 99)),
    source: { url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&oldid=${revision}`, revision },
  }
}

const seasons: HistorySeason[] = []
for (const src of SEASONS) {
  const page = await wikitext(src.page)
  if (!page) {
    console.warn(`✗ ${src.id}: página não encontrada (${src.page})`)
    continue
  }
  const season = parseSeason(src, page.text, page.revision, page.title)
  if (!season) {
    console.warn(`✗ ${src.id}: tabela de participantes não reconhecida`)
    continue
  }
  const champ = season.contestants.find((c) => c.result === 'campeao')?.name ?? '?'
  console.log(`✓ ${src.id.padEnd(16)} ${String(season.year ?? '?').padEnd(5)} ${String(season.contestants.length).padStart(2)} participantes · campeão: ${champ} · jurados: ${season.judges.join(', ') || '?'}`)
  seasons.push(season)
  await new Promise((r) => setTimeout(r, 1500)) // gentileza com a API
}

writeFileSync(
  fileURLToPath(new URL('../src/data/history.json', import.meta.url)),
  JSON.stringify({ generatedAt: new Date().toISOString(), license: 'Dados da Wikipédia (CC BY-SA 4.0)', seasons }, null, 2) + '\n',
)
console.log(`\n${seasons.length} temporadas, ${seasons.reduce((n, s) => n + s.contestants.length, 0)} participantes.`)
