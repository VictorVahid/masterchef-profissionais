import { readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Caminho real do projeto. Quando o Vite é iniciado por uma junction/symlink
// (ex.: uma pasta em outro disco apontando para esta), o Node resolve os módulos pelo caminho real e a
// raiz/diretório atual ficam divergentes, causando "Failed to load url
// /src/main.tsx" e falhas no pré-bundle. Alinhamos ambos ao caminho real.
const root = realpathSync(fileURLToPath(new URL('.', import.meta.url)))
if (realpathSync(process.cwd()) === root && process.cwd() !== root) process.chdir(root)

// Mesmos cabeçalhos de segurança da Vercel no `vite preview`, para testar a CSP localmente
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[]
}
const securityHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]))

export default defineConfig({
  root,
  preview: { headers: securityHeaders },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },
})
