-- Messagerie privée entre amis.
--
-- Une conversation réunit deux membres amis (demande d'ami acceptée).
-- Seuls les participants lisent les messages ; on ne peut écrire que tant
-- que l'amitié existe. Les conversations se créent uniquement via
-- start_conversation(), qui vérifie l'amitié et réutilise une conversation
-- existante.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

-- Fonctions d'appartenance (security definer : évite la récursion des règles RLS)
create or replace function public.verio_is_member(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversation_members where conversation_id = conv and user_id = auth.uid());
$$;

create or replace function public.verio_are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester_id = a and receiver_id = b) or (requester_id = b and receiver_id = a))
  );
$$;

-- Peut écrire : participant, et ami de tous les autres participants
create or replace function public.verio_can_send(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select verio_is_member(conv)
    and not exists (
      select 1 from conversation_members m
      where m.conversation_id = conv and m.user_id <> auth.uid()
        and not verio_are_friends(auth.uid(), m.user_id)
    );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

create policy "voir ses conversations" on public.conversations
  for select to authenticated using (verio_is_member(id));

create policy "voir les participants" on public.conversation_members
  for select to authenticated using (verio_is_member(conversation_id));

create policy "marquer comme lu" on public.conversation_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "lire les messages" on public.messages
  for select to authenticated using (verio_is_member(conversation_id));

create policy "envoyer un message" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and verio_can_send(conversation_id));

revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages to authenticated;
grant insert on public.messages to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- Nouveau message : la conversation remonte, l'expéditeur l'a « lue »
create or replace function public.verio_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  update conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

drop trigger if exists verio_after_message on public.messages;
create trigger verio_after_message after insert on public.messages
  for each row execute function public.verio_on_message();

-- Ouvre (ou retrouve) la conversation avec un ami
create or replace function public.start_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null or other is null or other = me then
    raise exception 'Conversation impossible';
  end if;
  if not verio_are_friends(me, other) then
    raise exception 'Vous devez être amis pour échanger des messages';
  end if;

  select a.conversation_id into conv
  from conversation_members a
  join conversation_members b on b.conversation_id = a.conversation_id and b.user_id = other
  where a.user_id = me
    and (select count(*) from conversation_members c where c.conversation_id = a.conversation_id) = 2
  limit 1;

  if conv is null then
    insert into conversations default values returning id into conv;
    insert into conversation_members (conversation_id, user_id) values (conv, me), (conv, other);
  end if;
  return conv;
end;
$$;

-- Mes conversations : l'autre participant, le dernier message et les non-lus
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_name text,
  other_username text,
  last_message text,
  last_sender_id uuid,
  last_message_at timestamptz,
  unread int
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    o.user_id,
    p.full_name,
    p.username,
    lm.content,
    lm.sender_id,
    c.last_message_at,
    (select count(*)::int from messages x
      where x.conversation_id = c.id and x.sender_id <> auth.uid() and x.created_at > me.last_read_at)
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  join conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join profiles p on p.id = o.user_id
  left join lateral (
    select content, sender_id from messages m where m.conversation_id = c.id order by created_at desc, id desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

create or replace function public.mark_conversation_read(conv uuid)
returns void language sql security definer set search_path = public as $$
  update conversation_members set last_read_at = now()
  where conversation_id = conv and user_id = auth.uid();
$$;

revoke execute on function public.verio_is_member(uuid), public.verio_are_friends(uuid, uuid), public.verio_can_send(uuid) from public, anon;
grant execute on function public.verio_is_member(uuid), public.verio_are_friends(uuid, uuid), public.verio_can_send(uuid) to authenticated;
revoke execute on function public.start_conversation(uuid), public.my_conversations(), public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.start_conversation(uuid), public.my_conversations(), public.mark_conversation_read(uuid) to authenticated;

-- Temps réel : diffuser les nouveaux messages (les règles RLS s'appliquent)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

notify pgrst, 'reload schema';
