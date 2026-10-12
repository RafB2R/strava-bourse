-- Courbe de performance du profil public (base 100 au premier investissement) :
-- les autres membres peuvent lire la date d'achat, la date d'ajout et l'ISIN de chaque
-- position (pour retrouver ses cours). Toujours aucun montant : prix d'achat et nombre de
-- parts restent illisibles (voir 20261004000002).

grant select (date_achat, created_at, isin) on public.portfolio_entries to authenticated;

notify pgrst, 'reload schema';
