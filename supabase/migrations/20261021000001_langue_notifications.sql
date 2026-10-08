-- Notifications push dans la langue du membre.
--
-- L'appli enregistre sa langue (fr ou en) sur le profil à chaque connexion
-- (set_my_lang) ; les notifications push écrites par la base l'utilisent.
-- Sans langue connue : français, comme avant.

alter table public.profiles add column if not exists lang text not null default 'fr';
alter table public.profiles drop constraint if exists profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check check (lang in ('fr', 'en'));

create or replace function public.set_my_lang(p_lang text)
returns void language sql security definer set search_path = public as $$
  update profiles set lang = p_lang
  where id = auth.uid() and p_lang in ('fr', 'en') and lang is distinct from p_lang;
$$;
revoke execute on function public.set_my_lang(text) from public, anon;
grant execute on function public.set_my_lang(text) to authenticated;

-- Notifications Verio → push
create or replace function public.verio_push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d jsonb := coalesce(new.data, '{}'::jsonb);
  en boolean := coalesce((select lang = 'en' from profiles where id = new.user_id), false);
  who text := coalesce(nullif(d ->> 'from_name', ''), case when en then 'Someone' else 'Quelqu''un' end);
  winners text;
begin
  case new.type
    when 'friend_request' then
      perform verio_send_push(new.user_id,
        case when en then 'New connection request' else 'Nouvelle demande d''ami' end,
        case when en then who || ' wants to connect with you on Verio.' else who || ' veut t''ajouter en ami sur Verio.' end,
        '/?tab=profil', 'friend-' || coalesce(d ->> 'from_id', ''));
    when 'friend_accepted' then
      perform verio_send_push(new.user_id,
        case when en then 'Request accepted 🤝' else 'Demande acceptée 🤝' end,
        case when en then who || ' accepted your request.' else who || ' a accepté ta demande d''ami.' end,
        '/?tab=feed', 'friend-' || coalesce(d ->> 'from_id', ''));
    when 'mention' then
      perform verio_send_push(new.user_id,
        case when en then who || ' mentioned you' else who || ' t''a mentionné' end,
        coalesce(d ->> 'excerpt', ''), '/?tab=feed', 'mention-' || coalesce(d ->> 'activity_id', ''));
    when 'activity_comment' then
      perform verio_send_push(new.user_id,
        case when en then who || ' commented' else who || ' a commenté' end,
        coalesce(d ->> 'excerpt', ''), '/?tab=feed', 'comment-' || coalesce(d ->> 'activity_id', ''));
    when 'poll_ended' then
      select string_agg(w, ' / ') into winners from jsonb_array_elements_text(coalesce(d -> 'winners', '[]'::jsonb)) w;
      perform verio_send_push(new.user_id,
        case when (d ->> 'mine')::boolean
          then case when en then 'Your poll has ended 📊' else 'Ton sondage est terminé 📊' end
          else case when en then 'Poll ended 📊' else 'Sondage terminé 📊' end end,
        coalesce(nullif(d ->> 'question', ''), case when en then 'Result' else 'Résultat' end)
          || case when winners is not null
               then ' → ' || winners || ' (' || coalesce(d ->> 'winner_pct', '0') || case when en then '%)' else ' %)' end
               else case when en then ' → no votes' else ' → aucun vote' end end,
        '/?tab=feed', 'poll-' || coalesce(d ->> 'activity_id', ''));
    when 'super_filing' then
      perform verio_send_push(new.user_id,
        coalesce(nullif(d ->> 'name', ''), case when en then 'A Legend' else 'Une Légende' end)
          || case when en then ' published their moves 🏛️' else ' a publié ses mouvements 🏛️' end,
        case when en then coalesce(d ->> 'moves', '0') || ' change(s) in their portfolio this quarter.'
             else coalesce(d ->> 'moves', '0') || ' changement(s) dans son portefeuille ce trimestre.' end,
        '/?tab=feed', 'super-' || coalesce(d ->> 'investor_id', ''));
    else
      null; -- likes, badges, moments : pas de push, ils restent dans la cloche
  end case;
  return new;
end;
$$;

-- Messages privés → push à l'autre membre de la conversation
create or replace function public.verio_push_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender_name text;
  recipient uuid;
  recipient_en boolean;
begin
  select full_name into sender_name from profiles where id = new.sender_id;
  for recipient, recipient_en in
    select m.user_id, coalesce(p.lang = 'en', false)
    from conversation_members m left join profiles p on p.id = m.user_id
    where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
  loop
    perform verio_send_push(recipient,
      coalesce(sender_name, case when recipient_en then 'New message' else 'Nouveau message' end),
      case when btrim(coalesce(new.content, '')) <> '' then new.content
           when new.files is not null then case when recipient_en then '📎 File' else '📎 Fichier' end
           else '📷 Photo' end,
      '/?tab=messages', 'conv-' || new.conversation_id);
  end loop;
  return new;
end;
$$;

revoke execute on function public.verio_push_on_notification(), public.verio_push_on_message() from public, anon, authenticated;

notify pgrst, 'reload schema';
