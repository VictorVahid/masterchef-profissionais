// Configuração do chat (Supabase). As duas variáveis são PÚBLICAS por natureza
// (a chave "publishable/anon" só permite o que as regras do banco liberam).
// Sem elas, o chat aparece como "ainda não ativado".

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Só aceita um projeto Supabase em https (evita apontar para servidor arbitrário) */
const validUrl = typeof url === 'string' && /^https:\/\/[a-z0-9]{10,40}\.supabase\.co$/.test(url)
const validKey = typeof key === 'string' && key.length > 20 && key.length < 1000 && !key.includes('service_role')

export const chatConfig = validUrl && validKey ? { url: url!, key: key! } : null

/** Mesmas regras do banco (supabase/chat.sql), para avisar antes de enviar */
export const NICK_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,19}$/u
export const BODY_MAX = 280
export const FORBIDDEN_BODY = /(https?:|www\.|[a-z0-9-]+\.(com|net|org|br|io|gg|me|ly)\b|<|>|@[a-z0-9_])/i

export const REACTIONS = ['🔥', '😱', '👏', '😋', '🧁', '😂'] as const
