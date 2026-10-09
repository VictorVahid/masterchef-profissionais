import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Article, Headline } from './sources.ts'

/** Pasta de trabalho do robô (ignorada pelo git) */
export const BOT_DIR = fileURLToPath(new URL('../../.bot/', import.meta.url))
export const botFile = (name: string) => `${BOT_DIR}${name}`
export const dataFile = (name: string) => fileURLToPath(new URL(`../../src/data/${name}`, import.meta.url))

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T
export function writeJson(path: string, value: unknown) {
  mkdirSync(BOT_DIR, { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
}

/** Saída para o GitHub Actions (e log local) */
export function output(key: string, value: string) {
  console.log(`[saída] ${key}=${value.split('\n')[0]}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}<<__EOF__\n${value}\n__EOF__\n`)
}

/** Conteúdo de .bot/context.json, gerado pela coleta */
export interface BotContext {
  generatedAt: string
  /** Há matérias novas e já passou tempo suficiente: vale chamar o Claude */
  needsExtraction: boolean
  lastEpisode: { number: number; airDate: string; title: string }
  participants: { id: string; name: string }[]
  activeIds: string[]
  eliminatedIds: string[]
  photos: Record<string, string>
  articles: Article[]
  headlines: Headline[]
}
