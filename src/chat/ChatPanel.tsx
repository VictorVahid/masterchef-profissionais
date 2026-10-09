import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { useToast } from '@/components/Toast'
import { CloseIcon } from '@/components/icons'
import { BODY_MAX, chatConfig, FORBIDDEN_BODY, NICK_RE, REACTIONS } from './config'

interface Message {
  id: number
  nickname: string
  body: string
  created_at: string
}

interface Props {
  room: string
  episode: number
  live: boolean
  onClose: () => void
}

let client: SupabaseClient | null = null
function getClient() {
  if (!chatConfig) return null
  client ??= createClient(chatConfig.url, chatConfig.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mc:chat-auth' },
  })
  return client
}

/** Valida mensagens recebidas (mesmo vindas do servidor, nunca confiamos no formato) */
function isMessage(v: unknown): v is Message {
  const m = v as Message
  return (
    typeof m === 'object' && m !== null &&
    typeof m.id === 'number' &&
    typeof m.nickname === 'string' && m.nickname.length <= 20 &&
    typeof m.body === 'string' && m.body.length <= BODY_MAX &&
    typeof m.created_at === 'string'
  )
}

// Filtro leve de palavrões (a moderação de verdade é por denúncia/banimento)
const PROFANITY = /\b(porra|caralho|merda|buceta|cacete|fdp|vsf|vtnc|arrombad[oa]|desgraçad[oa]|filh[oa] da puta|puta|viad[oa]|corno)\b/gi
const soften = (s: string) => s.replace(PROFANITY, (w) => '•'.repeat(w.length))

const COLORS = ['text-accent', 'text-positive', 'text-[#6b8fd6]', 'text-[#b07ad1]', 'text-[#c9a227]', 'text-negative']
const colorFor = (nick: string) => COLORS[[...nick].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length]

const friendlyError = (msg: string) => {
  if (/devagar|limite|repetida|bloqueado/i.test(msg)) return msg.charAt(0).toUpperCase() + msg.slice(1) + '.'
  if (/check constraint|violates/i.test(msg)) return 'Mensagem não permitida (sem links, @ ou HTML).'
  if (/JWT|auth|session/i.test(msg)) return 'Sessão expirada. Feche e abra o chat de novo.'
  return 'Não foi possível enviar agora.'
}

export default function ChatPanel({ room, episode, live, onClose }: Props) {
  const toast = useToast()
  const supabase = useMemo(getClient, [])
  const [status, setStatus] = useState<'conectando' | 'ok' | 'erro'>(supabase ? 'conectando' : 'erro')
  const [messages, setMessages] = useState<Message[]>([])
  const [online, setOnline] = useState(0)
  const [floating, setFloating] = useState<{ id: number; emoji: string; left: number }[]>([])
  const [nick, setNick] = useState(() => {
    try {
      const saved = localStorage.getItem('mc:chat-apelido') ?? ''
      return NICK_RE.test(saved) ? saved : ''
    } catch {
      return ''
    }
  })
  const [nickDraft, setNickDraft] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const sala = useRef<RealtimeChannel | null>(null)
  const list = useRef<HTMLOListElement>(null)
  const lastReaction = useRef(0)

  const addFloating = useCallback((emoji: string) => {
    const id = Date.now() + Math.random()
    setFloating((f) => [...f.slice(-20), { id, emoji, left: 10 + Math.random() * 80 }])
    setTimeout(() => setFloating((f) => f.filter((x) => x.id !== id)), 2200)
  }, [])

  // Conexão: login anônimo → histórico → canais privados (mensagens e sala)
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const channels: RealtimeChannel[] = []
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          const { error } = await supabase.auth.signInAnonymously()
          if (error) throw error
        }
        await supabase.realtime.setAuth()

        const { data: history, error } = await supabase
          .from('chat_messages')
          .select('id, nickname, body, created_at')
          .eq('room', room)
          .order('created_at', { ascending: false })
          .limit(60)
        if (error) throw error
        if (cancelled) return
        setMessages((history ?? []).filter(isMessage).reverse())

        const chat = supabase
          .channel(`chat:${room}`, { config: { private: true } })
          .on('broadcast', { event: 'mensagem' }, ({ payload }) => {
            if (isMessage(payload)) setMessages((m) => (m.some((x) => x.id === payload.id) ? m : [...m.slice(-199), payload]))
          })
          .on('broadcast', { event: 'ocultar' }, ({ payload }) => {
            const id = (payload as { id?: unknown })?.id
            if (typeof id === 'number') setMessages((m) => m.filter((x) => x.id !== id))
          })
          .subscribe()

        const presenceKey = crypto.randomUUID()
        const salaCh = supabase
          .channel(`sala:${room}`, { config: { private: true, presence: { key: presenceKey } } })
          .on('presence', { event: 'sync' }, () => setOnline(Object.keys(salaCh.presenceState()).length))
          .on('broadcast', { event: 'reacao' }, ({ payload }) => {
            const emoji = (payload as { emoji?: unknown })?.emoji
            if (typeof emoji === 'string' && (REACTIONS as readonly string[]).includes(emoji)) addFloating(emoji)
          })
          .subscribe(async (s) => {
            if (s === 'SUBSCRIBED') await salaCh.track({})
          })
        sala.current = salaCh
        channels.push(chat, salaCh)
        setStatus('ok')
      } catch (err) {
        console.warn('[chat]', err)
        if (!cancelled) setStatus('erro')
      }
    })()
    return () => {
      cancelled = true
      channels.forEach((c) => supabase.removeChannel(c))
      sala.current = null
    }
  }, [supabase, room, addFloating])

  // Rola para o fim quando chega mensagem (se já estiver perto do fim)
  useEffect(() => {
    const el = list.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight
  }, [messages])

  const saveNick = (e: FormEvent) => {
    e.preventDefault()
    const n = nickDraft.trim()
    if (!NICK_RE.test(n)) return toast('Apelido: 2 a 20 letras, números, espaço, ponto, _ ou -')
    setNick(n)
    try {
      localStorage.setItem('mc:chat-apelido', n)
    } catch {
      // sem armazenamento
    }
  }

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const text = body.replace(/\s+/g, ' ').trim()
    if (!supabase || !text || sending) return
    if (FORBIDDEN_BODY.test(text)) return toast('Sem links, @ ou HTML no chat')
    setSending(true)
    const { error } = await supabase.from('chat_messages').insert({ room, nickname: nick, body: text })
    setSending(false)
    if (error) return toast(friendlyError(error.message))
    setBody('')
  }

  const react = (emoji: string) => {
    if (Date.now() - lastReaction.current < 800) return
    lastReaction.current = Date.now()
    addFloating(emoji)
    sala.current?.send({ type: 'broadcast', event: 'reacao', payload: { emoji } })
  }

  const report = async (m: Message) => {
    if (!supabase || !confirm(`Denunciar a mensagem de ${m.nickname}?`)) return
    const { error } = await supabase.from('chat_reports').insert({ message_id: m.id })
    setMessages((list) => list.filter((x) => x.id !== m.id))
    toast(error && !/duplicate/i.test(error.message) ? 'Não foi possível denunciar' : 'Denúncia enviada. Obrigado!')
  }

  return (
    <section
      role="dialog"
      aria-label="Chat ao vivo"
      className="fixed inset-x-2 bottom-20 z-30 flex h-[min(70dvh,560px)] flex-col overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl animate-rise sm:inset-x-auto sm:right-6 sm:w-96"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-lg leading-none">
            {live && <span className="size-2 rounded-full bg-negative" aria-hidden />}
            {live ? `Ao vivo · EP ${episode}` : `Esquenta do EP ${episode}`}
          </h2>
          <p className="mt-1 text-xs text-subtle">{status === 'ok' ? `${online || 1} online` : status === 'conectando' ? 'conectando…' : 'indisponível'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar chat" className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-fg">
          <CloseIcon className="size-4" />
        </button>
      </header>

      {!chatConfig ? (
        <p className="m-auto max-w-64 text-center text-sm text-muted">O chat ainda não foi ativado neste site. Volte em breve!</p>
      ) : status === 'erro' ? (
        <p className="m-auto max-w-64 text-center text-sm text-muted">Não foi possível conectar ao chat agora. Tente de novo em instantes.</p>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-28 top-16 overflow-hidden" aria-hidden>
            {floating.map((f) => (
              <span key={f.id} className="absolute bottom-0 animate-[floatUp_2.2s_ease-out_forwards] text-2xl" style={{ left: `${f.left}%` }}>
                {f.emoji}
              </span>
            ))}
          </div>

          <ol ref={list} className="flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
            {messages.length === 0 && status === 'ok' && (
              <li className="py-8 text-center text-subtle">Ninguém falou ainda. Comece a conversa!</li>
            )}
            {messages.map((m) => (
              <li key={m.id} className="group leading-snug">
                <span className={`font-medium ${colorFor(m.nickname)}`}>{m.nickname}</span>{' '}
                <span className="break-words">{soften(m.body)}</span>
                <button
                  type="button"
                  onClick={() => report(m)}
                  className="ml-1 text-[11px] text-subtle opacity-0 hover:text-negative group-hover:opacity-100 focus:opacity-100"
                >
                  denunciar
                </button>
              </li>
            ))}
          </ol>

          <div className="flex justify-between gap-1 border-t border-line px-3 py-2">
            {REACTIONS.map((r) => (
              <button key={r} type="button" onClick={() => react(r)} disabled={status !== 'ok'} aria-label={`Reagir com ${r}`} className="rounded-lg px-2 py-1 text-xl hover:bg-surface disabled:opacity-40">
                {r}
              </button>
            ))}
          </div>

          {nick ? (
            <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
              <label className="sr-only" htmlFor="chat-msg">
                Mensagem
              </label>
              <input
                id="chat-msg"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={BODY_MAX}
                placeholder={`Fale como ${nick}…`}
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent/50 focus:outline-none"
              />
              <button type="submit" disabled={!body.trim() || sending || status !== 'ok'} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg disabled:opacity-40">
                Enviar
              </button>
            </form>
          ) : (
            <form onSubmit={saveNick} className="space-y-2 border-t border-line p-3">
              <label htmlFor="chat-nick" className="block text-xs text-subtle">
                Escolha um apelido para conversar (não use seu nome completo)
              </label>
              <div className="flex gap-2">
                <input
                  id="chat-nick"
                  value={nickDraft}
                  onChange={(e) => setNickDraft(e.target.value)}
                  maxLength={20}
                  placeholder="Ex.: Fã da Irina"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm focus:border-accent/50 focus:outline-none"
                />
                <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg">
                  Entrar
                </button>
              </div>
            </form>
          )}
          <p className="px-3 pb-2 text-[11px] leading-snug text-subtle">
            Seja gentil. Não compartilhe dados pessoais. Mensagens somem em 7 dias; 3 denúncias ocultam uma mensagem.
          </p>
        </>
      )}
    </section>
  )
}
