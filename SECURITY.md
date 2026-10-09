# Segurança

## Como reportar

Encontrou uma vulnerabilidade? Não abra uma issue pública. Use
**Security → Report a vulnerability** neste repositório (relato privado do GitHub).

## O que está protegido

**Site (Vercel)**
- Content Security Policy restritiva: só scripts, estilos e fontes do próprio site; imagens apenas do
  próprio site e de `img.band.com.br`; sem `unsafe-inline`, sem `eval`, sem iframes (`frame-ancestors 'none'`).
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP e HSTS.
- Nenhum serviço de terceiros carregado (fontes servidas pelo próprio site, sem analytics/rastreadores).
- Dados externos tratados como não confiáveis: links só `https`, fotos só de domínios permitidos, dados do
  navegador (favoritos/palpites) validados antes do uso.

**Robô de atualização (GitHub Actions)**
- Actions fixadas por hash de commit; permissões mínimas por job; `npm ci --ignore-scripts`.
- O Claude roda isolado numa pasta que contém só as matérias (sem repositório, sem `.git`, sem credenciais),
  sem terminal e sem internet, podendo escrever apenas `.bot/extracted.json`.
- Defesa contra injeção de prompt: schema estrito com limites de tamanho, fontes apenas da Band, textos sem
  links/HTML/menções e varredura de credenciais antes de qualquer upload, commit ou PR.
- O token do Claude existe só no job de extração; o job que publica nunca o recebe.

**Chat ao vivo (Supabase)**
- Todas as regras ficam no banco (Row Level Security + gatilhos): só usuários autenticados (login anônimo)
  escrevem, cada um só como si mesmo; apelido e texto validados (tamanho, sem links, HTML ou menções);
  anti-spam (1 mensagem a cada 3 s, 12 por minuto, sem repetição); banimento; 3 denúncias ocultam a mensagem.
- Tempo real por canal **privado**: só o banco publica as mensagens, com apenas apelido, texto e hora —
  o identificador de quem escreveu nunca sai do banco. Navegadores só publicam reações e presença.
- Mensagens visíveis por 48 h e apagadas após 7 dias. A chave usada no site é a pública (anon/publishable).

**Jogos**
- Base histórica gerada de fontes públicas, com revisão registrada; nenhum dado pessoal além do que as
  fontes publicam. Menores de idade (MasterChef Júnior) excluídos.

**Acompanhamento de CVEs**
- Dependabot (npm e Actions), `npm audit` + verificação de assinaturas a cada push e semanalmente, e CodeQL.
