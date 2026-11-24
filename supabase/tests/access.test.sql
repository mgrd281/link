-- Row-level security and the team functions, checked as each kind of caller: a customer, another
-- customer, a visitor (anon), our server (postgres/service role), a team owner and a viewer.
-- Run: pnpm db:test (supabase test db). Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- People: Ana and Ben are customers, Cara owns the team, Dan is a viewer.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@example.com', '{"username":"ana","locale":"de"}', '{}', now(), now(), now()),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@example.com', '{"username":"ben","locale":"en"}', '{}', now(), now(), now()),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cara@example.com', '{"username":"cara","locale":"ar"}', '{}', now(), now(), now()),
  ('d0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dan@example.com', '{}', '{}', now(), now(), now());

-- ── Sign-up ─────────────────────────────────────────────────────────────────────────────────
select is((select username::text from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), 'ana',
  'sign-up creates the profile with the chosen name');
select is((select locale from public.profiles where id = 'c0000000-0000-4000-8000-000000000003'), 'ar',
  'and the chosen language');
select matches((select username::text from public.profiles where id = 'd0000000-0000-4000-8000-000000000004'), '^user-[0-9a-f]{10}$',
  'an account made without a name gets a neutral one');
select throws_ok($$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('e0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@example.com', '{"username":"admin"}')
$$, 'P0001', 'linkyo:reservedUsername', 'reserved names fail the sign-up');
select throws_ok($$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('e0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@example.com', '{"username":"No Spaces"}')
$$, 'P0001', 'linkyo:invalidUsername', 'invalid names fail the sign-up');
select throws_ok($$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('e0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x@example.com', '{"username":"ANA"}')
$$, 'P0001', 'linkyo:usernameTaken', 'taken names fail the sign-up, whatever the case');

-- Pages (our server creates them right after sign-up).
insert into public.sites (profile_id, onboarded, theme, page) values
  ('a0000000-0000-4000-8000-000000000001', true, '{"template":"nocturne"}', '{"profile":{"displayName":"Ana","username":"someone-else","verified":true},"blocks":[{"id":"1"},{"id":"2"}]}'),
  ('b0000000-0000-4000-8000-000000000002', false, '{"template":"daylight"}', '{"profile":{"displayName":"Ben"},"blocks":[]}');
select is((select page #>> '{profile,verified}' from public.sites where profile_id = 'a0000000-0000-4000-8000-000000000001'), 'false',
  'nobody writes the verified badge into their own page');
select is((select page #>> '{profile,username}' from public.sites where profile_id = 'a0000000-0000-4000-8000-000000000001'), 'ana',
  'the page always shows the account''s real username');

-- ── A customer ──────────────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'a customer sees only their own profile');
select is((select count(*)::int from public.sites), 1, 'and only their own page');
update public.sites set page = jsonb_set(page, '{profile,displayName}', '"Ana V"') where profile_id = 'a0000000-0000-4000-8000-000000000001';
select is((select page #>> '{profile,displayName}' from public.sites), 'Ana V', 'owners edit their page');
select is_empty($$ update public.sites set kind = 'shop' where profile_id = 'b0000000-0000-4000-8000-000000000002' returning 1 $$,
  'nobody edits someone else''s page');
select throws_ok($$ update public.profiles set verified = true where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'customers cannot give themselves the badge');
select throws_ok($$ update public.profiles set status = 'active' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'or change their own status');
update public.profiles set locale = 'en' where id = 'a0000000-0000-4000-8000-000000000001';
select is((select locale from public.profiles), 'en', 'but they choose their language');
select throws_ok($$ insert into public.sign_ins (profile_id, result, ip, device_id) values ('a0000000-0000-4000-8000-000000000001', 'success', '192.0.2.1', 'x') $$,
  '42501', null, 'browsers cannot write the sign-in log');
select throws_ok($$ select public.record_sign_in('ana@example.com', 'success', '192.0.2.1', '{}', 'x') $$,
  '42501', null, 'nor call the server''s sign-in recorder');
select throws_ok($$ select public.admin_customers() $$, '42501', 'linkyo:forbidden', 'customers cannot open the console');
select throws_ok($$ select public.admin_set_status('b0000000-0000-4000-8000-000000000002', 'suspended') $$,
  '42501', 'linkyo:forbidden', 'or suspend anyone');
select throws_ok($$ select public.make_owner('ana@example.com') $$, '42501', null, 'nobody promotes themselves to owner');
select is_empty($$ select 1 from public.blocked_ips $$, 'customers see no blocked addresses');
select is_empty($$ select 1 from public.team_members $$, 'nor the team');
select is(public.change_username('admin'), 'reservedUsername', 'renaming checks reserved names');
select is(public.change_username('ben'), 'usernameTaken', 'and taken ones');
select is(public.change_username('ana-v'), 'ok', 'a free name works');
select is((select page #>> '{profile,username}' from public.sites), 'ana-v', 'and the page follows the new name');
reset role;

-- ── A visitor ───────────────────────────────────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.public_page('ana-v') #>> '{page,profile,displayName}', 'Ana V', 'visitors see finished pages');
select is(public.public_page('ben'), null, 'but not pages still in the welcome flow');
select is_empty($$ select 1 from public.profiles $$, 'visitors read no profiles directly');
select is_empty($$ select 1 from public.sites $$, 'nor pages');
select is(public.username_status('ana-v'), 'usernameTaken', 'sign-up can check a name');
select is(public.username_status('fresh-name'), 'ok', 'and see that a free one is free');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'visitors cannot delete accounts');
reset role;

-- ── Our server ──────────────────────────────────────────────────────────────────────────────
-- Sign-ups nobody confirmed: hidden from visitors, deleted after 7 days (the name is free again).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('f0000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@example.com', '{"username":"eve"}', now() - interval '8 days', now());
insert into public.sites (profile_id, onboarded, theme, page) values
  ('f0000000-0000-4000-8000-000000000006', true, '{}', '{"profile":{"displayName":"Eve"},"blocks":[]}');
select is(public.public_page('eve'), null, 'pages of unconfirmed sign-ups stay hidden');
select is(public.purge_unconfirmed_accounts(), 1, 'unconfirmed sign-ups are deleted after 7 days');
select is(public.username_status('eve'), 'ok', 'and their name is free again');

select public.record_sign_in('ana@example.com', 'failed', '198.51.100.7', '{"type":"desktop","os":"macOS","browser":"Safari"}', 'device-1', 'de', 'Berlin', 'sig');
select public.record_sign_in('ANA@example.com', 'success', '198.51.100.7', '{"type":"desktop","os":"macOS","browser":"Safari"}', 'device-1', 'de', 'Berlin', 'sig');
select public.record_sign_in('nobody@example.com', 'failed', '203.0.113.9', '{}', 'device-2');
select is((select count(*)::int from public.sign_ins where profile_id = 'a0000000-0000-4000-8000-000000000001'), 2, 'sign-ins are recorded');
select is((select count(*)::int from public.sign_ins where ip = '203.0.113.9'), 0, 'unknown emails leave nothing');
select is((select distinct country from public.sign_ins where profile_id = 'a0000000-0000-4000-8000-000000000001'), 'DE', 'country codes are stored in capitals');
select is(public.recent_failures('ana@example.com'), 1, 'recent failures are counted for slowing down guessing');
select isnt((select last_seen_at from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), null,
  'a successful sign-in updates "last seen"');
insert into public.sign_ins (profile_id, at, result, ip, device_id) values
  ('a0000000-0000-4000-8000-000000000001', now() - interval '31 days', 'success', '192.0.2.44', 'old');
select is(public.purge_old_sign_ins(), 1, 'sign-ins older than 30 days are deleted');
select isnt((select jobid from cron.job where jobname = 'linkyo-purge-sign-ins'), null, 'every night');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is_empty($$ select 1 from public.sign_ins $$, 'customers never see other people''s sign-ins');
reset role;

-- ── The team: an owner ──────────────────────────────────────────────────────────────────────
-- Only this test's team (a database in use may have its own; everything is rolled back).
delete from public.team_members;
select public.make_owner('cara@example.com');
insert into public.team_members (user_id, role) values ('d0000000-0000-4000-8000-000000000004', 'viewer');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(public.admin_me() ->> 'role', 'owner', 'the owner sees their role');
select is(jsonb_array_length(public.admin_me() -> 'permissions'), 18, 'owners have every permission');
select is((select count(*)::int from jsonb_array_elements(public.admin_customers()) c
  where c ->> 'email' in ('ana@example.com', 'ben@example.com', 'cara@example.com', 'dan@example.com')), 4,
  'the console lists every account');
select is((select c -> 'logins' -> 0 ->> 'ip' from jsonb_array_elements(public.admin_customers()) c where c ->> 'username' = 'ana-v'),
  '198.51.100.7', 'with the sign-in log, IP included');
select is((select (c -> 'usage' ->> 'blocks')::int from jsonb_array_elements(public.admin_customers()) c where c ->> 'username' = 'ana-v'),
  2, 'and how much of the page is built');
select public.admin_set_status('a0000000-0000-4000-8000-000000000001', 'suspended');
select is((select status::text from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), null,
  'the team does not read profiles directly');
select is((select c ->> 'status' from jsonb_array_elements(public.admin_customers()) c where c ->> 'username' = 'ana-v'),
  'suspended', 'suspending works');
select is((select action from public.audit_log order by id desc limit 1), 'customer.suspend', 'and is in the activity log');
select public.admin_set_verified('a0000000-0000-4000-8000-000000000001', true);
select is((select (c ->> 'verified') from jsonb_array_elements(public.admin_customers()) c where c ->> 'username' = 'ana-v'),
  'true', 'the team gives the badge');
select public.admin_set_subscription('b0000000-0000-4000-8000-000000000002', 'plan', 'pro', 'active', now(), null, null);
select is((select c -> 'subscription' ->> 'plan' from jsonb_array_elements(public.admin_customers()) c where c ->> 'username' = 'ben'),
  'pro', 'and changes plans');
select throws_ok($$ select public.admin_set_subscription('b0000000-0000-4000-8000-000000000002', 'gift', 'pro', 'active', now(), null, null) $$,
  'P0001', 'linkyo:invalidAction', 'only known billing actions');
select is(public.admin_add_note('b0000000-0000-4000-8000-000000000002', ' Called about the invoice ') ->> 'text',
  'Called about the invoice', 'notes are saved');
select public.admin_block_ip('203.0.113.9', 'password guessing');
select ok(exists (select 1 from jsonb_array_elements(public.admin_blocked_ips()) b where b ->> 'ip' = '203.0.113.9'), 'addresses can be blocked');
select throws_ok($$ select public.admin_delete_customer('c0000000-0000-4000-8000-000000000003') $$,
  'P0001', 'linkyo:notYourself', 'nobody deletes themselves');
select throws_ok($$ select public.admin_set_role('c0000000-0000-4000-8000-000000000003', 'admin') $$,
  'P0001', 'linkyo:lastOwner', 'the last owner stays an owner');
select is((select count(*)::int from jsonb_array_elements(public.admin_team()) m
  where m ->> 'email' in ('cara@example.com', 'dan@example.com')), 2, 'the owner sees the team');
reset role;

-- Signing one device out ends the session its sign-in opened, and only that one.
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('5e550000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', now(), now()),
  ('5e550000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', now(), now());
select public.record_sign_in('ana@example.com', 'success', '198.51.100.8', '{}', 'phone-1', 'DE', null, null, '5e550000-0000-4000-8000-000000000001');
select public.record_sign_in('ana@example.com', 'success', '198.51.100.9', '{}', 'laptop-1', 'DE', null, null, '5e550000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(public.admin_sign_out_device('a0000000-0000-4000-8000-000000000001', 'phone-1'), 1, 'the team signs one device out');
reset role;
select is((select array_agg(id::text) from auth.sessions where user_id = 'a0000000-0000-4000-8000-000000000001'),
  array['5e550000-0000-4000-8000-000000000002'], 'and the other device stays signed in');

-- The suspended customer can no longer edit.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is_empty($$ update public.sites set kind = 'shop' returning 1 $$, 'suspended accounts cannot edit their page');
select is(public.change_username('ana-x'), 'unavailable', 'or rename themselves');
reset role;

-- With the badge, the page shows it.
select is((select page #>> '{profile,verified}' from public.sites where profile_id = 'a0000000-0000-4000-8000-000000000001'), 'true',
  'the badge given by the team appears on the page');

-- ── The team: a viewer ──────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select lives_ok($$ select public.admin_customers() $$, 'viewers see customers');
select ok((select count(*) from public.blocked_ips where ip = '203.0.113.9') = 1, 'and blocked addresses');
select throws_ok($$ select public.admin_set_status('b0000000-0000-4000-8000-000000000002', 'suspended') $$,
  '42501', 'linkyo:forbidden', 'but cannot suspend');
select throws_ok($$ select public.admin_add_member('ben@example.com', 'admin') $$,
  '42501', 'linkyo:forbidden', 'or change the team');
select throws_ok($$ select public.admin_block_ip('192.0.2.200', 'x') $$, '42501', 'linkyo:forbidden', 'or block addresses');
reset role;

-- ── Deleting ────────────────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select public.admin_delete_customer('b0000000-0000-4000-8000-000000000002');
select is((select count(*)::int from jsonb_array_elements(public.admin_customers()) c where c ->> 'email' = 'ben@example.com'), 0,
  'the owner deletes a customer');
select is((select action from public.audit_log order by id desc limit 1), 'customer.delete', 'and the log keeps the entry');
reset role;
select is_empty($$ select 1 from public.sites where profile_id = 'b0000000-0000-4000-8000-000000000002' $$,
  'their page is gone with them');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select public.delete_my_account();
reset role;
select is_empty($$ select 1 from public.profiles where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'customers delete their own account');
select is_empty($$ select 1 from public.sign_ins where profile_id = 'a0000000-0000-4000-8000-000000000001' $$,
  'and their sign-in log goes with it');

-- ── The role table matches the app ──────────────────────────────────────────────────────────
select results_eq(
  $$ select role::text as name, count(*)::int from public.role_permissions group by role order by name $$,
  $$ values ('admin', 16), ('editor', 5), ('owner', 18), ('viewer', 6) $$,
  'roles have the same number of permissions as in the app'
);

select * from finish();
rollback;
