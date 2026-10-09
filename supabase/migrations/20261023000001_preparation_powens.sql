-- Préparation de Powens (agrégation bancaire) et allègement des écritures du portefeuille.
-- Sans effet visible tant que Powens n'est pas branché : rien ne change pour les
-- positions saisies à la main.
--
-- 1. portfolio_entries : origine de chaque position (« manual » ou « powens »), avec
--    l'identifiant du placement chez Powens pour les mises à jour (jamais visible des
--    autres membres) et la date de dernière synchronisation.
-- 2. set_my_portfolio_weights : les poids de plusieurs positions en un seul appel
--    (avant : une requête par position à chaque ajout, modification ou suppression).
-- 3. bank_connections : les banques connectées d'un membre (lecture par lui seul ;
--    écriture réservée au serveur, clé service_role).
-- 4. verio_private.powens_users : l'identifiant et le jeton Powens de chaque membre,
--    illisibles depuis l'application.
-- 5. portfolio_valuations : la valeur du portefeuille jour après jour (historique réel,
--    pour remplacer les simulations) ; montants lisibles par le propriétaire seul.

-- 1. Origine des positions
alter table public.portfolio_entries add column if not exists source text not null default 'manual';
alter table public.portfolio_entries drop constraint if exists portfolio_entries_source_check;
alter table public.portfolio_entries add constraint portfolio_entries_source_check check (source in ('manual', 'powens'));
alter table public.portfolio_entries add column if not exists external_id text;
alter table public.portfolio_entries add column if not exists synced_at timestamptz;
create unique index if not exists portfolio_entries_external_idx
  on public.portfolio_entries (user_id, external_id) where external_id is not null;
-- Lecture par colonne (voir 20261004000002) : l'origine et la date se voient, pas l'identifiant
grant select (source, synced_at) on public.portfolio_entries to authenticated;

-- Une position synchronisée se met à jour depuis la banque, pas à la main ; seul son
-- poids peut être recalculé (répartition à 100 %). Depuis l'appli, une nouvelle position
-- est toujours « manual ». (Pas de commentaire dans le corps des fonctions : l'éditeur
-- SQL de Supabase se trompe sur les apostrophes qui s'y trouvent.)
create or replace function public.verio_protect_synced_entries()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' and old.source = 'powens' then
    if tg_op = 'DELETE' then raise exception 'Position synchronisée : elle se gère depuis la banque'; end if;
    if (to_jsonb(new) - 'percentage') is distinct from (to_jsonb(old) - 'percentage') then
      raise exception 'Position synchronisée : elle se gère depuis la banque';
    end if;
  end if;
  if auth.role() = 'authenticated' and tg_op = 'UPDATE' and new.source is distinct from old.source then
    raise exception 'Origine d''une position non modifiable';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists verio_protect_synced_entries on public.portfolio_entries;
create trigger verio_protect_synced_entries before update or delete on public.portfolio_entries
  for each row execute function public.verio_protect_synced_entries();

create or replace function public.verio_manual_source_on_insert()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then new.source := 'manual'; new.external_id := null; new.synced_at := null; end if;
  return new;
end;
$$;
drop trigger if exists verio_manual_source_on_insert on public.portfolio_entries;
create trigger verio_manual_source_on_insert before insert on public.portfolio_entries
  for each row execute function public.verio_manual_source_on_insert();

-- 2. Poids de plusieurs positions en un appel : [{ "id": 12, "percentage": 42.5 }, …]
create or replace function public.set_my_portfolio_weights(weights jsonb)
returns void language sql security invoker set search_path = public as $$
  update portfolio_entries e
  set percentage = (w ->> 'percentage')::numeric
  from jsonb_array_elements(weights) w
  where e.id = (w ->> 'id')::bigint and e.user_id = auth.uid();
$$;
revoke execute on function public.set_my_portfolio_weights(jsonb) from public, anon;
grant execute on function public.set_my_portfolio_weights(jsonb) to authenticated;

-- 3. Banques connectées
create table if not exists public.bank_connections (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'powens',
  provider_connection_id text not null,
  institution text,                         -- nom de la banque ou du courtier
  status text not null default 'active',    -- active | error | needs_action (reconnexion demandée)
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_connection_id)
);
alter table public.bank_connections enable row level security;
drop policy if exists "mes banques" on public.bank_connections;
create policy "mes banques" on public.bank_connections for select to authenticated using (user_id = auth.uid());
revoke all on public.bank_connections from anon, authenticated;
grant select on public.bank_connections to authenticated;

-- 4. Identifiants Powens (jamais lisibles depuis l'application)
create schema if not exists verio_private;
revoke all on schema verio_private from public, anon, authenticated;
create table if not exists verio_private.powens_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  powens_user_id bigint not null unique,
  auth_token text not null,
  created_at timestamptz not null default now()
);

-- 5. Historique de valeur (un point par jour)
create table if not exists public.portfolio_valuations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  value numeric not null,          -- valeur totale (privée)
  net_flows numeric not null default 0, -- versements − retraits du jour, pour une performance hors apports
  primary key (user_id, day)
);
alter table public.portfolio_valuations enable row level security;
drop policy if exists "mon historique" on public.portfolio_valuations;
create policy "mon historique" on public.portfolio_valuations for select to authenticated using (user_id = auth.uid());
revoke all on public.portfolio_valuations from anon, authenticated;
grant select on public.portfolio_valuations to authenticated;

notify pgrst, 'reload schema';
