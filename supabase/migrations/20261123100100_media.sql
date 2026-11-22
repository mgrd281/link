-- Pictures in Supabase Storage (v7): page pictures (public), briefing photos of a paid order and the
-- Premium story pictures (both private). Paths always start with the customer's account id:
--   media/<uid>/<yyyy>/<uuid>.<jpg|webp|png>
--   briefing/<uid>/<order-id>/<uuid>.<ext>
--   deliverables/<customer uid>/<order-id>/<uuid>.<ext>
-- Uploads come from the browser with the user's session, so the policies below are the only guard.
-- Files are only ever deleted through the Storage API (never by SQL): what SQL wants gone goes into
-- public.storage_purge, which /api/maintenance/storage-purge drains. Tests: supabase/tests/media.test.sql.

-- ── Buckets ─────────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 5242880, array['image/jpeg', 'image/webp', 'image/png']),
  ('briefing', 'briefing', false, 10485760, array['image/jpeg', 'image/webp', 'image/png', 'image/heic']),
  ('deliverables', 'deliverables', false, 10485760, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

-- ── Policies (storage.objects already has row-level security) ───────────────────────────────
-- Page pictures: an active account writes only into its own folder. Visitors read them through the
-- bucket's public URL, which needs no policy.
create policy "media insert own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active((select auth.uid()))
  );
create policy "media update own" on storage.objects
  for update to authenticated using (
    bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "media delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "media select own" on storage.objects
  for select to authenticated using (
    bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Briefing photos: the customer uploads them; the customer and the team members who build pages read them.
create policy "briefing insert own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'briefing'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active((select auth.uid()))
  );
create policy "briefing select own or team" on storage.objects
  for select to authenticated using (
    bucket_id = 'briefing'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_permission('pages.edit'))
  );
create policy "briefing delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'briefing' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Premium story pictures: the team uploads them into the customer's folder; the customer downloads them.
create policy "deliverables insert team" on storage.objects
  for insert to authenticated with check (bucket_id = 'deliverables' and public.has_permission('pages.edit'));
create policy "deliverables delete team" on storage.objects
  for delete to authenticated using (bucket_id = 'deliverables' and public.has_permission('pages.edit'));
create policy "deliverables select own or team" on storage.objects
  for select to authenticated using (
    bucket_id = 'deliverables'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.has_permission('pages.edit'))
  );

-- ── Files waiting to be deleted (service client only) ───────────────────────────────────────
create table public.storage_purge (
  id bigint generated always as identity primary key,
  bucket text not null constraint bucket_known check (bucket in ('media', 'briefing', 'deliverables')),
  -- A path inside the bucket: a folder ending in "/" or one object.
  prefix text not null constraint prefix_inside check (
    char_length(prefix) between 1 and 512 and prefix !~ '^/' and prefix !~ '(^|/)\.\.(/|$)'
  ),
  due_at timestamptz not null default now(),
  attempts smallint not null default 0,
  last_error text
);
create index storage_purge_due on public.storage_purge (due_at);
alter table public.storage_purge enable row level security;
-- No policies: only our server (service role) reads and writes it.
revoke all on public.storage_purge from authenticated, anon;
