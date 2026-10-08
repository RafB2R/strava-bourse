-- Commentaires sous les actualités du fil (articles sur une société, un indice
-- ou une légende suivis), comme sous les posts : chacun écrit et supprime les siens.

create table if not exists public.news_comments (
  id bigint generated always as identity primary key,
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  tags jsonb,
  created_at timestamptz not null default now()
);

create index if not exists news_comments_url_idx on public.news_comments (url, created_at);

alter table public.news_comments enable row level security;
drop policy if exists "commentaires d'actualités visibles" on public.news_comments;
create policy "commentaires d'actualités visibles" on public.news_comments for select to authenticated using (true);
drop policy if exists "commenter une actualité" on public.news_comments;
create policy "commenter une actualité" on public.news_comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "supprimer son commentaire d'actualité" on public.news_comments;
create policy "supprimer son commentaire d'actualité" on public.news_comments for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.news_comments to authenticated;

notify pgrst, 'reload schema';
