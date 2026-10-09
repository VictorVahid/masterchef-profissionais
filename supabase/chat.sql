-- =============================================================================
-- Chat ao vivo — MasterChef Profissionais 2026 (Supabase / PostgreSQL)
--
-- Rode este arquivo inteiro no Supabase: Dashboard → SQL Editor → New query.
-- Pode rodar de novo sem problema (é idempotente).
--
-- Segurança: TODAS as regras ficam no banco (o navegador pode ser adulterado).
--  - Só usuários autenticados (login anônimo) escrevem; cada um só escreve como si.
--  - Apelido e mensagem validados (tamanho, caracteres, sem links/HTML).
--  - Anti-spam: 1 mensagem a cada 3 s, até 12 por minuto, sem repetir texto.
--  - Denúncias: 3 denúncias de pessoas diferentes ocultam a mensagem.
--  - Banimento por usuário (feito pelo dono no painel).
--  - Leitura só das mensagens visíveis das últimas 48 h; limpeza após 7 dias.
--  - Tempo real por canal PRIVADO: só o banco publica mensagens (tópico
--    chat:ep-N), enviando apenas apelido, texto e hora — nunca o id de quem
--    escreveu. Navegadores só publicam reações/presença (tópico sala:ep-N).
--
-- Antes de rodar: Authentication → Sign In / Providers → habilite
-- "Allow anonymous sign-ins".
-- =============================================================================

-- ---------------------------------------------------------------- tabelas ----
create table if not exists public.chat_messages (
  id          bigint generated always as identity primary key,
  room        text        not null check (room ~ '^ep-[0-9]{1,3}$'),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  nickname    text        not null check (
                char_length(nickname) between 2 and 20
                and nickname ~ '^[[:alnum:]À-ÿ][[:alnum:]À-ÿ _.-]*$'
              ),
  body        text        not null check (
                char_length(btrim(body)) between 1 and 280
                and body !~* '(https?:|www\.|[a-z0-9-]+\.(com|net|org|br|io|gg|me|ly)\y|<|>|@[a-z0-9_])'
              ),
  created_at  timestamptz not null default now(),
  hidden      boolean     not null default false
);

create index if not exists chat_messages_room_created on public.chat_messages (room, created_at desc);
create index if not exists chat_messages_user_created on public.chat_messages (user_id, created_at desc);

create table if not exists public.chat_bans (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_reports (
  message_id bigint      not null references public.chat_messages (id) on delete cascade,
  reporter   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter)
);

-- ------------------------------------------------------------ anti-abuso ----
create or replace function public.chat_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Campos controlados pelo servidor (o cliente não pode forjar)
  new.user_id    := auth.uid();
  new.created_at := now();
  new.hidden     := false;
  new.body       := btrim(regexp_replace(new.body, '\s+', ' ', 'g'));
  new.nickname   := btrim(new.nickname);

  if new.user_id is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  if exists (select 1 from chat_bans b where b.user_id = new.user_id) then
    raise exception 'usuário bloqueado no chat' using errcode = '42501';
  end if;
  if exists (
    select 1 from chat_messages m
    where m.user_id = new.user_id and m.created_at > now() - interval '3 seconds'
  ) then
    raise exception 'devagar: espere alguns segundos' using errcode = 'P0001';
  end if;
  if (
    select count(*) from chat_messages m
    where m.user_id = new.user_id and m.created_at > now() - interval '1 minute'
  ) >= 12 then
    raise exception 'limite de mensagens por minuto atingido' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from chat_messages m
    where m.user_id = new.user_id and m.body = new.body and m.created_at > now() - interval '2 minutes'
  ) then
    raise exception 'mensagem repetida' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_before_insert on public.chat_messages;
create trigger chat_before_insert
  before insert on public.chat_messages
  for each row execute function public.chat_before_insert();

-- 3 denúncias de pessoas diferentes ocultam a mensagem
create or replace function public.chat_after_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.reporter := auth.uid();
  if (select count(*) from chat_reports r where r.message_id = new.message_id) >= 2 then
    update chat_messages set hidden = true where id = new.message_id;
  end if;
  return new;
end;
$$;

drop trigger if exists chat_after_report on public.chat_reports;
create trigger chat_after_report
  before insert on public.chat_reports
  for each row execute function public.chat_after_report();

-- ------------------------------------------------------- acesso (RLS) ----
alter table public.chat_messages enable row level security;
alter table public.chat_bans     enable row level security;
alter table public.chat_reports  enable row level security;

drop policy if exists "ler mensagens recentes" on public.chat_messages;
create policy "ler mensagens recentes" on public.chat_messages
  for select to anon, authenticated
  using (not hidden and created_at > now() - interval '48 hours');

drop policy if exists "enviar como si mesmo" on public.chat_messages;
create policy "enviar como si mesmo" on public.chat_messages
  for insert to authenticated
  with check (user_id = auth.uid());

-- Sem políticas de update/delete: ninguém edita nem apaga pelo site.
-- chat_bans: sem políticas = só o dono (painel/service role) acessa.

drop policy if exists "denunciar" on public.chat_reports;
create policy "denunciar" on public.chat_reports
  for insert to authenticated
  with check (reporter = auth.uid());

-- Esconde a coluna user_id de quem lê pelo site (só o painel vê quem enviou)
revoke select on public.chat_messages from anon, authenticated;
grant select (id, room, nickname, body, created_at) on public.chat_messages to anon, authenticated;
grant insert (room, nickname, body) on public.chat_messages to authenticated;
grant insert (message_id) on public.chat_reports to authenticated;

-- ------------------------------------------------------------ tempo real ----
-- O banco publica no canal privado chat:ep-N só os campos públicos.
create or replace function public.chat_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform realtime.send(
      jsonb_build_object('id', new.id, 'nickname', new.nickname, 'body', new.body, 'created_at', new.created_at),
      'mensagem', 'chat:' || new.room, true
    );
  elsif tg_op = 'UPDATE' and new.hidden and not old.hidden then
    perform realtime.send(jsonb_build_object('id', new.id), 'ocultar', 'chat:' || new.room, true);
  end if;
  return null;
end;
$$;

drop trigger if exists chat_broadcast on public.chat_messages;
create trigger chat_broadcast
  after insert or update of hidden on public.chat_messages
  for each row execute function public.chat_broadcast();

-- Garante que nada do chat sai pelo modo "postgres_changes" (que enviaria a linha inteira)
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime drop table public.chat_messages;
  end if;
end;
$$;

-- Quem pode ouvir e publicar nos canais privados
drop policy if exists "chat: receber" on realtime.messages;
create policy "chat: receber" on realtime.messages
  for select to authenticated
  using (
    (select realtime.topic()) ~ '^(chat|sala):ep-[0-9]{1,3}$'
    and realtime.messages.extension in ('broadcast', 'presence')
  );

drop policy if exists "sala: reações e presença" on realtime.messages;
create policy "sala: reações e presença" on realtime.messages
  for insert to authenticated
  with check (
    (select realtime.topic()) ~ '^sala:ep-[0-9]{1,3}$'
    and realtime.messages.extension in ('broadcast', 'presence')
    and not exists (select 1 from public.chat_bans b where b.user_id = auth.uid())
  );

-- -------------------------------------------------------------- limpeza ----
-- Apaga mensagens com mais de 7 dias, todo dia às 04:00 UTC.
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'limpar-chat';
select cron.schedule(
  'limpar-chat',
  '0 4 * * *',
  $$delete from public.chat_messages where created_at < now() - interval '7 days'$$
);

-- ------------------------------------------------------- moderação (dono) ----
-- Banir alguém (pegue o user_id da mensagem em Table Editor → chat_messages):
--   insert into public.chat_bans (user_id, reason) values ('<uuid>', 'spam');
-- Ocultar uma mensagem:
--   update public.chat_messages set hidden = true where id = <id>;
