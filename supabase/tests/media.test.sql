-- Storage (v7): the three buckets and who may write and read what, checked as each kind of caller.
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Ana and Ben are customers, Cara builds pages for the team (editor), Dan is a viewer, Eva is suspended.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) values
  ('a2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@example.com', '{"username":"ana"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@example.com', '{"username":"ben"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cara@example.com', '{"username":"cara"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dan@example.com', '{"username":"dan"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eva@example.com', '{"username":"eva"}', '{}', now(), now(), now());
update public.profiles set status = 'suspended' where id = 'a2000000-0000-4000-8000-000000000005';
delete from public.team_members;
insert into public.team_members (user_id, role) values
  ('a2000000-0000-4000-8000-000000000003', 'editor'),
  ('a2000000-0000-4000-8000-000000000004', 'viewer');

-- Ana has a Premium order whose proposal (a draft at first) lists one story picture; Ben's order is refunded.
insert into public.orders (id, profile_id, customer_email, package, status, locale, amount_cents, vat_mode, early_start,
    start_after, promised_due_at, revisions_allowed, stripe_session_id) values
  ('0b000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'ana@example.com', 'premium', 'in_progress',
    'de', 7999, 'standard19', true, now(), now(), 3, 'cs_media_ana'),
  ('0b000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002', 'ben@example.com', 'start', 'refunded',
    'de', 2499, 'standard19', true, now(), now(), 1, 'cs_media_ben');
insert into public.site_proposals (order_id, profile_id, round, status, page, theme, story_paths) values
  ('0b000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 0, 'draft', '{"profile":{},"blocks":[]}', '{}',
    array['a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/s1.png']);

-- ── 1. Buckets ──────────────────────────────────────────────────────────────────────────────
select results_eq(
  $$ select id, public, file_size_limit::bigint, allowed_mime_types from storage.buckets
     where id in ('media', 'briefing', 'deliverables') order by id $$,
  $$ values
     ('briefing'::text, false, 10485760::bigint, array['image/jpeg', 'image/webp', 'image/png', 'image/heic']),
     ('deliverables', false, 10485760, array['image/jpeg', 'image/webp', 'image/png']),
     ('media', true, 5242880, array['image/jpeg', 'image/webp', 'image/png']) $$,
  'media is public (5 MB, 3 picture types); briefing and deliverables are private (10 MB)');

-- ── 2. Page pictures go only into your own folder ───────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000001/2026/a.jpg') $$,
  'Ana uploads a picture into her own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000002/2026/b.jpg') $$,
  '42501', null, 'but not into Ben''s');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a.jpg') $$,
  '42501', null, 'nor outside any folder');
select is((select count(*)::int from storage.objects where bucket_id = 'media'), 1, 'she sees her own picture');
reset role;

-- ── 3. A suspended account uploads nothing ──────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000005/2026/e.jpg') $$,
  '42501', null, 'a suspended account cannot upload, even into its own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('briefing', 'a2000000-0000-4000-8000-000000000005/x/e.jpg') $$,
  '42501', null, 'not even briefing photos');
reset role;

-- ── 4. Deleting (the Storage API sets storage.allow_delete_query; SQL never deletes files) ──
set local role authenticated;
select set_config('storage.allow_delete_query', 'true', true);
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is_empty($$ delete from storage.objects where bucket_id = 'media' and name like 'a2000000-0000-4000-8000-000000000001/%' returning 1 $$,
  'Ben cannot delete Ana''s picture');
select is_empty($$ select 1 from storage.objects where bucket_id = 'media' $$, 'nor see it through the table');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select isnt_empty($$ delete from storage.objects where bucket_id = 'media' and name = 'a2000000-0000-4000-8000-000000000001/2026/a.jpg' returning 1 $$,
  'Ana deletes her own');
select set_config('storage.allow_delete_query', 'false', true);
reset role;

-- ── 5. Briefing photos: the customer and the page builders ──────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('briefing', 'a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/p.jpg') $$,
  'Ana uploads a briefing photo for her order');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('briefing', 'a2000000-0000-4000-8000-000000000002/0b000000-0000-4000-8000-000000000001/p.jpg') $$,
  '42501', null, 'but not into someone else''s folder');
select is((select count(*)::int from storage.objects where bucket_id = 'briefing'), 1, 'Ana reads her briefing photo');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'briefing'), 0, 'Ben reads none');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'briefing'), 1, 'a team member who builds pages reads Ana''s');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'briefing'), 0, 'a viewer does not');
reset role;

-- ── 6. Story pictures: the team writes into the customer's folder, the customer downloads ───
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('deliverables', 'a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/s1.png') $$,
  'an editor uploads a story picture under <ana>/<order>/');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('deliverables', 'a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/wrong.png') $$,
  'and one by mistake, which is then taken out of the proposal');
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 2, 'the team sees both');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 0,
  'Ana reads neither while the proposal is a draft');
reset role;
update public.site_proposals set status = 'delivered', delivered_at = now() where order_id = '0b000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select array_agg(name) from storage.objects where bucket_id = 'deliverables'),
  array['a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/s1.png'],
  'once it is handed over she reads the picture it lists, and not the one that was taken out');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('deliverables', 'a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/s2.png') $$,
  '42501', null, 'Ana cannot upload story pictures herself');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'deliverables'), 0, 'Ben reads none');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('deliverables', 'a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/s3.png') $$,
  '42501', null, 'a viewer cannot upload them');
reset role;

-- ── 8. A proposal's page pictures belong to the customer ────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000001/2026/team.jpg') $$,
  'an editor puts a picture for Ana''s proposal into Ana''s media folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000002/2026/team.jpg') $$,
  '42501', null, 'but not into the folder of a customer without an open order');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000004/2026/team.jpg') $$,
  '42501', null, 'nor into a colleague''s');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000001/2026/viewer.jpg') $$,
  '42501', null, 'a viewer cannot upload for a customer');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media', 'a2000000-0000-4000-8000-000000000001/2026/ben.jpg') $$,
  '42501', null, 'and another customer never could');
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'media' and name like '%/team.jpg'), 1,
  'the picture is Ana''s: she sees it in her folder (and it is purged with her account)');
reset role;

-- ── 7. The purge queue is the server's ──────────────────────────────────────────────────────
insert into public.storage_purge (bucket, prefix) values ('briefing', 'a2000000-0000-4000-8000-000000000001/0b000000-0000-4000-8000-000000000001/');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select 1 from public.storage_purge $$, '42501', null, 'customers cannot read the purge queue');
select throws_ok($$ insert into public.storage_purge (bucket, prefix) values ('media', 'x/') $$, '42501', null,
  'or add to it');
reset role;
set local role anon;
select throws_ok($$ select 1 from public.storage_purge $$, '42501', null, 'visitors neither');
reset role;
select throws_ok($$ insert into public.storage_purge (bucket, prefix) values ('media', '../other/') $$, '23514', null,
  'a path never leaves its bucket folder');

select * from finish();
rollback;
