import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
  /** Classe de largura do painel */
  width?: string
  /** Alinha o painel ao topo (paleta de busca) em vez de centralizar */
  top?: boolean
}

/** Janela sobreposta acessível: Esc e clique fora fecham, rolagem da página travada */
export function Modal({ open, onClose, label, children, width = 'max-w-2xl', top = false }: Props) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Foca o primeiro campo, ou o próprio painel
    requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('input, select, button')
      ;(first ?? panel.current)?.focus()
    })
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-40 flex justify-center overflow-y-auto bg-black/40 px-4 backdrop-blur-sm animate-fade ${
        top ? 'items-start pt-[12vh]' : 'items-center py-10'
      }`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`w-full ${width} rounded-2xl border border-line bg-elevated shadow-2xl outline-none animate-rise`}
      >
        {children}
      </div>
    </div>
  )
}
