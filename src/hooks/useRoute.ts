import { useCallback, useEffect, useState } from 'react'

export type Route = { view: 'temporada' } | { view: 'jogos'; game: 'copa' | 'quiz' | null }

function parse(pathname: string): Route {
  const [, first, second] = pathname.split('/')
  if (first === 'jogos') return { view: 'jogos', game: second === 'copa' || second === 'quiz' ? second : null }
  return { view: 'temporada' }
}

const toPath = (r: Route) => (r.view === 'jogos' ? `/jogos${r.game ? `/${r.game}` : ''}` : '/')

/** Roteamento mínimo pelo endereço (a Vercel devolve o index.html para qualquer caminho) */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(parse(location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((r: Route) => {
    const path = toPath(r)
    if (path !== location.pathname) history.pushState(null, '', path)
    setRoute(r)
    window.scrollTo({ top: 0 })
  }, [])

  return [route, navigate] as const
}
