-- Sondages et fichiers joints dans les posts du fil.
--
-- SONDAGES
-- Le sondage est rangé dans le post : data.poll = { options: [2 à 4 textes], ends_at }.
-- Les votes sont anonymes : chacun ne voit que son propre vote ; les autres
-- membres ne voient que les totaux par option (table poll_counts, tenue à jour
-- par un trigger). Un vote est définitif et n'est accepté que tant que le
-- sondage est ouvert, sur une option qui existe.
--
-- FICHIERS
-- Bucket « post-files » (10 Mo maximum ; PDF, Excel, CSV, Word, PowerPoint,
-- texte), rangé par membre comme « post-media ».

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
    create table if not exists public.poll_votes (
      activity_id %1$s not null references public.activities(id) on delete cascade,
      user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
      option smallint not null check (option between 0 and 3),
      created_at timestamptz not null default now(),
      primary key (activity_id, user_id)
    )$sql$, activity_id_type);

  execute format($sql$
    create table if not exists public.poll_counts (
      activity_id %1$s not null references public.activities(id) on delete cascade,
      option smallint not null,
      votes int not null default 0,
      primary key (activity_id, option)
    )$sql$, activity_id_type);
end $$;

alter table public.poll_votes enable row level security;
alter table public.poll_counts enable row level security;

drop policy if exists "voir son vote" on public.poll_votes;
create policy "voir son vote" on public.poll_votes
  for select to authenticated using (user_id = auth.uid());

-- Voter : sondage visible, encore ouvert, option existante
drop policy if exists "voter" on public.poll_votes;
create policy "voter" on public.poll_votes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.activities a
      where a.id = activity_id
        and jsonb_typeof(a.data -> 'poll' -> 'options') = 'array'
        and option < jsonb_array_length(a.data -> 'poll' -> 'options')
        and coalesce((a.data -> 'poll' ->> 'ends_at')::timestamptz, 'infinity') > now()
    )
  );

drop policy if exists "totaux visibles avec le sondage" on public.poll_counts;
create policy "totaux visibles avec le sondage" on public.poll_counts
  for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));

revoke all on public.poll_votes, public.poll_counts from anon, authenticated;
grant select, insert on public.poll_votes to authenticated;
grant select on public.poll_counts to authenticated;

create or replace function public.verio_on_poll_vote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into poll_counts (activity_id, option, votes) values (new.activity_id, new.option, 1)
  on conflict (activity_id, option) do update set votes = poll_counts.votes + 1;
  return new;
end;
$$;
revoke execute on function public.verio_on_poll_vote() from public, anon, authenticated;

drop trigger if exists verio_after_poll_vote on public.poll_votes;
create trigger verio_after_poll_vote after insert on public.poll_votes
  for each row execute function public.verio_on_poll_vote();

-- Fichiers joints
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-files', 'post-files', true, 10485760, array[
  'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post-files : déposer dans son dossier" on storage.objects;
create policy "post-files : déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post-files : supprimer ses fichiers" on storage.objects;
create policy "post-files : supprimer ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-files' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
