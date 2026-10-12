-- Historique du portefeuille : date d'achat de chaque position (facultative).
-- La courbe du portefeuille est reconstruite jour par jour à partir des cours, depuis
-- cette date (sinon depuis l'ajout de la position dans Verio : created_at).
-- Privée comme les montants : non accordée en lecture aux autres membres
-- (voir 20261004000002) ; le propriétaire la lit via get_my_portfolio_entries().

alter table public.portfolio_entries add column if not exists date_achat date;
alter table public.portfolio_entries add column if not exists created_at timestamptz not null default now();

notify pgrst, 'reload schema';
