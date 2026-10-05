-- Notifications push sur le téléphone (et l'ordinateur).
--
-- 1. push_subscriptions : les appareils où chaque membre a activé les
--    notifications (chacun ne voit et ne gère que les siens).
-- 2. Quand une notification Verio est créée (demande d'ami, ami accepté,
--    commentaire, fin de sondage) ou qu'un message privé arrive, la base
--    appelle /api/push sur Vercel, qui envoie la notification aux appareils
--    du destinataire. L'appel passe par l'extension pg_net.
-- 3. L'adresse de /api/push et le secret partagé avec Vercel sont rangés dans
--    verio_private.settings, illisible depuis l'application.
--
-- À FAIRE UNE FOIS (voir la fin du fichier) : activer pg_net et renseigner
-- l'adresse et le secret. Sans cela, rien n'est envoyé et rien ne casse.

-- 1. Appareils abonnés
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "voir ses appareils" on public.push_subscriptions;
create policy "voir ses appareils" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "ajouter un appareil" on public.push_subscriptions;
create policy "ajouter un appareil" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "retirer un appareil" on public.push_subscriptions;
create policy "retirer un appareil" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Un appareil réabonné par un autre compte (téléphone partagé) change de propriétaire
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language sql security definer set search_path = public as $$
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
$$;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- 2. Réglages privés
create schema if not exists verio_private;
revoke all on schema verio_private from public, anon, authenticated;
create table if not exists verio_private.settings (key text primary key, value text not null);

-- Envoie une notification push à un membre (sans effet si non configuré)
create or replace function public.verio_send_push(target uuid, title text, body text, url text default '/', tag text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  push_url text;
  push_secret text;
begin
  if target is null or not exists (select 1 from push_subscriptions where user_id = target) then
    return;
  end if;
  select value into push_url from verio_private.settings where key = 'push_url';
  select value into push_secret from verio_private.settings where key = 'push_secret';
  if push_url is null or push_secret is null
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using push_url,
          jsonb_build_object('user_id', target, 'title', title, 'body', left(body, 180), 'url', url, 'tag', tag),
          jsonb_build_object('Content-Type', 'application/json', 'x-verio-secret', push_secret);
exception when others then
  -- Une notification push ne doit jamais bloquer l'action qui la déclenche
  raise warning 'verio_send_push : %', sqlerrm;
end;
$$;
revoke execute on function public.verio_send_push(uuid, text, text, text, text) from public, anon, authenticated;

-- Notifications Verio → push
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
    when 'activity_comment' then
      perform verio_send_push(new.user_id, who || ' a commenté', coalesce(d ->> 'excerpt', ''), '/?tab=feed', 'comment-' || coalesce(d ->> 'activity_id', ''));
    when 'poll_ended' then
      select string_agg(w, ' / ') into winners from jsonb_array_elements_text(coalesce(d -> 'winners', '[]'::jsonb)) w;
      perform verio_send_push(new.user_id,
        case when (d ->> 'mine')::boolean then 'Ton sondage est terminé 📊' else 'Sondage terminé 📊' end,
        coalesce(nullif(d ->> 'question', ''), 'Résultat') || case when winners is not null then ' → ' || winners || ' (' || coalesce(d ->> 'winner_pct', '0') || ' %)' else ' → aucun vote' end,
        '/?tab=feed', 'poll-' || coalesce(d ->> 'activity_id', ''));
    else
      null; -- likes, badges, moments : pas de push, ils restent dans la cloche
  end case;
  return new;
end;
$$;

drop trigger if exists verio_push_after_notification on public.notifications;
create trigger verio_push_after_notification after insert on public.notifications
  for each row execute function public.verio_push_on_notification();

-- Messages privés → push à l'autre membre de la conversation
create or replace function public.verio_push_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
  recipient uuid;
  preview text;
begin
  select full_name into sender_name from profiles where id = new.sender_id;
  preview := case when btrim(coalesce(new.content, '')) = '' then '📷 Photo' else new.content end;
  for recipient in
    select user_id from conversation_members where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    perform verio_send_push(recipient, coalesce(sender_name, 'Nouveau message'), preview, '/?tab=messages', 'conv-' || new.conversation_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists verio_push_after_message on public.messages;
create trigger verio_push_after_message after insert on public.messages
  for each row execute function public.verio_push_on_message();

revoke execute on function public.verio_push_on_notification(), public.verio_push_on_message() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- 3. À FAIRE UNE FOIS, à la main (remplacer les deux valeurs) :
--
--   create extension if not exists pg_net;
--   insert into verio_private.settings (key, value) values
--     ('push_url', 'https://strava-bourse.vercel.app/api/push'),
--     ('push_secret', 'LE_MEME_SECRET_QUE_PUSH_WEBHOOK_SECRET_DANS_VERCEL')
--   on conflict (key) do update set value = excluded.value;
