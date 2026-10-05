-- « Ce pseudo est-il libre ? » — dès l'inscription.
--
-- Les visiteurs non connectés ne peuvent plus lire les profils
-- (20261006000001_profils_prives.sql). Cette fonction leur répond seulement
-- oui ou non, sans rien révéler d'autre. Comparaison sans tenir compte des
-- majuscules ; son propre pseudo compte comme libre (modification du profil).
-- Quelques noms sont réservés.

create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(btrim(coalesce(name, ''))) ~ '^[a-z0-9_.]{3,20}$'
    and lower(btrim(name)) not in ('admin', 'administrateur', 'verio', 'support', 'contact', 'moderation', 'moderateur', 'equipe', 'team', 'root', 'null', 'undefined')
    and not exists (
      select 1 from profiles p
      where lower(p.username) = lower(btrim(name))
        and p.id is distinct from auth.uid()
    );
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

notify pgrst, 'reload schema';
