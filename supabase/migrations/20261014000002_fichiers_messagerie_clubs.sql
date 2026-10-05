-- Fichiers (PDF, Excel, Word…) dans la messagerie, photos et fichiers dans les clubs.

-- 1. Messagerie : le bucket privé « message-media » accepte aussi les documents
--    (10 Mo maximum), toujours lisibles seulement par les deux membres.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/csv', 'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
where id = 'message-media';

alter table public.messages add column if not exists files jsonb;

alter table public.messages drop constraint if exists messages_content_or_images;
alter table public.messages add constraint messages_content_or_images check (
  char_length(content) <= 2000
  and (
    char_length(btrim(content)) >= 1
    or coalesce(jsonb_typeof(images) = 'array' and jsonb_array_length(images) between 1 and 4, false)
    or coalesce(jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 1 and 3, false)
  )
);
alter table public.messages drop constraint if exists messages_files_max;
alter table public.messages add constraint messages_files_max check (
  files is null or (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 3)
);

-- Aperçu de la liste : « 📷 Photo » ou « 📎 Fichier » quand le dernier message n'a pas de texte
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
    case when lm.sender_id is null then null
         when btrim(lm.content) <> '' then lm.content
         when lm.files is not null then '📎 Fichier'
         else '📷 Photo' end,
    lm.sender_id,
    c.last_message_at,
    (select count(*)::int from messages x
      where x.conversation_id = c.id and x.sender_id <> auth.uid() and x.created_at > me.last_read_at)
  from conversation_members me
  join conversations c on c.id = me.conversation_id
  join conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join profiles p on p.id = o.user_id
  left join lateral (
    select content, sender_id, files from messages m where m.conversation_id = c.id order by created_at desc, id desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

-- Notification push d'un message sans texte
create or replace function public.verio_push_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
  recipient uuid;
  preview text;
begin
  select full_name into sender_name from profiles where id = new.sender_id;
  preview := case when btrim(coalesce(new.content, '')) <> '' then new.content
                  when new.files is not null then '📎 Fichier'
                  else '📷 Photo' end;
  for recipient in
    select user_id from conversation_members where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    perform verio_send_push(recipient, coalesce(sender_name, 'Nouveau message'), preview, '/?tab=messages', 'conv-' || new.conversation_id);
  end loop;
  return new;
end;
$$;
revoke execute on function public.verio_push_on_message() from public, anon, authenticated;

-- 2. Clubs : photos et fichiers dans les posts (mêmes espaces que le fil :
--    « post-media » et « post-files »). Le texte devient facultatif s'il y a une pièce jointe.
alter table public.club_posts add column if not exists images jsonb;
alter table public.club_posts add column if not exists files jsonb;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.club_posts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%content%'
      and conname <> 'club_posts_content_or_attachments'
  loop
    execute format('alter table public.club_posts drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.club_posts alter column content set default '';

alter table public.club_posts drop constraint if exists club_posts_content_or_attachments;
alter table public.club_posts add constraint club_posts_content_or_attachments check (
  char_length(coalesce(content, '')) <= 5000
  and (
    char_length(btrim(coalesce(content, ''))) >= 1
    or coalesce(jsonb_typeof(images) = 'array' and jsonb_array_length(images) between 1 and 4, false)
    or coalesce(jsonb_typeof(files) = 'array' and jsonb_array_length(files) between 1 and 3, false)
  )
) not valid;  -- vérifiée pour les nouveaux posts, les anciens restent tels quels

notify pgrst, 'reload schema';
