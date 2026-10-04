-- Stats de classement par membre, calculées en une seule requête.
-- Remplace les 2 à 4 requêtes par membre faites jusqu'ici par l'app
-- (Classements, classement des clubs, classement amis du profil).
--
-- security_invoker : la vue s'exécute avec les droits de l'utilisateur
-- connecté, donc les règles RLS et la protection de prix_achat /
-- nombre_parts s'appliquent. Elle n'utilise que des colonnes publiques.

create or replace view public.member_stats
with (security_invoker = true)
as
with positions as (
  select
    user_id,
    count(*) as nb_positions,
    sum(percentage) filter (where performance is not null) as pct_avec_perf,
    sum(performance * percentage) filter (where performance is not null) as perf_ponderee,
    count(distinct coalesce(nullif(exposition, ''), type, '')) as nb_expositions,
    count(distinct nullif(broker, '')) as nb_brokers,
    max(percentage) as max_position
  from public.portfolio_entries
  group by user_id
)
select
  p.id,
  p.full_name,
  p.username,
  p.city,
  p.strategy,
  p.investing_since,
  coalesce(p.streak_mois, 0) as streak_mois,
  -- Performance moyenne pondérée par le poids de chaque position
  case when pos.pct_avec_perf > 0 then pos.perf_ponderee / pos.pct_avec_perf end as perf,
  -- Score de diversification sur 100 (même formule que l'ancien calcul côté app)
  case when pos.nb_positions > 0 then
      least(pos.nb_expositions * 15, 40)
    + least(pos.nb_brokers * 10, 20)
    + case when pos.max_position <= 30 then 25 when pos.max_position <= 50 then 15 else 5 end
    + least(pos.nb_positions * 3, 15)
  else 0 end as score_diversif,
  (select count(*) from public.user_badges b where b.user_id = p.id) as nb_badges,
  (select count(*) from public.club_posts cp where cp.user_id = p.id)
    + (select count(*) from public.club_replies cr where cr.user_id = p.id) as contribution
from public.profiles p
left join positions pos on pos.user_id = p.id;

revoke all on public.member_stats from anon;
grant select on public.member_stats to authenticated;

notify pgrst, 'reload schema';
