-- Badges et étiquettes du profil.
--
-- 1. Badges (sync_my_badges, même fonction que 20261018000001 avec ces changements) :
--    - Diversification ne compte plus les lignes (c'était le travail de Builder) mais la
--      répartition : 🥉 2 expositions et aucune ligne > 50 %, 🥈 3 expositions et ≤ 30 %,
--      🥇 4 expositions et ≤ 20 %, 💎 la même chose avec un score de diversification
--      ≥ 85/100. La valeur suivie est le palier atteint (0 à 4). Les badges déjà gagnés
--      restent acquis.
--    - Explorer 💎 : 7 types d'actifs (il n'en existe que 7 ; 8 était inatteignable).
-- 2. Étiquettes automatiques (au plus 2, à la place de la stratégie choisie à la main),
--    calculées à partir du portefeuille et recalculées à chaque changement :
--    passif (ETF ≥ 70 %), stock picker (actions en direct ≥ 50 %), prudent (obligations
--    + monétaire ≥ 50 %), pierre (immobilier ≥ 40 %), crypto (≥ 30 %), diversifié
--    (≥ 4 expositions, aucune ligne > 20 %), dividendes (revenus des 12 derniers mois
--    ≥ 3 % de la valeur), sinon mixte. Les plus marquées d'abord (rapport au seuil).
--    Table profile_labels : lisible par les membres, écrite par la base seule. Seuls des
--    pourcentages y figurent (jamais de montant).

create or replace function public.sync_my_badges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_positions int;
  v_types int;
  v_expos int;
  v_maxline numeric;
  v_brokers int;
  v_score int;
  v_divlevel int := 0;
  v_perf numeric;
  v_clubs int;
  v_years int;
  v_since int;
  v_birth date;
  v_streak int := 0;
  v_month date;
  v_birthday boolean := false;
  v_new text[];
begin
  if uid is null then
    raise exception 'sync_my_badges : utilisateur non connecté';
  end if;

  select
    count(*),
    count(distinct coalesce(type, '')),
    case when sum(percentage) filter (where performance is not null) > 0
      then sum(performance * percentage) filter (where performance is not null)
         / sum(percentage) filter (where performance is not null)
    end
  into v_positions, v_types, v_perf
  from portfolio_entries
  where user_id = uid;

  select
    count(distinct exposition) filter (where exposition is not null and exposition <> ''),
    case when sum(percentage) > 0 then max(percentage) * 100 / sum(percentage) end,
    count(distinct broker) filter (where broker is not null and broker <> '')
  into v_expos, v_maxline, v_brokers
  from portfolio_entries
  where user_id = uid and percentage > 0;
  v_score := least(coalesce(v_expos, 0) * 15, 40) + least(coalesce(v_brokers, 0) * 10, 20)
    + case when v_maxline <= 30 then 25 when v_maxline <= 50 then 15 else 5 end
    + least(v_positions * 3, 15);
  if v_positions > 0 and v_maxline is not null then
    v_divlevel := case
      when v_expos >= 4 and v_maxline <= 20 and v_score >= 85 then 4
      when v_expos >= 4 and v_maxline <= 20 then 3
      when v_expos >= 3 and v_maxline <= 30 then 2
      when v_expos >= 2 and v_maxline <= 50 then 1
      else 0 end;
  end if;

  select count(*) into v_clubs from club_members where user_id = uid;

  select nullif(investing_since::text, '')::int, nullif(date_naissance::text, '')::date
    into v_since, v_birth
  from profiles
  where id = uid;

  v_years := case when v_since is not null then extract(year from now())::int - v_since end;

  v_month := date_trunc('month', now())::date;
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

  update profiles set streak_mois = v_streak where id = uid and streak_mois is distinct from v_streak;

  if v_birth is not null then
    v_birthday := exists (
      select 1 from activities
      where user_id = uid and type in ('new_position', 'renforcement', 'rebalancement')
        and to_char(created_at, 'MM-DD') = to_char(v_birth, 'MM-DD')
    );
  end if;

  with levels(cat, medal, target) as (
    values
      ('dca', '🥉', 3), ('dca', '🥈', 12), ('dca', '🥇', 36), ('dca', '💎', 120),
      ('milestones', '🥉', 1), ('milestones', '🥈', 5), ('milestones', '🥇', 10), ('milestones', '💎', 25),
      ('builder', '🥉', 1), ('builder', '🥈', 10), ('builder', '🥇', 50), ('builder', '💎', 100),
      ('explorer', '🥉', 1), ('explorer', '🥈', 3), ('explorer', '🥇', 5), ('explorer', '💎', 7),
      ('diversification', '🥉', 1), ('diversification', '🥈', 2), ('diversification', '🥇', 3), ('diversification', '💎', 4),
      ('climber', '🥉', 10), ('climber', '🥈', 50), ('climber', '🥇', 100), ('climber', '💎', 1000)
  ),
  vals(cat, val) as (
    values
      ('dca', v_streak::numeric),
      ('milestones', v_years::numeric),
      ('builder', v_positions::numeric),
      ('explorer', case when v_positions > 0 then v_types end::numeric),
      ('diversification', v_divlevel::numeric),
      ('climber', v_perf)
  ),
  earned as (
    select l.cat || '_' || l.medal as badge_id
    from levels l
    join vals v on v.cat = l.cat
    where v.val is not null and v.val >= l.target
    union all
    select 'birthday' where v_birthday
  ),
  inserted as (
    insert into user_badges (user_id, badge_id)
    select uid, badge_id from earned
    on conflict (user_id, badge_id) do nothing
    returning badge_id
  )
  select coalesce(array_agg(badge_id), '{}') into v_new from inserted;

  if cardinality(v_new) > 0 then
    insert into notifications (user_id, type, data)
    select uid, 'badge_unlocked', jsonb_build_object('badge_id', b, 'badge_medal', coalesce(split_part(b, '_', 2), ''))
    from unnest(v_new) as b;

    insert into activities (user_id, type, data)
    select distinct on (split_part(b, '_', 1))
      uid, 'badge', jsonb_build_object('badge_id', b, 'badge_medal', split_part(b, '_', 2))
    from unnest(v_new) with ordinality as n(b, pos)
    order by split_part(b, '_', 1),
      array_position(array['🥉', '🥈', '🥇', '💎'], split_part(b, '_', 2)) desc nulls last;
  end if;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'positions', v_positions,
      'types', case when v_positions > 0 then v_types else 0 end,
      'perf', v_perf,
      'diversification', v_divlevel,
      'exposures', coalesce(v_expos, 0),
      'max_line', round(v_maxline, 1),
      'diversification_score', v_score,
      'clubs', v_clubs,
      'years', v_years,
      'streak', v_streak
    ),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('badge_id', badge_id, 'unlocked_at', unlocked_at) order by unlocked_at)
      from user_badges where user_id = uid
    ), '[]'::jsonb),
    'new', to_jsonb(v_new)
  );
end;
$$;

revoke execute on function public.sync_my_badges() from public, anon;
grant execute on function public.sync_my_badges() to authenticated;

-- 2. Étiquettes
create table if not exists public.profile_labels (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  labels jsonb not null default '[]'::jsonb,   -- [{ "id": "passif", "pct": 78 }, …]
  updated_at timestamptz not null default now()
);
alter table public.profile_labels enable row level security;
drop policy if exists "etiquettes visibles" on public.profile_labels;
create policy "etiquettes visibles" on public.profile_labels for select to authenticated using (true);
revoke all on public.profile_labels from anon, authenticated;
grant select on public.profile_labels to authenticated;

create or replace function public.verio_compute_labels(uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_etf numeric; v_direct numeric; v_prudent numeric; v_pierre numeric; v_crypto numeric;
  v_expos int; v_maxline numeric;
  v_value numeric; v_income numeric; v_yield numeric;
  v_labels jsonb;
begin
  select sum(percentage),
    sum(percentage) filter (where type = 'ETF'),
    sum(percentage) filter (where type like 'Action%'),
    sum(percentage) filter (where exposition in ('Obligations', 'Monétaire')),
    sum(percentage) filter (where exposition = 'Immobilier' or type = 'SCPI'),
    sum(percentage) filter (where exposition = 'Crypto' or type = 'Crypto'),
    count(distinct exposition) filter (where exposition is not null and exposition <> ''),
    max(percentage),
    sum(nombre_parts * prix_actuel) filter (where nombre_parts > 0 and prix_actuel > 0)
  into v_total, v_etf, v_direct, v_prudent, v_pierre, v_crypto, v_expos, v_maxline, v_value
  from portfolio_entries where user_id = uid and percentage > 0;

  if coalesce(v_total, 0) <= 0 then
    delete from profile_labels where user_id = uid;
    return '[]'::jsonb;
  end if;

  select sum(amount) into v_income from portfolio_income
  where user_id = uid and received_at >= (now() - interval '12 months')::date;
  v_yield := case when v_value > 0 and v_income > 0 then v_income * 100 / v_value end;

  with c(id, pct, strength) as (
    values
      ('passif', coalesce(v_etf, 0) * 100 / v_total, coalesce(v_etf, 0) * 100 / v_total / 70),
      ('stock_picker', coalesce(v_direct, 0) * 100 / v_total, coalesce(v_direct, 0) * 100 / v_total / 50),
      ('prudent', coalesce(v_prudent, 0) * 100 / v_total, coalesce(v_prudent, 0) * 100 / v_total / 50),
      ('pierre', coalesce(v_pierre, 0) * 100 / v_total, coalesce(v_pierre, 0) * 100 / v_total / 40),
      ('crypto', coalesce(v_crypto, 0) * 100 / v_total, coalesce(v_crypto, 0) * 100 / v_total / 30),
      ('diversifie', v_maxline * 100 / v_total,
        case when v_expos >= 4 and v_maxline * 100 / v_total <= 20 then 20 / greatest(v_maxline * 100 / v_total, 1) else 0 end),
      ('dividendes', coalesce(v_yield, 0), coalesce(v_yield, 0) / 3)
  ),
  top as (select id, pct from c where strength >= 1 order by strength desc limit 2)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'pct', round(pct, 1))), '[{"id": "mixte"}]'::jsonb)
  into v_labels from top;

  insert into profile_labels (user_id, labels, updated_at) values (uid, v_labels, now())
  on conflict (user_id) do update set labels = excluded.labels, updated_at = now()
  where profile_labels.labels is distinct from excluded.labels;
  return v_labels;
end;
$$;
revoke execute on function public.verio_compute_labels(uuid) from public, anon, authenticated;

create or replace function public.verio_labels_on_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform verio_compute_labels(coalesce(new.user_id, old.user_id));
  return null;
exception when others then
  raise warning 'verio_labels_on_change : %', sqlerrm;
  return null;
end;
$$;
revoke execute on function public.verio_labels_on_change() from public, anon, authenticated;

drop trigger if exists verio_labels_entries on public.portfolio_entries;
create trigger verio_labels_entries after insert or update or delete on public.portfolio_entries
  for each row execute function public.verio_labels_on_change();
drop trigger if exists verio_labels_income on public.portfolio_income;
create trigger verio_labels_income after insert or update or delete on public.portfolio_income
  for each row execute function public.verio_labels_on_change();

-- Calcul initial pour tous les membres qui ont un portefeuille
do $$
declare r record;
begin
  for r in select distinct user_id from public.portfolio_entries loop
    perform public.verio_compute_labels(r.user_id);
  end loop;
end $$;

notify pgrst, 'reload schema';
