-- Likes et commentaires du fil, enregistrés en base
-- (jusqu'ici ils n'existaient qu'en mémoire et disparaissaient au rechargement).
--
-- Le type de la colonne activity_id est repris de activities.id
-- (uuid ou entier selon la façon dont la table a été créée).

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
    create table if not exists public.activity_likes (
      activity_id %1$s not null references public.activities(id) on delete cascade,
      user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (activity_id, user_id)
    )$sql$, activity_id_type);

  execute format($sql$
    create table if not exists public.activity_comments (
      id bigint generated always as identity primary key,
      activity_id %1$s not null references public.activities(id) on delete cascade,
      user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
      content text not null check (char_length(btrim(content)) between 1 and 1000),
      created_at timestamptz not null default now()
    )$sql$, activity_id_type);
end $$;

create index if not exists activity_comments_activity_id_idx on public.activity_comments (activity_id, created_at);

alter table public.activity_likes enable row level security;
alter table public.activity_comments enable row level security;

-- Visible seulement si l'activité elle-même est visible (les règles RLS
-- de activities s'appliquent dans la sous-requête)
create policy "likes visibles avec l'activité" on public.activity_likes
  for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));

create policy "liker une activité visible" on public.activity_likes
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.activities a where a.id = activity_id));

create policy "retirer son like" on public.activity_likes
  for delete to authenticated
  using (user_id = auth.uid());

create policy "commentaires visibles avec l'activité" on public.activity_comments
  for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));

create policy "commenter une activité visible" on public.activity_comments
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.activities a where a.id = activity_id));

-- L'auteur du commentaire, ou l'auteur de l'activité commentée
create policy "supprimer un commentaire" on public.activity_comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.activities a where a.id = activity_id and a.user_id = auth.uid())
  );

revoke all on public.activity_likes, public.activity_comments from anon;
grant select, insert, delete on public.activity_likes, public.activity_comments to authenticated;

notify pgrst, 'reload schema';
