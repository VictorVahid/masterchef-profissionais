import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { isStringArray } from '@/lib/safe'

interface Favorites {
  ids: Set<string>
  has: (id: string) => boolean
  /** Alterna e devolve se passou a ser favorito */
  toggle: (id: string) => boolean
}

const FavoritesContext = createContext<Favorites>({ ids: new Set(), has: () => false, toggle: () => false })

/** "Minha torcida": participantes favoritos, guardados no navegador */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useLocalStorage<string[]>('mc:favoritos', [], isStringArray)
  const ids = useMemo(() => new Set(list), [list])

  const toggle = useCallback(
    (id: string) => {
      const adding = !ids.has(id)
      setList((l) => (adding ? [...l, id] : l.filter((x) => x !== id)))
      return adding
    },
    [ids, setList],
  )

  const value = useMemo(() => ({ ids, has: (id: string) => ids.has(id), toggle }), [ids, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export const useFavorites = () => useContext(FavoritesContext)
