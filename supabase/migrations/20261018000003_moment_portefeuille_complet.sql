-- Moments : « a complété son portefeuille à 100 % » est supprimé.
-- Il ne disait rien (un portefeuille saisi est forcément réparti à 100 %), et
-- n'avait plus de sens dès qu'on retire une position (on a juste sorti de
-- l'argent). Même fonction que dans 20261008000001_revenus.sql, sans ce moment ;
-- les cartes déjà publiées et leurs notifications sont retirées.

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
  v_dividend text;
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
  -- Premier revenu reçu (dividende ou coupon) : nom de la position, jamais le montant
  select e.label into v_dividend
  from portfolio_income i join portfolio_entries e on e.id = i.entry_id
  where i.user_id = uid order by i.received_at, i.id limit 1;

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
      ('premier_dividende', 'premier_dividende', 1, v_dividend is not null, jsonb_build_object('label', v_dividend))
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

delete from public.activities where type = 'portfolio_complete';
delete from public.notifications where type = 'moment' and data ->> 'moment_id' = 'portfolio_complete';
delete from public.user_moments where moment_id = 'portfolio_complete';

notify pgrst, 'reload schema';
