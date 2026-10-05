-- Table des notifications (la cloche 🔔).
--
-- Elle manquait dans le projet Supabase : l'application y écrivait (demandes
-- d'ami, likes, commentaires…) sans effet. On la crée, avec ses règles :
--   - chacun ne lit, ne marque comme lues et ne supprime que les siennes ;
--   - un membre ne peut notifier que quelqu'un d'autre, pour une action à lui,
--     et seulement pour les types prévus ;
--   - le nom et l'identifiant de l'expéditeur sont fixés par la base, d'après
--     le compte connecté (impossible d'écrire « de la part de » quelqu'un d'autre).
-- Les notifications créées par le serveur (badges, moments, fin de sondage)
-- passent par des fonctions security definer, non concernées par ces règles.

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Si une version partielle existait déjà
alter table public.notifications add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists read boolean not null default false;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "lire ses notifications" on public.notifications;
create policy "lire ses notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "marquer ses notifications" on public.notifications;
create policy "marquer ses notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "supprimer ses notifications" on public.notifications;
create policy "supprimer ses notifications" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "notifier un membre" on public.notifications;
create policy "notifier un membre" on public.notifications
  for insert to authenticated
  with check (
    user_id <> auth.uid()
    and type in ('friend_request', 'friend_accepted', 'activity_like', 'activity_comment', 'post_reaction')
  );

revoke all on public.notifications from anon, authenticated;
grant select, insert, delete on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

-- Expéditeur fixé par la base (pour les notifications envoyées depuis l'application)
create or replace function public.verio_notification_sender()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is not null and new.user_id <> me then
    new.data := coalesce(new.data, '{}'::jsonb)
      || jsonb_build_object('from_id', me, 'from_name', (select full_name from profiles where id = me));
  end if;
  return new;
end;
$$;
revoke execute on function public.verio_notification_sender() from public, anon, authenticated;

drop trigger if exists verio_before_notification on public.notifications;
create trigger verio_before_notification before insert on public.notifications
  for each row execute function public.verio_notification_sender();

notify pgrst, 'reload schema';
