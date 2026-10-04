-- Étape 1/2 — à exécuter AVANT de déployer la nouvelle version de l'app.
-- Sans effet sur l'app actuelle : on ajoute seulement une fonction.
--
-- Renvoie toutes les colonnes (montants compris) des positions de
-- l'utilisateur connecté, et uniquement les siennes. C'est ce que lit
-- l'onglet Portefeuille.

create or replace function public.get_my_portfolio_entries()
returns setof public.portfolio_entries
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.portfolio_entries
  where user_id = auth.uid()
  order by percentage desc;
$$;

revoke execute on function public.get_my_portfolio_entries() from public, anon;
grant execute on function public.get_my_portfolio_entries() to authenticated;

notify pgrst, 'reload schema';
