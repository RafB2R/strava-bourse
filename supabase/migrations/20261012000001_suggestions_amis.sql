-- Suggestions d'amis (colonne de droite, sur ordinateur).
--
-- Par ordre de priorité :
--   1. les amis de mes amis, classés par nombre d'amis en commun ;
--   2. les membres de mes clubs.
-- Jamais de membre pris au hasard : on ne met en avant que des personnes
-- déjà proches de mon réseau. Sont exclus : moi, mes amis, et les personnes
-- avec qui une demande est en cours (dans un sens ou dans l'autre).
-- Ne renvoie que les colonnes publiques du profil.

create or replace function public.friend_suggestions(max_results int default 3)
returns table (
  id uuid,
  full_name text,
  username text,
  city text,
  strategy text,
  mutual_friends int,
  shared_club text
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  links as (
    select case when f.requester_id = me.uid then f.receiver_id else f.requester_id end as other, f.status
    from friendships f, me
    where me.uid in (f.requester_id, f.receiver_id)
  ),
  my_friends as (select other from links where status = 'accepted'),
  excluded as (select other from links union select uid from me),
  fof as (
    select case when f.requester_id = mf.other then f.receiver_id else f.requester_id end as candidate,
           count(distinct mf.other)::int as mutual
    from my_friends mf
    join friendships f on f.status = 'accepted' and mf.other in (f.requester_id, f.receiver_id)
    group by 1
  ),
  club_mates as (
    select cm2.user_id as candidate, min(c.name) as club
    from club_members cm1
    join club_members cm2 on cm2.club_id = cm1.club_id
    join clubs c on c.id = cm1.club_id
    where cm1.user_id = (select uid from me)
    group by cm2.user_id
  ),
  candidates as (
    select coalesce(fof.candidate, club_mates.candidate) as candidate,
           coalesce(fof.mutual, 0) as mutual,
           club_mates.club
    from fof
    full join club_mates on club_mates.candidate = fof.candidate
  )
  select p.id, p.full_name, p.username, p.city, p.strategy, c.mutual, c.club
  from candidates c
  join profiles p on p.id = c.candidate
  where c.candidate not in (select other from excluded)
    and p.full_name is not null
  order by c.mutual desc, (c.club is not null) desc, p.full_name
  limit least(greatest(coalesce(max_results, 3), 1), 10);
$$;

revoke execute on function public.friend_suggestions(int) from public, anon;
grant execute on function public.friend_suggestions(int) to authenticated;

notify pgrst, 'reload schema';
