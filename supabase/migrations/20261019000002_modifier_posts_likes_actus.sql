-- 1. Modifier son post : seul l'auteur change le texte (et les $valeurs / @membres
--    identifiés) ; images, fichiers, sondage et pièces jointes restent tels quels.
--    La date de modification est gardée (« modifié » affiché sous le post).
-- 2. Liker une actualité (article sur une société, un indice ou un grand
--    investisseur suivi) : un like par membre et par article.

create or replace function public.update_my_post(activity text, content text, tickers jsonb default null, mentions jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  clean text := btrim(coalesce(content, ''));
  updated jsonb;
begin
  if char_length(clean) > 5000 then
    raise exception 'Post trop long (5 000 caractères maximum)';
  end if;
  update activities
     set data = (coalesce(data, '{}'::jsonb) - 'tickers' - 'mentions')
                || jsonb_build_object('content', clean, 'edited_at', now())
                || case when jsonb_typeof(tickers) = 'array' and jsonb_array_length(tickers) > 0 then jsonb_build_object('tickers', tickers) else '{}'::jsonb end
                || case when jsonb_typeof(mentions) = 'array' and jsonb_array_length(mentions) > 0 then jsonb_build_object('mentions', mentions) else '{}'::jsonb end
   where id::text = activity
     and user_id = auth.uid()
     and type = 'post'
     -- un post sans texte doit garder autre chose (image, fichier, sondage, graphique…)
     and (clean <> '' or data ?| array['images', 'files', 'poll', 'asset', 'allocation'])
  returning data into updated;
  if updated is null then
    raise exception 'Post introuvable ou non modifiable';
  end if;
  return updated;
end;
$$;

revoke execute on function public.update_my_post(text, text, jsonb, jsonb) from public, anon;
grant execute on function public.update_my_post(text, text, jsonb, jsonb) to authenticated;

create table if not exists public.news_likes (
  url text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (url, user_id)
);

alter table public.news_likes enable row level security;
drop policy if exists "likes d'actualités visibles" on public.news_likes;
create policy "likes d'actualités visibles" on public.news_likes for select to authenticated using (true);
drop policy if exists "liker une actualité" on public.news_likes;
create policy "liker une actualité" on public.news_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "retirer son like d'actualité" on public.news_likes;
create policy "retirer son like d'actualité" on public.news_likes for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.news_likes to authenticated;

notify pgrst, 'reload schema';
