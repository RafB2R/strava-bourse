-- Photos de profil : bucket public « avatars », une image par membre rangée
-- dans son dossier (<id du membre>/avatar). Chacun ne dépose, remplace et
-- supprime que la sienne. Les images sont recadrées et réduites dans le
-- navigateur ; le serveur refuse tout de même plus de 2 Mo ou un format non image.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars : déposer la sienne" on storage.objects;
create policy "avatars : déposer la sienne" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars : remplacer la sienne" on storage.objects;
create policy "avatars : remplacer la sienne" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars : supprimer la sienne" on storage.objects;
create policy "avatars : supprimer la sienne" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- L'envoi avec remplacement (upsert) lit l'objet existant : lecture de sa propre photo
drop policy if exists "avatars : lire la sienne" on storage.objects;
create policy "avatars : lire la sienne" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
