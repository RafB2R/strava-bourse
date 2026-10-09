-- Profil manquant : un compte sans ligne dans profiles ne peut rien enregistrer
-- (« portfolio_entries_user_id_fkey »). Le trigger d'inscription n'empêche jamais
-- l'inscription, mais il peut avoir échoué, ou le compte être plus ancien que lui.
--
-- Cause probable : la création du profil écrit la colonne « email », qu'aucune
-- migration ne créait ; si elle manque, l'insertion échoue (en silence) à chaque
-- inscription, Google compris : le compte existe (Authentication → Users) mais pas
-- son profil (Table Editor → profiles).
--
-- 0. La colonne email est ajoutée si elle manque (non visible des autres membres).
-- 1. La création du profil ne peut plus échouer : en cas d'erreur, profil minimal (id).
-- 2. Rattrapage : un profil pour chaque compte qui n'en a pas.
-- 3. ensure_my_profile() : l'appli le crée elle-même si elle ne le trouve pas.

alter table public.profiles add column if not exists email text;

create or replace function public.verio_profile_from_auth(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  u auth.users%rowtype;
  v_username text;
begin
  select * into u from auth.users where id = uid;
  if not found then return; end if;
  v_username := nullif(lower(btrim(u.raw_user_meta_data ->> 'username')), '');
  if exists (select 1 from profiles where username = v_username) then v_username := null; end if;
  begin
    insert into profiles (id, full_name, username, email)
    values (
      uid,
      coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', '')),
      v_username,
      u.email
    )
    on conflict (id) do nothing;
  exception when others then
    -- Dernier recours : profil minimal (le nom se complète ensuite dans Profil)
    raise warning 'profil complet impossible pour % : %', uid, sqlerrm;
    insert into profiles (id) values (uid) on conflict (id) do nothing;
  end;
end;
$$;

-- Inscription (email ou Google) : même création, qui ne bloque jamais l'inscription
create or replace function public.verio_create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform verio_profile_from_auth(new.id);
  return new;
exception when others then
  raise warning 'verio_create_profile : %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists verio_on_auth_user_created on auth.users;
create trigger verio_on_auth_user_created
  after insert on auth.users
  for each row execute function public.verio_create_profile();
revoke execute on function public.verio_profile_from_auth(uuid) from public, anon, authenticated;
revoke execute on function public.verio_create_profile() from public, anon, authenticated;

create or replace function public.ensure_my_profile()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then perform verio_profile_from_auth(auth.uid()); end if;
end;
$$;
revoke execute on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- Rattrapage
do $$
declare r record;
begin
  for r in select u.id from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id) loop
    perform public.verio_profile_from_auth(r.id);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Vérification : doit renvoyer 0
-- select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);
