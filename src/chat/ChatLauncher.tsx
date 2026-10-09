import { lazy, Suspense, useState } from 'react'
import type { Episode } from '@/types'
import { useNow } from '@/hooks/useNow'
import { nextEpisode } from '@/lib/schedule'

// O painel (e o cliente do Supabase) só é baixado quando alguém abre o chat
const ChatPanel = lazy(() => import('./ChatPanel'))

/** Botão flutuante do chat; pulsa quando o episódio está no ar */
export function ChatLauncher({ last }: { last: Episode }) {
  const [open, setOpen] = useState(false)
  const now = useNow(30_000)
  const next = nextEpisode(last.number, last.airDate, now)
  const room = `ep-${next.number}`

  return (
    <>
      {open && (
        <Suspense
          fallback={
            <div className="fixed bottom-24 right-4 z-30 rounded-2xl border border-line bg-elevated px-4 py-3 text-sm text-muted shadow-xl">
              Abrindo o chat…
            </div>
          }
        >
          <ChatPanel room={room} episode={next.number} live={next.live} onClose={() => setOpen(false)} />
        </Suspense>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`fixed bottom-5 right-4 z-30 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg transition-transform hover:scale-[1.03] sm:right-6 ${
          next.live ? 'bg-negative text-white' : 'bg-fg text-bg'
        }`}
      >
        {next.live && (
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
        )}
        {open ? 'Fechar chat' : next.live ? `Chat ao vivo · EP ${next.number}` : 'Chat'}
      </button>
    </>
  )
}
