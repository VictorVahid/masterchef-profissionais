import type { Challenge, Episode, Outcome, Participant, ParticipantStatus } from '@/types'

export interface Standing {
  participant: Participant
  position: number
  /** Pins conquistados até o episódio selecionado */
  pins: number
  /** Vezes entre os destaques da prova principal */
  tops: number
  /** Idas à prova de eliminação */
  eliminationTests: number
  status: ParticipantStatus
  eliminatedIn?: number
  /** Resultado no episódio selecionado (null se não competiu) */
  outcome: Outcome | null
  /** Provas vencidas no episódio selecionado */
  wonChallenges: Challenge[]
  /** Variação de posição vs. episódio anterior (positivo = subiu) */
  trend: number
}

export const outcomeLabel: Record<Outcome, string> = {
  destaque: 'Destaque',
  salvo: 'Salvo',
  eliminatoria: 'Prova de eliminação',
  eliminado: 'Eliminado',
  participou: 'Participou',
  campeao: 'Campeão',
  vice: 'Vice-campeão',
}

/** Peso do resultado da final na ordenação (campeão antes de vice antes do resto) */
const finalWeight: Partial<Record<Outcome, number>> = { campeao: 2, vice: 1 }

/**
 * Classificação até `upTo` (inclusive). O programa não divulga pontos, então o
 * critério é: resultado da final → pins → vezes entre os destaques → menos idas
 * à eliminação → nome. Eliminados ficam ao final, do mais recente ao mais antigo.
 */
export function computeStandings(participants: Participant[], episodes: Episode[], upTo: number): Standing[] {
  const played = episodes.filter((e) => e.number <= upTo)
  const current = played.at(-1)

  const rows = participants.map((participant) => {
    const id = participant.id
    const outcomes = played.map((e) => e.results[id]).filter(Boolean)

    // Percorre em ordem para considerar repescagens (eliminado → voltou)
    let eliminatedIn: number | undefined
    for (const e of played) {
      if (e.returned?.includes(id)) eliminatedIn = undefined
      if (e.results[id] === 'eliminado') eliminatedIn = e.number
    }

    return {
      participant,
      pins: played.flatMap((e) => e.challenges).filter((c) => c.pin && c.winnerId === id).length,
      tops: outcomes.filter((o) => o === 'destaque').length,
      eliminationTests: outcomes.filter((o) => o === 'eliminatoria' || o === 'eliminado').length,
      final: Math.max(0, ...outcomes.map((o) => finalWeight[o] ?? 0)),
      eliminatedIn,
      status: (eliminatedIn ? 'eliminado' : 'ativo') as ParticipantStatus,
      outcome: current?.results[id] ?? null,
      wonChallenges: current?.challenges.filter((c) => c.winnerId === id) ?? [],
    }
  })

  const active = rows
    .filter((r) => r.status === 'ativo')
    .sort(
      (a, b) =>
        b.final - a.final ||
        b.pins - a.pins ||
        b.tops - a.tops ||
        a.eliminationTests - b.eliminationTests ||
        a.participant.name.localeCompare(b.participant.name, 'pt-BR'),
    )
  const out = rows
    .filter((r) => r.status === 'eliminado')
    .sort((a, b) => (b.eliminatedIn ?? 0) - (a.eliminatedIn ?? 0))

  const previous = upTo > 1 ? positions(participants, episodes, upTo - 1) : null

  return [...active, ...out].map(({ final: _final, ...r }, i) => ({
    ...r,
    position: i + 1,
    trend: previous && r.status === 'ativo' ? (previous.get(r.participant.id) ?? i + 1) - (i + 1) : 0,
  }))
}

function positions(participants: Participant[], episodes: Episode[], upTo: number) {
  return new Map(computeStandings(participants, episodes, upTo).map((s) => [s.participant.id, s.position]))
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase()
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', opts)
}
