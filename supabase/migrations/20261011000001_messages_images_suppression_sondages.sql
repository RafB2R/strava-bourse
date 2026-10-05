-- 1. Images dans la messagerie
-- 2. Suppression de ses propres posts
-- 3. Fin des sondages : notification à l'auteur et aux participants

------------------------------------------------------------------------------
-- 1. IMAGES DANS LA MESSAGERIE
-- Bucket PRIVÉ « message-media », un dossier par conversation :
-- <id de la conversation>/<uuid>.webp. Seuls les membres de la conversation
-- lisent les images (adresses signées, valables une heure) ; on ne peut en
-- déposer que tant qu'on peut écrire dans la conversation (toujours amis).
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-media', 'message-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Dossier → conversation (null si le nom n'est pas un identifiant valide)
create or replace function public.verio_folder_conversation(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return (storage.foldername(object_name))[1]::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists "message-media : lire ses conversations" on storage.objects;
create policy "message-media : lire ses conversations" on storage.objects
  for select to authenticated
  using (bucket_id = 'message-media' and public.verio_is_member(public.verio_folder_conversation(name)));

drop policy if exists "message-media : déposer dans ses conversations" on storage.objects;
create policy "message-media : déposer dans ses conversations" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-media' and public.verio_can_send(public.verio_folder_conversation(name)));

-- Les messages peuvent porter des images ; le texte devient facultatif s'il y a une image
alter table public.messages add column if not exists images jsonb;

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%content%'
  loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.messages drop constraint if exists messages_content_or_images;
alter table public.messages drop constraint if exists messages_images_max;
alter table public.messages add constraint messages_content_or_images check (
  char_length(content) <= 2000
  and (
    char_length(btrim(content)) >= 1
    or coalesce(jsonb_typeof(images) = 'array' and jsonb_array_length(images) between 1 and 4, false)
  )
);
alter table public.messages add constraint messages_images_max check (
  images is null or (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 4)
);
alter table public.messages alter column content set default '';

-- Aperçu de la liste : « 📷 Photo » quand le dernier message n'a pas de texte
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
         when btrim(lm.content) = '' then '📷 Photo'
         else lm.content end,
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

------------------------------------------------------------------------------
-- 2. SUPPRESSION DE SES POSTS
-- Seulement les posts écrits (type « post ») : les likes, commentaires et
-- votes partent avec (on delete cascade). Les images et fichiers sont
-- supprimés du stockage par l'application.
------------------------------------------------------------------------------

drop policy if exists "supprimer ses posts" on public.activities;
create policy "supprimer ses posts" on public.activities
  for delete to authenticated
  using (user_id = auth.uid() and type = 'post');

grant delete on public.activities to authenticated;

------------------------------------------------------------------------------
-- 3. FIN DES SONDAGES
-- close_finished_polls() traite les sondages terminés (une seule fois chacun,
-- grâce à poll_closures) : notification « poll_ended » à l'auteur et à chaque
-- participant, avec le choix gagnant et son score en %.
-- Appelée par l'application (ouverture du fil et des notifications) et, si
-- l'extension pg_cron est active, toutes les 15 minutes.
------------------------------------------------------------------------------

do $$
declare
  activity_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into activity_id_type
  from pg_attribute a
  where a.attrelid = 'public.activities'::regclass
    and a.attname = 'id';

  execute format($sql$
    create table if not exists public.poll_closures (
      activity_id %1$s primary key references public.activities(id) on delete cascade,
      closed_at timestamptz not null default now()
    )$sql$, activity_id_type);
end $$;

alter table public.poll_closures enable row level security;
revoke all on public.poll_closures from anon, authenticated;

-- Date de fin lisible, ou null (les données du post viennent du navigateur)
create or replace function public.verio_try_timestamptz(value text)
returns timestamptz language plpgsql immutable as $$
begin
  return value::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.close_finished_polls()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  closed int := 0;
  total int;
  best int;
  winners text[];
  payload jsonb;
begin
  for r in
    select a.id, a.user_id, a.data, p.full_name
    from activities a
    join profiles p on p.id = a.user_id
    where a.type = 'post'
      and jsonb_typeof(a.data -> 'poll' -> 'options') = 'array'
      and verio_try_timestamptz(a.data -> 'poll' ->> 'ends_at') <= now()
      and verio_try_timestamptz(a.data -> 'poll' ->> 'ends_at') > now() - interval '7 days'
      and not exists (select 1 from poll_closures c where c.activity_id = a.id)
    limit 200
  loop
    insert into poll_closures (activity_id) values (r.id) on conflict do nothing;
    if not found then continue; end if;  -- déjà traité par un appel simultané

    select coalesce(sum(votes), 0), coalesce(max(votes), 0) into total, best
      from poll_counts where activity_id = r.id;
    select coalesce(array_agg(r.data -> 'poll' -> 'options' ->> option::int order by option), '{}')
      into winners
      from poll_counts where activity_id = r.id and votes = best and best > 0;

    payload := jsonb_build_object(
      'activity_id', r.id,
      'question', left(coalesce(r.data ->> 'content', ''), 80),
      'author_id', r.user_id,
      'author_name', r.full_name,
      'total', total,
      'winners', to_jsonb(winners),
      'winner_pct', case when total > 0 then round(best * 100.0 / total) else 0 end
    );

    insert into notifications (user_id, type, data)
      values (r.user_id, 'poll_ended', payload || jsonb_build_object('mine', true));
    insert into notifications (user_id, type, data)
      select v.user_id, 'poll_ended', payload
      from poll_votes v
      where v.activity_id = r.id and v.user_id <> r.user_id;

    closed := closed + 1;
  end loop;
  return closed;
end;
$$;

revoke execute on function public.close_finished_polls() from public, anon;
grant execute on function public.close_finished_polls() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('verio-close-polls', '*/15 * * * *', 'select public.close_finished_polls()');
  end if;
exception when others then
  raise notice 'pg_cron indisponible : les sondages seront clos à l''ouverture de l''application';
end $$;

notify pgrst, 'reload schema';
