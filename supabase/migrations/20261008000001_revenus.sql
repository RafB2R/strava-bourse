-- Revenus des positions (dividendes et coupons) et rendement.
--
-- portfolio_income : un versement reçu sur une position. Le montant est privé :
-- seul le propriétaire lit, ajoute ou supprime ses lignes. Le fil n'affiche
-- jamais le montant (« a reçu un dividende · TotalEnergies »).
-- Le type de entry_id est repris de portfolio_entries.id.

do $$
declare
  entry_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into entry_id_type
  from pg_attribute a
  where a.attrelid = 'public.portfolio_entries'::regclass
    and a.attname = 'id';

  execute format($sql$
    create table if not exists public.portfolio_income (
      id bigint generated always as identity primary key,
      user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
      entry_id %1$s not null references public.portfolio_entries(id) on delete cascade,
      type text not null default 'dividende' check (type in ('dividende', 'coupon')),
      amount numeric(14, 2) not null check (amount > 0),
      received_at date not null default current_date,
      created_at timestamptz not null default now()
    )$sql$, entry_id_type);
end $$;

create index if not exists portfolio_income_user_idx on public.portfolio_income (user_id, received_at desc);

alter table public.portfolio_income enable row level security;

create policy "voir ses revenus" on public.portfolio_income
  for select to authenticated
  using (user_id = auth.uid());

-- Seulement sur une de ses propres positions
create policy "ajouter un revenu" on public.portfolio_income
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.portfolio_entries e where e.id = entry_id and e.user_id = auth.uid())
  );

create policy "supprimer un revenu" on public.portfolio_income
  for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.portfolio_income from anon;
grant select, insert, delete on public.portfolio_income to authenticated;

-- Moments : ajoute « premier dividende » (le reste est identique à 20261007000001)
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
      ('portfolio_complete', 'portfolio_complete', 1, v_total >= 99.5, '{}'::jsonb),
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

notify pgrst, 'reload schema';
