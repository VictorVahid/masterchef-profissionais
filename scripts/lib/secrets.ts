// Detecção de credenciais em texto que será publicado (commit, PR, site).
// Se o extrator for manipulado por injeção de prompt para "vazar" um token,
// a publicação é bloqueada aqui.

const PATTERNS: [string, RegExp][] = [
  ['token Anthropic/Claude', /sk-ant-[A-Za-z0-9_-]{8,}/],
  ['token GitHub', /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./],
  ['chave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['chave AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['token Slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['cabeçalho de autorização', /\b(authorization|bearer)\s*[:=]?\s*[A-Za-z0-9._-]{20,}/i],
]

/**
 * Token genérico: 32+ caracteres seguidos sem espaço nem "/", misturando
 * maiúsculas, minúsculas e dígitos (caminhos de URL e palavras não entram).
 */
function looksLikeToken(text: string): boolean {
  for (const [m] of text.matchAll(/[A-Za-z0-9_+=-]{32,}/g)) {
    if (/[a-z]/.test(m) && /[A-Z]/.test(m) && /\d/.test(m)) return true
  }
  return false
}

/** Lista os tipos de segredo encontrados em qualquer string do valor */
export function findSecrets(value: unknown): string[] {
  const text = JSON.stringify(value)
  const found = PATTERNS.filter(([, re]) => re.test(text)).map(([name]) => name)
  if (looksLikeToken(text)) found.push('sequência com formato de token')
  return found
}

/** Neutraliza Markdown/HTML de texto não confiável antes de ir para PR/commit */
export function plain(text: string, max = 300): string {
  return (
    text
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      // Primeiro as URLs: o GitHub transforma URL solta em link clicável
      .replace(/\b(?:https?|ftp|javascript|data|vbscript):\S*/gi, '[link]')
      .replace(/\bwww\.\S+/gi, '[link]')
      .replace(/[<>`*_()!#|\\~]/g, '')
      .replace(/\[(?!link\])/g, '')
      .replace(/(?<!\[link)\]/g, '')
      // Evita mencionar usuários/equipes do GitHub
      .replace(/@(\w)/g, '@​$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  )
}
