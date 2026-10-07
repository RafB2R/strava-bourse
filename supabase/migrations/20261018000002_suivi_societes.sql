-- Suivre une société (depuis sa fiche) : ses actualités arrivent dans le fil.
-- Abonnement personnel, visible seulement par son auteur.

create table if not exists public.asset_follows (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  symbol text not null check (symbol ~ '^[\^A-Za-z0-9.=-]{1,20}$'),
  name text not null check (char_length(name) between 1 and 120),
  type text,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

alter table public.asset_follows enable row level security;
drop policy if exists "mes sociétés suivies" on public.asset_follows;
create policy "mes sociétés suivies" on public.asset_follows for select to authenticated using (user_id = auth.uid());
drop policy if exists "suivre une société" on public.asset_follows;
create policy "suivre une société" on public.asset_follows for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "ne plus suivre une société" on public.asset_follows;
create policy "ne plus suivre une société" on public.asset_follows for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.asset_follows to authenticated;

notify pgrst, 'reload schema';
