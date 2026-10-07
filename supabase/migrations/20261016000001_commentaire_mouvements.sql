-- Commentaire de l'auteur sur ses mouvements, façon description d'une course Strava.
--
-- Les mouvements (nouvelle position, renforcement, allègement, vente,
-- dividende…) sont créés automatiquement et restent factuels. Leur auteur
-- peut ensuite, et lui seul, y ajouter un commentaire (« pourquoi ce
-- mouvement ? »), le modifier ou l'effacer. Les autres membres continuent de
-- liker et commenter en dessous.
-- Le texte factuel (data) n'est jamais modifiable : seuls note et note_tags le sont.

alter table public.activities add column if not exists note text;
alter table public.activities add column if not exists note_tags jsonb;

create or replace function public.set_activity_note(activity text, note_text text, tags jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  clean text := nullif(btrim(coalesce(note_text, '')), '');
begin
  if char_length(coalesce(clean, '')) > 1000 then
    raise exception 'Commentaire trop long (1 000 caractères maximum)';
  end if;
  update activities
     set note = clean,
         note_tags = case when clean is null then null else tags end
   where id::text = activity
     and user_id = auth.uid()
     and type in ('new_position', 'renforcement', 'allegement', 'vente', 'suppression_position',
                  'dividende', 'coupon', 'versement', 'retrait', 'rebalancement', 'new_broker');
  if not found then
    raise exception 'Mouvement introuvable ou non modifiable';
  end if;
end;
$$;

revoke execute on function public.set_activity_note(text, text, jsonb) from public, anon;
grant execute on function public.set_activity_note(text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
