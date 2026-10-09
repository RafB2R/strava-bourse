-- Profil manquant : un compte sans ligne dans profiles ne peut rien enregistrer
-- (« portfolio_entries_user_id_fkey »). Le trigger d'inscription n'empêche jamais
-- l'inscription, mais il peut avoir échoué, ou le compte être plus ancien que lui.
--
-- 1. Rattrapage : un profil pour chaque compte qui n'en a pas.
-- 2. ensure_my_profile() : l'appli le crée elle-même si elle ne le trouve pas.

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
  insert into profiles (id, full_name, username, email)
  values (
    uid,
    coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', '')),
    v_username,
    u.email
  )
  on conflict (id) do nothing;
end;
$$;
revoke execute on function public.verio_profile_from_auth(uuid) from public, anon, authenticated;

create or replace function public.ensure_my_profile()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then perform verio_profile_from_auth(auth.uid()); end if;
end;
$$;
revoke execute on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

-- Rattrapage (les erreurs s'affichent ici, au lieu d'être tues à l'inscription)
do $$
declare r record;
begin
  for r in select u.id from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id) loop
    perform public.verio_profile_from_auth(r.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
