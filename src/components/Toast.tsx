import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const ToastContext = createContext<(message: string) => void>(() => {})

/** Avisos rápidos de confirmação ("Link copiado", "Palpite salvo"...) */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((text: string) => {
    setMessage(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {message && (
          <div className="animate-rise rounded-full bg-fg px-4 py-2 text-sm text-bg shadow-lg">{message}</div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
