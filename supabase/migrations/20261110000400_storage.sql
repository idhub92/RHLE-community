-- =====================================================================
-- Storage: one PRIVATE bucket for approved resource files.
-- Nothing is publicly addressable. Visitors download through the app's
-- /download/[id] route, which checks (via RLS) that the resource is
-- published and distribution is allowed, then issues a 60-second signed
-- URL. Archiving a resource therefore cuts off access immediately.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resource-files', 'resource-files', false, 26214400, -- 25 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- content managers manage files; nobody else touches the bucket directly
create policy "resource files: managers read"
  on storage.objects for select to authenticated
  using (bucket_id = 'resource-files' and public.has_permission('content.manage'));

create policy "resource files: managers upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'resource-files' and public.has_permission('content.manage'));

create policy "resource files: managers update"
  on storage.objects for update to authenticated
  using (bucket_id = 'resource-files' and public.has_permission('content.manage'))
  with check (bucket_id = 'resource-files' and public.has_permission('content.manage'));

create policy "resource files: admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'resource-files' and public.has_permission('platform.admin'));
