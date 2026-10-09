import { useEffect, useState } from 'react'

interface Filters {
  episode: number
  participant: string | null
}

/**
 * Mantém os filtros (?ep=3&p=helena-duarte) sincronizados com a URL, para que
 * a visualização possa ser compartilhada por link.
 */
export function useUrlFilters(defaults: Filters, isValid: (f: Filters) => Filters) {
  const [filters, setFilters] = useState<Filters>(() => {
    const params = new URLSearchParams(window.location.search)
    const ep = Number(params.get('ep'))
    return isValid({
      episode: Number.isInteger(ep) && ep > 0 ? ep : defaults.episode,
      participant: params.get('p') ?? defaults.participant,
    })
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (filters.episode !== defaults.episode) params.set('ep', String(filters.episode))
    else params.delete('ep')
    if (filters.participant) params.set('p', filters.participant)
    else params.delete('p')
    const qs = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
  }, [filters, defaults.episode])

  return [filters, setFilters] as const
}
