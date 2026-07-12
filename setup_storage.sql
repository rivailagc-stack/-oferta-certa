-- Execute uma vez no SQL Editor do Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products',
  'products',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Imagens públicas para leitura" on storage.objects;
create policy "Imagens públicas para leitura"
on storage.objects for select to public
using (bucket_id = 'products');

drop policy if exists "Permitir upload público temporário" on storage.objects;
create policy "Permitir upload público temporário"
on storage.objects for insert to anon
with check (bucket_id = 'products');

drop policy if exists "Permitir atualizar imagem temporariamente" on storage.objects;
create policy "Permitir atualizar imagem temporariamente"
on storage.objects for update to anon
using (bucket_id = 'products')
with check (bucket_id = 'products');

drop policy if exists "Permitir excluir imagem temporariamente" on storage.objects;
create policy "Permitir excluir imagem temporariamente"
on storage.objects for delete to anon
using (bucket_id = 'products');
