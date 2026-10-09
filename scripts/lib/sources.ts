// Coleta de fontes para o robô de atualização.
// - Band (emissora oficial): matérias completas, com data de publicação, e fotos oficiais.
// - Google Notícias (RSS): manchetes de outros veículos, usadas para confirmação cruzada.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const BAND = 'https://www.band.com.br'
const BAND_SECTION = `${BAND}/entretenimento/realities/masterchef`
// A Band responde 403 a User-Agents de robô; o acesso é leve (2x/dia, páginas públicas).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

export interface Article {
  url: string
  title: string
  publishedAt: string
  text: string
}

export interface Headline {
  title: string
  outlet: string
  publishedAt: string
}

/** Leitor gratuito que baixa a página nos servidores dele e devolve o HTML (https://jina.ai/reader) */
const READER = 'https://r.jina.ai/'
/** Depois que o acesso direto falha uma vez, as próximas requisições já vão pelo leitor */
let useReader = process.env.BOT_USE_READER === '1'

async function curl(url: string, headers: string[] = [], timeout = 30, browserUA = true): Promise<string> {
  const args = ['-sSL', '--compressed', '-m', String(timeout), '-H', 'accept-language: pt-BR,pt;q=0.9']
  if (browserUA) args.push('-A', UA)
  for (const h of headers) args.push('-H', h)
  const { stdout } = await execFileAsync('curl', [...args, '-w', '\n%{http_code}', url], { maxBuffer: 20 * 1024 * 1024 })
  const cut = stdout.lastIndexOf('\n')
  const status = Number(stdout.slice(cut + 1))
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status} em ${url}`)
  return stdout.slice(0, cut)
}

/**
 * Baixa uma página. Tenta direto com o curl (o Cloudflare da Band bloqueia o
 * fetch nativo do Node). Se o acesso direto for bloqueado — o que acontece a
 * partir dos servidores do GitHub Actions —, usa o leitor do Jina.
 */
async function fetchText(url: string): Promise<string> {
  if (!useReader) {
    try {
      return await curl(url)
    } catch (err) {
      if (!/HTTP (403|429|503)/.test((err as Error).message)) throw err
      console.warn(`[fontes] acesso direto bloqueado (${(err as Error).message}); usando o leitor ${READER}`)
      useReader = true
    }
  }
  // O plano gratuito do leitor limita a frequência: pequena pausa entre requisições
  await new Promise((r) => setTimeout(r, 3000))
  // Sem User-Agent de navegador: o Cloudflare do leitor desafia curl "disfarçado"
  return curl(READER + url, ['X-Return-Format: html'], 60, false)
}

export function decodeEntities(s: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m)
}

const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** HTML da seção de MasterChef no site da Band */
export function fetchBandSection(): Promise<string> {
  return fetchText(BAND_SECTION)
}

/** Fotos oficiais dos participantes (slug da página do participante → URL da imagem) */
export function extractBandPhotos(sectionHtml: string): Record<string, string> {
  const photos: Record<string, string> = {}
  const re = /participantes\/([a-z0-9-]+)"[^<]{0,600}<img[^>]*?src="(https:\/\/img\.band\.com\.br\/[^"]+)"/g
  for (const [, id, src] of sectionHtml.matchAll(re)) photos[id] ??= src
  return photos
}

/** Matérias da seção de MasterChef publicadas depois de `since` (ISO) */
export async function fetchBandArticles(sectionHtml: string, since: Date, limit = 40): Promise<Article[]> {
  const paths = [
    ...new Set(
      [...sectionHtml.matchAll(/href="(\/entretenimento\/realities\/masterchef\/[a-z0-9-]+)"/g)].map((m) => m[1]),
    ),
  ].slice(0, limit)

  const articles: Article[] = []
  for (const path of paths) {
    try {
      const html = await fetchText(BAND + path)
      const publishedAt = html.match(/"datePublished":"([^"]+)"/)?.[1]
      if (!publishedAt || new Date(publishedAt) <= since) continue
      const title = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? html.match(/<title>([^<]+)/)?.[1] ?? path)
      const text = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
        .map((m) => stripTags(m[1]))
        .filter((t) => t.length > 40 && !/direitos reservados|MELHOR DA BAND/i.test(t))
        .join('\n')
      // Limites: evita prompts gigantes e conteúdo inesperado
      articles.push({ url: BAND + path, title: title.slice(0, 300), publishedAt, text: text.slice(0, 12_000) })
    } catch (err) {
      console.warn(`[fontes] falha ao ler ${path}: ${(err as Error).message}`)
    }
  }
  return articles
}

/** Manchetes recentes do Google Notícias sobre o programa */
export async function fetchNewsHeadlines(days = 14): Promise<Headline[]> {
  const q = encodeURIComponent(`"MasterChef Profissionais" when:${days}d`)
  try {
    const xml = await curl(`https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`)
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 60).map(([, item]) => {
      const outlet = stripTags(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '')
      const raw = stripTags(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
      return {
        title: outlet && raw.endsWith(` - ${outlet}`) ? raw.slice(0, -outlet.length - 3) : raw,
        outlet,
        publishedAt: new Date(item.match(/<pubDate>([^<]+)/)?.[1] ?? 0).toISOString(),
      }
    })
  } catch (err) {
    console.warn(`[fontes] Google Notícias indisponível: ${(err as Error).message}`)
    return []
  }
}
