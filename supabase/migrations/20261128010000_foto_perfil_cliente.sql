-- Cada pessoa pode enviar a própria foto de perfil na pasta com o seu id
create policy "usuario envia a propria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "usuario apaga a propria foto" on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
