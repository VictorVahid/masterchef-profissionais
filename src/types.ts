export type ParticipantStatus = 'ativo' | 'eliminado'

/** Perfil do participante (dados que não mudam ao longo da temporada) */
export interface Participant {
  id: string
  name: string
  age: number
  /** Cidade de origem */
  city: string
  /** Onde vive hoje, quando diferente da origem */
  livesIn?: string
  /** URL da foto. Pode ser absoluta ou relativa a /public */
  photo: string
  bio: string
  /** Já participou de outra edição da franquia MasterChef */
  veteran: boolean
  /** Edição anterior e resultado (ex.: "MasterChef Brasil 2022 · vice-campeã") */
  veteranOf?: string
  /** Restaurantes / casas por onde já passou */
  restaurants: string[]
  /** Atuação ou negócio atual */
  currentCompany: string
  /** Especialidade ou estilo de cozinha (omitido quando as fontes não informam) */
  specialty?: string
  /** Destaques da carreira e da temporada */
  highlights: string[]
}

/**
 * Resultado de cada participante num episódio:
 * - destaque: entre os melhores da prova principal (subiu direto ao mezanino)
 * - salvo: grupo intermediário, salvo antes da prova de eliminação
 * - eliminatoria: disputou a prova de eliminação e permaneceu
 * - eliminado: deixou a competição neste episódio
 * - participou: competiu, mas as fontes não detalham o desempenho
 * - campeao / vice: resultado da final
 */
export const OUTCOMES = ['destaque', 'salvo', 'eliminatoria', 'eliminado', 'participou', 'campeao', 'vice'] as const
export type Outcome = (typeof OUTCOMES)[number]

export interface Challenge {
  name: string
  description: string
  /** Quem venceu a prova */
  winnerId?: string
  /** A vitória rendeu um pin (vantagem) */
  pin: boolean
}

/** Um programa (episódio) da temporada */
export interface Episode {
  number: number
  title: string
  /** Data de exibição (ISO yyyy-mm-dd) */
  airDate: string
  summary: string
  /** Provas do episódio, na ordem em que aconteceram */
  challenges: Challenge[]
  /** Resultado de quem competiu no episódio, por id */
  results: Record<string, Outcome>
  /** Salvamentos usando vantagem (quem salvou → quem foi salvo) */
  saves?: { by: string; saved: string }[]
  /** Eliminados que voltaram à competição neste episódio (repescagem) */
  returned?: string[]
  guestJudges?: string[]
  /** Matérias usadas para registrar o episódio */
  sources?: string[]
  /** Quem registrou: "manual" ou "bot" (atualização automática) */
  updatedBy?: 'manual' | 'bot'
}

export interface Season {
  title: string
  edition: string
  year: number
  network: string
  schedule: string
  premiere: string
  prize: string
  judges: string[]
}

export interface Source {
  label: string
  url: string
}
