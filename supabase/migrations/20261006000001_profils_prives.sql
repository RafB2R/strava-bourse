-- Données personnelles du profil réservées à leur propriétaire.
--
-- La table profiles contient aussi les réponses du questionnaire investisseur
-- (date de naissance, revenus, patrimoine estimé, épargne mensuelle,
-- objectifs…) et l'e-mail. Jusqu'ici tout membre connecté pouvait les lire.
-- Désormais seules les colonnes de la liste blanche ci-dessous sont lisibles
-- par les autres ; le propriétaire lit son profil complet via get_my_profile().
--
-- Le profil est aussi créé côté serveur à l'inscription (e-mail ou Google),
-- au lieu d'être écrit par le navigateur avant même la confirmation de l'e-mail.

-- 1. Lecture du profil complet par son propriétaire
create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

-- 2. Création du profil à l'inscription. Le nom et le pseudo viennent des
-- métadonnées passées à signUp (ou du nom fourni par Google).
-- Ne remplace pas un éventuel trigger existant : en cas de profil déjà créé,
-- on ne touche à rien.
create or replace function public.verio_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(lower(btrim(new.raw_user_meta_data ->> 'username')), '');
begin
  -- Pseudo déjà pris : profil créé sans pseudo, à choisir ensuite dans Profil
  if exists (select 1 from public.profiles where username = v_username) then
    v_username := null;
  end if;

  insert into public.profiles (id, full_name, username, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', '')),
    v_username,
    new.email
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Ne jamais bloquer une inscription à cause du profil
  raise warning 'verio_create_profile : %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists verio_on_auth_user_created on auth.users;
create trigger verio_on_auth_user_created
  after insert on auth.users
  for each row execute function public.verio_create_profile();

-- 3. Colonnes visibles par les autres membres (liste blanche)
do $$
declare
  public_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into public_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name in ('id', 'full_name', 'username', 'city', 'bio', 'strategy',
                        'investing_since', 'streak_mois', 'avatar_url', 'created_at');

  execute 'revoke select on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', public_cols);
end $$;

notify pgrst, 'reload schema';

-- Vérification : colonnes de profiles lisibles par les membres connectés
select string_agg(column_name, ', ' order by column_name) as colonnes_publiques
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee = 'authenticated' and privilege_type = 'SELECT';
