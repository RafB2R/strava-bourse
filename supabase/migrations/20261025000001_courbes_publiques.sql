-- Courbe de performance publique (base 100), calculée par l'appli du propriétaire à partir de
-- ses mouvements et de ses dates d'achat (qui restent privées), puis publiée ici : seulement
-- des points [jour, performance %], jamais de montant ni de date d'achat. Les visiteurs la
-- lisent et la prolongent jusqu'au jour même avec les cours.

create table if not exists public.performance_curves (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  points jsonb not null default '[]'::jsonb,   -- [["2026-03-26", 0], ["2026-03-27", 0.42], …]
  updated_at timestamptz not null default now()
);

alter table public.performance_curves enable row level security;
drop policy if exists "courbes visibles" on public.performance_curves;
create policy "courbes visibles" on public.performance_curves for select to authenticated using (true);
drop policy if exists "publier ma courbe" on public.performance_curves;
create policy "publier ma courbe" on public.performance_curves for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "mettre à jour ma courbe" on public.performance_curves;
create policy "mettre à jour ma courbe" on public.performance_curves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.performance_curves from anon, authenticated;
grant select, insert, update on public.performance_curves to authenticated;

notify pgrst, 'reload schema';
