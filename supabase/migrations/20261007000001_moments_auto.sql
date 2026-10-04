-- Moments auto : publiés dans le fil par le serveur, une seule fois chacun.
--
--   anniversaire_1a / 3a / 5a / 10a : X ans depuis la première position sur Verio
--   dca_3m / dca_6m / dca_1a / dca_3a : série de 3, 6, 12, 36 mois d'affilée
--   premier_etf, premiere_action      : première position de ce type
--   10_positions                      : 10 positions dans le portefeuille
--   portfolio_complete                : portefeuille alloué à 100 %
--
-- Le moment est publié dans le fil (activities) et l'utilisateur reçoit une
-- notification. user_moments garde la trace pour ne jamais republier.

create table if not exists public.user_moments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  moment_id text not null,
  achieved_at timestamptz not null default now(),
  primary key (user_id, moment_id)
);

alter table public.user_moments enable row level security;
revoke all on public.user_moments from anon, authenticated;

-- Série de mois consécutifs avec un investissement (le mois en cours ne la
-- casse pas tant qu'il n'est pas terminé). Même règle que sync_my_badges().
create or replace function public.verio_streak(uid uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_streak int := 0;
begin
  if not exists (
    select 1 from activities
    where user_id = uid and type in ('new_position', 'renforcement', 'rebalancement')
      and date_trunc('month', created_at)::date = v_month
  ) then
    v_month := (v_month - interval '1 month')::date;
  end if;
  while exists (
    select 1 from activities
    where user_id = uid and type in ('new_position', 'renforcement', 'rebalancement')
      and date_trunc('month', created_at)::date = v_month
  ) loop
    v_streak := v_streak + 1;
    v_month := (v_month - interval '1 month')::date;
  end loop;
  return v_streak;
end;
$$;

-- Détecte et publie les nouveaux moments d'un utilisateur. Renvoie les moments publiés.
create or replace function public.verio_sync_moments(uid uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first timestamptz;
  v_years int := 0;
  v_streak int;
  v_positions int;
  v_total numeric;
  v_etf text;
  v_action text;
  v_new text[];
begin
  select min(created_at) into v_first
  from activities where user_id = uid and type = 'new_position';
  if v_first is not null then
    v_years := extract(year from age(now(), v_first))::int;
  end if;

  v_streak := verio_streak(uid);

  select count(*), coalesce(sum(percentage), 0) into v_positions, v_total
  from portfolio_entries where user_id = uid;

  select label into v_etf from portfolio_entries
  where user_id = uid and type = 'ETF' order by id limit 1;
  select label into v_action from portfolio_entries
  where user_id = uid and type = 'Action directe' order by id limit 1;

  -- family/rank : sur une même famille, seul le plus haut palier nouvellement
  -- atteint est publié (les paliers inférieurs sont marqués sans être publiés)
  with candidates(moment_id, family, rank, reached, data) as (
    values
      ('anniversaire_1a', 'anniversaire', 1, v_years >= 1, jsonb_build_object('years', 1)),
      ('anniversaire_3a', 'anniversaire', 3, v_years >= 3, jsonb_build_object('years', 3)),
      ('anniversaire_5a', 'anniversaire', 5, v_years >= 5, jsonb_build_object('years', 5)),
      ('anniversaire_10a', 'anniversaire', 10, v_years >= 10, jsonb_build_object('years', 10)),
      ('dca_3m', 'dca', 3, v_streak >= 3, jsonb_build_object('months', 3)),
      ('dca_6m', 'dca', 6, v_streak >= 6, jsonb_build_object('months', 6)),
      ('dca_1a', 'dca', 12, v_streak >= 12, jsonb_build_object('months', 12)),
      ('dca_3a', 'dca', 36, v_streak >= 36, jsonb_build_object('months', 36)),
      ('premier_etf', 'premier_etf', 1, v_etf is not null, jsonb_build_object('label', v_etf)),
      ('premiere_action', 'premiere_action', 1, v_action is not null, jsonb_build_object('label', v_action)),
      ('10_positions', '10_positions', 1, v_positions >= 10, '{}'::jsonb),
      ('portfolio_complete', 'portfolio_complete', 1, v_total >= 99.5, '{}'::jsonb)
  ),
  inserted as (
    insert into user_moments (user_id, moment_id)
    select uid, moment_id from candidates where reached
    on conflict (user_id, moment_id) do nothing
    returning moment_id
  ),
  to_publish as (
    select distinct on (c.family) c.moment_id, c.data
    from candidates c join inserted i on i.moment_id = c.moment_id
    order by c.family, c.rank desc
  ),
  published as (
    insert into activities (user_id, type, data)
    select uid, moment_id, data from to_publish
    returning type
  )
  select coalesce(array_agg(type), '{}') into v_new from published;

  if cardinality(v_new) > 0 then
    insert into notifications (user_id, type, data)
    select uid, 'moment', jsonb_build_object('moment_id', m) from unnest(v_new) as m;
  end if;

  return v_new;
end;
$$;

-- Appelée par l'app (connexion, ajout d'une position) pour l'utilisateur connecté
create or replace function public.sync_my_moments()
returns text[]
language sql
security definer
set search_path = public
as $$
  select case when auth.uid() is null then '{}'::text[] else verio_sync_moments(auth.uid()) end;
$$;

-- Pour un traitement quotidien : publie les moments de tous les membres actifs
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
  for r in select distinct user_id from activities where type = 'new_position' loop
    n := n + cardinality(verio_sync_moments(r.user_id));
  end loop;
  return n;
end;
$$;

revoke execute on function public.verio_streak(uuid) from public, anon, authenticated;
revoke execute on function public.verio_sync_moments(uuid) from public, anon, authenticated;
revoke execute on function public.verio_sync_moments_for_all() from public, anon, authenticated;
revoke execute on function public.sync_my_moments() from public, anon;
grant execute on function public.sync_my_moments() to authenticated;

notify pgrst, 'reload schema';

-- Optionnel : publier les anniversaires le jour même, chaque matin à 7 h (UTC).
-- Nécessite l'extension pg_cron (Supabase → Database → Extensions → pg_cron),
-- puis exécuter :
--   select cron.schedule('verio-moments', '0 7 * * *', 'select public.verio_sync_moments_for_all()');
