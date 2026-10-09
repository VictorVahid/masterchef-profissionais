# MasterChef Profissionais · Ranking

App para acompanhar a classificação dos participantes do MasterChef Profissionais episódio a episódio.

**Stack:** React 19 · Vite 6 · TypeScript · Tailwind CSS v4

## Funcionalidades

- **Classificação** por episódio, com filtros (torcida, na disputa, veteranos, estreantes, eliminados)
- **Perfis** com bio, trajetória episódio a episódio, carreira e fotos oficiais
- **Campeão fixado** da prova do Programa 1
- **Contagem regressiva** para o próximo episódio, com aviso de "no ar agora"
- **Bolão "Quem sai?"**: palpite do eliminado da semana; trava quando o episódio começa e conta os acertos
- **Minha torcida**: favoritos destacados no ranking e na lista (salvos no navegador)
- **Frente a frente**: comparação de dois participantes métrica a métrica e episódio a episódio
- **Busca rápida** com `Ctrl/⌘ + K` ou `/`, e **compartilhar** o link de um perfil
- Tema claro/escuro, layout para celular (carrossel de participantes) e respeito a "reduzir movimento"
- **Chat ao vivo** por episódio (Supabase, grátis): reações em tempo real, contador de online, denúncias e anti-spam
- **Jogos** (`/jogos`): **Copa MasterChef** (monte um time com chefs de todas as temporadas e enfrente seleções
  aleatórias em 7 provas) e **Quiz da história** (campeões, vices, jurados, anos e colocações; modo "Quem é?")

## Rodando localmente

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + build de produção em dist/
npm run preview   # serve o build
```

## Estrutura

```
src/
  data/
    participants.ts   # perfis (bio, veterano, restaurantes, atuação, especialidade, destaques) — editado à mão
    episodes.json     # episódios: provas, pins, resultados, salvamentos, fontes — gerado pelo robô
    photos.json       # fotos oficiais (divulgação/Band) — gerado pelo robô
    meta.json         # data da última atualização — gerado pelo robô
    index.ts          # camada de acesso aos dados
  lib/ranking.ts      # classificação, pins e variação de posição
  components/         # Header, FilterSidebar, ChampionPin, EpisodeOverview, ParticipantProfile, ...
scripts/
  collect.ts          # robô, etapa 1: coleta (Band + Google Notícias) → .bot/context.json
  prompts/extract-episodes.md  # robô, etapa 2: instruções para o Claude Code
  apply.ts            # robô, etapa 3: valida .bot/extracted.json e atualiza src/data
  lib/                # fontes, schema da extração e validações
.github/workflows/update-season.yml  # agenda do robô (GitHub Actions)
```

**Critério da classificação:** o programa não divulga pontos. A ordem é resultado da final → pins → vezes
entre os destaques → menos idas à prova de eliminação → nome (veja `src/lib/ranking.ts`).

## Atualização automática (sem custo extra)

O site se atualiza sozinho ao longo da temporada, usando só serviços gratuitos e a **sua assinatura do
Claude** (Pro/Max). Nada é cobrado pela API.

O GitHub Actions roda o workflow `.github/workflows/update-season.yml` **2x por dia** (06:00 e 18:00):

1. **Coleta** (`scripts/collect.ts`, grátis): baixa as fotos oficiais e as matérias novas da seção de
   MasterChef do site da Band, mais manchetes do Google Notícias, e grava tudo em `.bot/context.json`.
2. **Extração** (Claude Code com a sua assinatura): **só roda depois que o próximo episódio vai ao ar**
   (matéria publicada após a terça seguinte, 22h30). O Claude lê as matérias e grava os episódios novos em
   `.bot/extracted.json`, seguindo `scripts/prompts/extract-episodes.md`. Ele só pode ler e escrever
   arquivos: sem terminal e sem internet. Qualquer alteração fora de `.bot/` é descartada.
3. **Aplicação** (`scripts/apply.ts`, grátis): valida o resultado em código (sequência dos episódios,
   datas, todos os participantes ativos com resultado, repescagens, vencedores, fontes reais e **eliminação
   confirmada por pelo menos 2 fontes**) e atualiza `src/data`.
4. Tudo certo → commit na `main` → a **Vercel republica o site**. Algo duvidoso → o robô abre um
   **Pull Request** com um relatório para você conferir e fazer o merge (enquanto ele estiver aberto, o
   robô espera).

Na prática, o Claude roda ~1 vez por semana e usa uma fração pequena do limite da sua assinatura.
O GitHub Actions é gratuito (ilimitado em repositório público; 2.000 min/mês em privado — o robô usa poucos).

### Configuração (uma vez)

1. Suba o projeto para um repositório no GitHub e conecte-o à Vercel (seção abaixo).
2. No seu computador, rode `claude setup-token` (Claude Code CLI) e copie o token gerado.
3. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**, nome
   `CLAUDE_CODE_OAUTH_TOKEN`, valor = o token.
4. Em **Settings → Actions → General → Workflow permissions**, marque **Read and write permissions** e
   **Allow GitHub Actions to create and approve pull requests**.
5. (Opcional) Em **Actions → Atualizar temporada → Run workflow**, rode manualmente para testar.

### Rodando o robô localmente

```bash
npm run bot:collect      # coleta (use "npx tsx scripts/collect.ts --force" para forçar)
npm run bot:extract      # extração com o Claude Code do seu computador (precisa do CLI `claude`)
npm run bot:apply        # valida e grava em src/data
```

### Ajustes manuais

O robô nunca altera `participants.ts`. Para corrigir um episódio, edite `src/data/episodes.json` — o
campo `updatedBy` indica se o registro veio do robô (`bot`) ou de edição manual (`manual`). Para fixar o
campeão de outro episódio no topo, mude `PINNED_EPISODE` em `src/App.tsx`.

> Elenco compilado de reportagens e do site oficial; fontes no rodapé do site e em cada episódio.
> Fotos: divulgação/Band. Projeto de fãs, sem vínculo oficial com a Band ou o programa.

## Base histórica (jogos)

`src/data/history.json` reúne 23 temporadas brasileiras (Brasil, Profissionais, Confeitaria, MasterChef+ e
Celebridades), gerada a partir da Wikipédia (CC BY-SA 4.0) com o id de revisão de cada página:

```bash
npx tsx scripts/build-history.ts
```

O MasterChef Júnior fica de fora (participantes menores de idade). A nota dos chefs no jogo vem só de dados
reais (colocação final e provas vencidas); participantes falecidos não entram no jogo de times.

## Chat ao vivo (Supabase, grátis)

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com) (plano Free).
2. **Authentication → Sign In / Providers**: habilite **Allow anonymous sign-ins**.
3. **SQL Editor → New query**: cole e rode todo o arquivo [`supabase/chat.sql`](supabase/chat.sql).
4. **Project Settings → API**: copie a *Project URL* e a chave *anon/publishable* (**nunca** a `service_role`).
5. Na Vercel: **Settings → Environment Variables**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   e faça um novo deploy. Localmente, copie `.env.example` para `.env.local`.

Moderação: em **Table Editor**, `chat_messages` mostra quem enviou (`user_id`). Para banir:
`insert into public.chat_bans (user_id, reason) values ('<uuid>', 'spam');`

## Deploy na Vercel

O projeto já inclui `vercel.json` (framework Vite, saída `dist/`, rewrite SPA).

1. Suba o repositório para o GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório e clique em **Deploy**.

Ou pela CLI: `npx vercel` (preview) e `npx vercel --prod`.
