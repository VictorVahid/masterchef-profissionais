// Defesas para dados que o site exibe mas não controla diretamente: os JSONs
// gravados pelo robô (a partir de matérias da web) e o que fica no navegador.

/** Domínios dos quais o site aceita carregar fotos */
const IMAGE_HOSTS = new Set(['img.band.com.br'])

/** Só https (bloqueia javascript:, data:, http:...). Devolve null se inválido. */
export function safeHttpsUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && !url.username && !url.password ? url : null
  } catch {
    return null
  }
}

/** URL de foto permitida (https e domínio na lista), ou null */
export function safeImageUrl(raw: unknown): string | null {
  const url = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? new URL(raw, location.origin) : safeHttpsUrl(raw)
  if (!url) return null
  return url.origin === location.origin || IMAGE_HOSTS.has(url.hostname) ? url.href : null
}

/** Validadores para dados salvos no navegador (podem ter sido adulterados) */
export const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= 100 && v.every((x) => typeof x === 'string' && x.length <= 64)

export const isStringRecord = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' &&
  v !== null &&
  !Array.isArray(v) &&
  Object.keys(v).length <= 100 &&
  Object.entries(v).every(([k, x]) => /^\d{1,3}$/.test(k) && typeof x === 'string' && x.length <= 64)
