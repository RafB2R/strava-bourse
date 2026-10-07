-- Badges : la famille Community (nombre de clubs rejoints) est supprimée.
-- Rejoindre 10 clubs prend 10 clics et donnait le titre « Mentor » : ça ne
-- récompensait rien. Il reste 6 familles : Régularité, Milestones, Builder,
-- Explorer, Diversification et Climber.
--
-- 1. sync_my_badges() n'attribue plus les paliers Community (même fonction que
--    dans 20261005000002_badges_serveur.sql, sans la famille community).
-- 2. Les badges Community déjà gagnés sont retirés, avec leurs cartes dans le
--    fil et leurs notifications.

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

  -- Portefeuille : nombre de positions, de types d'actifs, performance pondérée
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

  select count(*) into v_clubs from club_members where user_id = uid;

  select nullif(investing_since::text, '')::int, nullif(date_naissance::text, '')::date
    into v_since, v_birth
  from profiles
  where id = uid;

  v_years := case when v_since is not null then extract(year from now())::int - v_since end;

  -- Série de mois consécutifs avec au moins un investissement. Le mois en cours
  -- ne casse pas la série tant qu'il n'est pas terminé : si rien n'a encore été
  -- investi ce mois-ci, on compte à partir du mois précédent.
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

  -- Badge anniversaire : un investissement fait le jour de son anniversaire
  if v_birth is not null then
    v_birthday := exists (
      select 1 from activities
      where user_id = uid and type in ('new_position', 'renforcement', 'rebalancement')
        and to_char(created_at, 'MM-DD') = to_char(v_birth, 'MM-DD')
    );
  end if;

  -- Paliers atteints (badges définitifs une fois gagnés)
  with levels(cat, medal, target) as (
    values
      ('dca', '🥉', 3), ('dca', '🥈', 12), ('dca', '🥇', 36), ('dca', '💎', 120),
      ('milestones', '🥉', 1), ('milestones', '🥈', 5), ('milestones', '🥇', 10), ('milestones', '💎', 25),
      ('builder', '🥉', 1), ('builder', '🥈', 10), ('builder', '🥇', 50), ('builder', '💎', 100),
      ('explorer', '🥉', 1), ('explorer', '🥈', 3), ('explorer', '🥇', 5), ('explorer', '💎', 8),
      ('diversification', '🥉', 3), ('diversification', '🥈', 5), ('diversification', '🥇', 8), ('diversification', '💎', 10),
      ('climber', '🥉', 10), ('climber', '🥈', 50), ('climber', '🥇', 100), ('climber', '💎', 1000)
  ),
  vals(cat, val) as (
    values
      ('dca', v_streak::numeric),
      ('milestones', v_years::numeric),
      ('builder', v_positions::numeric),
      ('explorer', case when v_positions > 0 then v_types end::numeric),
      ('diversification', v_positions::numeric),
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
    -- Une notification par badge gagné
    insert into notifications (user_id, type, data)
    select uid, 'badge_unlocked', jsonb_build_object('badge_id', b, 'badge_medal', coalesce(split_part(b, '_', 2), ''))
    from unnest(v_new) as b;

    -- Dans le fil : seulement le plus haut nouveau palier de chaque catégorie
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

delete from public.activities where type = 'badge' and data ->> 'badge_id' like 'community\_%';
delete from public.notifications where type = 'badge_unlocked' and data ->> 'badge_id' like 'community\_%';
delete from public.user_badges where badge_id like 'community\_%';

notify pgrst, 'reload schema';
