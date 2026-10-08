-- Suivi automatique des sociétés de son portefeuille.
-- Les actions détenues sont suivies d'office (leurs actualités arrivent dans le fil).
-- « Ne plus suivre » ne supprime plus la ligne : elle passe à active = false, pour
-- que le suivi automatique ne la remette pas. Suivre de nouveau la réactive.

alter table public.asset_follows add column if not exists active boolean not null default true;
alter table public.asset_follows add column if not exists auto boolean not null default false;

drop policy if exists "modifier mes sociétés suivies" on public.asset_follows;
create policy "modifier mes sociétés suivies" on public.asset_follows for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant update (active, name, type) on public.asset_follows to authenticated;

notify pgrst, 'reload schema';
