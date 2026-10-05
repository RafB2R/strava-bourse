-- Images dans les posts du fil.
--
-- Les fichiers vont dans le bucket « post-media », rangés par membre :
-- <id du membre>/<uuid>.webp. Chacun ne dépose et ne supprime que dans son
-- propre dossier. Le bucket est public en lecture (comme les posts, visibles
-- dans le fil « Verio ») : les adresses sont des identifiants aléatoires,
-- impossibles à deviner, et le listing du bucket reste interdit.
-- Les images sont compressées dans le navigateur avant l'envoi ; le serveur
-- refuse tout de même les fichiers de plus de 5 Mo et les formats non image.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post-media : déposer dans son dossier" on storage.objects;
create policy "post-media : déposer dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post-media : supprimer ses fichiers" on storage.objects;
create policy "post-media : supprimer ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
