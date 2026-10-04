-- Étape 2/2 — à exécuter APRÈS le déploiement de la nouvelle version de l'app.
--
-- Rend prix_achat et nombre_parts illisibles via l'API pour tout le monde,
-- propriétaire compris : le propriétaire les lit via get_my_portfolio_entries().
-- Les autres colonnes restent lisibles par les membres connectés (profil
-- public, classements, clubs). Insertion, modification et suppression ne
-- changent pas : elles restent gérées par les règles RLS existantes.

do $$
declare
  public_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into public_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'portfolio_entries'
    and column_name not in ('prix_achat', 'nombre_parts');

  execute 'revoke select on public.portfolio_entries from anon, authenticated';
  execute format('grant select (%s) on public.portfolio_entries to authenticated', public_cols);
end $$;

notify pgrst, 'reload schema';

-- Vérification : les deux premières lignes doivent renvoyer false, la troisième true.
select
  has_column_privilege('authenticated', 'public.portfolio_entries', 'nombre_parts', 'select') as nombre_parts_lisible,
  has_column_privilege('authenticated', 'public.portfolio_entries', 'prix_achat', 'select') as prix_achat_lisible,
  has_column_privilege('authenticated', 'public.portfolio_entries', 'percentage', 'select') as percentage_lisible;
