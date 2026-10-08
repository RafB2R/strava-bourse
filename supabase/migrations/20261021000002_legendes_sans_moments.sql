-- Légendes (comptes 13F) : ni moments ni badges.
--
-- Leurs comptes ont un portefeuille et des déclarations trimestrielles, et le
-- traitement quotidien des moments les comptait comme des membres (ex. « 🔥 6 mois »
-- chez Warren Buffett). Une Légende ne publie que ses déclarations 13F : toute autre
-- activité à son nom est ignorée, et ce qui a déjà été publié est retiré.

create or replace function public.verio_legend_only_13f()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type <> 'declaration_13f' and exists (select 1 from super_investors where user_id = new.user_id) then
    return null; -- rien n'est inséré, sans erreur pour l'appelant
  end if;
  return new;
end;
$$;
revoke execute on function public.verio_legend_only_13f() from public, anon, authenticated;

drop trigger if exists verio_legend_only_13f on public.activities;
create trigger verio_legend_only_13f before insert on public.activities
  for each row execute function public.verio_legend_only_13f();

-- Traitement quotidien : les Légendes ne sont plus parcourues
create or replace function public.verio_sync_moments_for_all()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select distinct a.user_id from activities a
    where a.type = 'new_position'
      and not exists (select 1 from super_investors s where s.user_id = a.user_id)
  loop
    n := n + cardinality(verio_sync_moments(r.user_id));
  end loop;
  return n;
end;
$$;
revoke execute on function public.verio_sync_moments_for_all() from public, anon, authenticated;

-- Nettoyage de ce qui a déjà été publié
delete from public.activities a using public.super_investors s
  where a.user_id = s.user_id and a.type <> 'declaration_13f';
delete from public.user_moments m using public.super_investors s where m.user_id = s.user_id;
delete from public.user_badges b using public.super_investors s where b.user_id = s.user_id;
delete from public.notifications n using public.super_investors s
  where n.user_id = s.user_id and n.type in ('moment', 'badge_unlocked');

notify pgrst, 'reload schema';
