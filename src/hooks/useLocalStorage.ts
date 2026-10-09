import { useCallback, useEffect, useState } from 'react'

/**
 * Estado persistido no navegador de quem está vendo (favoritos, palpites).
 * Toda leitura/escrita é protegida: em modo privado ou com armazenamento
 * bloqueado, o recurso continua funcionando, só não lembra ao recarregar.
 */
export function useLocalStorage<T>(key: string, initial: T, isValid: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      const parsed: unknown = raw ? JSON.parse(raw) : initial
      // Dado adulterado ou de versão antiga: descarta em vez de quebrar a página
      return isValid(parsed) ? parsed : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // armazenamento indisponível
    }
  }, [key, value])

  // Sincroniza entre abas abertas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return
      try {
        const parsed: unknown = JSON.parse(e.newValue)
        if (isValid(parsed)) setValue(parsed)
      } catch {
        // valor corrompido: ignora
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, isValid])

  const reset = useCallback(() => setValue(initial), [initial])
  return [value, setValue, reset] as const
}
