-- Super Investors : de vrais profils que l'on suit comme un membre.
--
-- Chaque Super Investor (Buffett, Ackman…) a un compte Verio dont personne ne
-- peut se servir pour se connecter (pas de mot de passe, compte bloqué). Son
-- portefeuille (portfolio_entries) et ses mouvements trimestriels (activité
-- « declaration_13f ») sont écrits uniquement par la tâche quotidienne
-- /api/superinvestors-sync, d'après ses déclarations 13F à la SEC.
--
-- Le suivre n'est pas une amitié : c'est un abonnement à sens unique
-- (super_investor_follows), sans demande à accepter. Il n'apparaît donc ni dans
-- les amis, ni dans les suggestions, ni dans la messagerie.

-- 1. Les Super Investors et leur compte
create table if not exists public.super_investors (
  cik bigint primary key,                       -- identifiant du déclarant à la SEC
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  firm text not null,
  style text,
  icon text,
  last_period date,                             -- trimestre de la dernière déclaration lue
  last_filed date,
  synced_at timestamptz
);

alter table public.super_investors enable row level security;
drop policy if exists "super investors visibles" on public.super_investors;
create policy "super investors visibles" on public.super_investors for select to authenticated using (true);
grant select on public.super_investors to authenticated;

-- 2. Abonnements
create table if not exists public.super_investor_follows (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  investor_id uuid not null references public.super_investors(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, investor_id)
);

alter table public.super_investor_follows enable row level security;
drop policy if exists "mes abonnements" on public.super_investor_follows;
create policy "mes abonnements" on public.super_investor_follows for select to authenticated using (user_id = auth.uid());
drop policy if exists "suivre" on public.super_investor_follows;
create policy "suivre" on public.super_investor_follows for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "ne plus suivre" on public.super_investor_follows;
create policy "ne plus suivre" on public.super_investor_follows for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.super_investor_follows to authenticated;

-- Nombre d'abonnés (sans révéler qui)
create or replace function public.super_investor_followers(investor uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from super_investor_follows where investor_id = investor;
$$;
revoke execute on function public.super_investor_followers(uuid) from public, anon;
grant execute on function public.super_investor_followers(uuid) to authenticated;

-- 3. Leur portefeuille et leurs mouvements sont visibles de tous les membres
-- (les règles existantes, propres aux membres, ne changent pas)
drop policy if exists "activités des super investors" on public.activities;
create policy "activités des super investors" on public.activities for select to authenticated
  using (exists (select 1 from public.super_investors s where s.user_id = activities.user_id));

drop policy if exists "portefeuille des super investors" on public.portfolio_entries;
create policy "portefeuille des super investors" on public.portfolio_entries for select to authenticated
  using (exists (select 1 from public.super_investors s where s.user_id = portfolio_entries.user_id));

-- 4. Création des comptes (une seule fois par Super Investor)
do $$
declare
  r record;
  v_id uuid;
begin
  for r in
    select * from (values
      (1067983::bigint, 'Warren Buffett', 'warrenbuffett', 'Berkshire Hathaway', 'Value investing', '🦁'),
      (1336528, 'Bill Ackman', 'billackman', 'Pershing Square', 'Activiste, portefeuille concentré', '🎯'),
      (1536411, 'Stanley Druckenmiller', 'druckenmiller', 'Duquesne Family Office', 'Macro', '🌍'),
      (1061768, 'Seth Klarman', 'sethklarman', 'Baupost Group', 'Value investing', '🛡️'),
      (1709323, 'Li Lu', 'lilu', 'Himalaya Capital', 'Value investing', '🏔️'),
      (1656456, 'David Tepper', 'davidtepper', 'Appaloosa Management', 'Opportuniste', '🐎'),
      (1569205, 'Terry Smith', 'terrysmith', 'Fundsmith', 'Entreprises de qualité, long terme', '💎'),
      (1649339, 'Michael Burry', 'michaelburry', 'Scion Asset Management', 'Contrarian', '🔍')
    ) as t(cik, full_name, username, firm, style, icon)
  loop
    if exists (select 1 from public.super_investors where cik = r.cik) then continue; end if;
    v_id := gen_random_uuid();

    -- Compte sans mot de passe et bloqué : personne ne peut s'y connecter
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, banned_until)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
            r.username || '@super-investors.verio.invalid', '',
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object('full_name', r.full_name, 'username', r.username),
            now(), now(), '2999-01-01');

    -- Profil (créé normalement par le trigger d'inscription ; sinon ici)
    insert into public.profiles (id, full_name) values (v_id, r.full_name) on conflict (id) do nothing;
    update public.profiles set
      full_name = r.full_name,
      -- Pseudo déjà pris par un membre : variante « _13f »
      username = case when exists (select 1 from public.profiles p where p.username = r.username and p.id <> v_id)
                      then r.username || '_13f' else r.username end,
      strategy = r.style
    where id = v_id;

    insert into public.super_investors (cik, user_id, firm, style, icon) values (r.cik, v_id, r.firm, r.style, r.icon);
  end loop;
end $$;

-- 5. Notification push quand un Super Investor suivi publie sa déclaration
-- (même fonction que dans 20261015000001_mentions.sql, avec le cas « super_filing »)
create or replace function public.verio_push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d jsonb := coalesce(new.data, '{}'::jsonb);
  who text := coalesce(nullif(d ->> 'from_name', ''), 'Quelqu''un');
  winners text;
begin
  case new.type
    when 'friend_request' then
      perform verio_send_push(new.user_id, 'Nouvelle demande d''ami', who || ' veut t''ajouter en ami sur Verio.', '/?tab=profil', 'friend-' || coalesce(d ->> 'from_id', ''));
    when 'friend_accepted' then
      perform verio_send_push(new.user_id, 'Demande acceptée 🤝', who || ' a accepté ta demande d''ami.', '/?tab=feed', 'friend-' || coalesce(d ->> 'from_id', ''));
    when 'mention' then
      perform verio_send_push(new.user_id, who || ' t''a mentionné', coalesce(d ->> 'excerpt', ''), '/?tab=feed', 'mention-' || coalesce(d ->> 'activity_id', ''));
    when 'activity_comment' then
      perform verio_send_push(new.user_id, who || ' a commenté', coalesce(d ->> 'excerpt', ''), '/?tab=feed', 'comment-' || coalesce(d ->> 'activity_id', ''));
    when 'poll_ended' then
      select string_agg(w, ' / ') into winners from jsonb_array_elements_text(coalesce(d -> 'winners', '[]'::jsonb)) w;
      perform verio_send_push(new.user_id,
        case when (d ->> 'mine')::boolean then 'Ton sondage est terminé 📊' else 'Sondage terminé 📊' end,
        coalesce(nullif(d ->> 'question', ''), 'Résultat') || case when winners is not null then ' → ' || winners || ' (' || coalesce(d ->> 'winner_pct', '0') || ' %)' else ' → aucun vote' end,
        '/?tab=feed', 'poll-' || coalesce(d ->> 'activity_id', ''));
    when 'super_filing' then
      perform verio_send_push(new.user_id,
        coalesce(nullif(d ->> 'name', ''), 'Un Super Investor') || ' a publié ses mouvements 🏛️',
        coalesce(d ->> 'moves', '0') || ' changement(s) dans son portefeuille ce trimestre.',
        '/?tab=feed', 'super-' || coalesce(d ->> 'investor_id', ''));
    else
      null; -- likes, badges, moments : pas de push, ils restent dans la cloche
  end case;
  return new;
end;
$$;

notify pgrst, 'reload schema';

-- Vérification : les 8 Super Investors et leur pseudo
select s.cik, p.full_name, p.username, s.firm
from public.super_investors s join public.profiles p on p.id = s.user_id
order by p.full_name;
