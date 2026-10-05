-- Mentions dans les posts (@pseudo) : notification dans la cloche et sur le téléphone.
-- À exécuter après 20261013000002_table_notifications.sql et 20261014000001_notifications_push.sql.

drop policy if exists "notifier un membre" on public.notifications;
create policy "notifier un membre" on public.notifications
  for insert to authenticated
  with check (
    user_id <> auth.uid()
    and type in ('friend_request', 'friend_accepted', 'activity_like', 'activity_comment', 'post_reaction', 'mention')
  );

-- Notifications Verio → push (ajout des mentions)
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
    else
      null; -- likes, badges, moments : pas de push, ils restent dans la cloche
  end case;
  return new;
end;
$$;

revoke execute on function public.verio_push_on_notification() from public, anon, authenticated;

notify pgrst, 'reload schema';
