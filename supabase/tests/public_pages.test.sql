-- Public pages (v7): visitors get only the blocks that are on and inside their schedule, in order;
-- hidden pages stay hidden; every first-level route is a reserved name.
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Pia has a finished page; Quinn is still in the welcome flow; Rae never confirmed her e-mail; Sam is suspended.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pia@example.com', '{"username":"pia","locale":"de"}', '{}', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quinn@example.com', '{"username":"quinn","locale":"en"}', '{}', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rae@example.com', '{"username":"rae","locale":"ar"}', '{}', now(), now(), null),
  ('a1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam@example.com', '{"username":"sam","locale":"de"}', '{}', now(), now(), now());

insert into public.sites (profile_id, onboarded, theme, page) values
  ('a1000000-0000-4000-8000-000000000001', true, '{"template":"nocturne"}', jsonb_build_object(
    'profile', jsonb_build_object('displayName', 'Pia'),
    'blocks', jsonb_build_array(
      jsonb_build_object('id', 'hidden', 'type', 'link', 'visible', false),
      jsonb_build_object('id', 'plain-1', 'type', 'link'),
      jsonb_build_object('id', 'future', 'type', 'link', 'visible', true,
        'schedule', jsonb_build_object('from', now() + interval '1 day')),
      jsonb_build_object('id', 'active', 'type', 'link', 'visible', true,
        'schedule', jsonb_build_object('from', now() - interval '1 day', 'until', now() + interval '1 day')),
      jsonb_build_object('id', 'expired', 'type', 'link', 'visible', true,
        'schedule', jsonb_build_object('until', now() - interval '1 hour')),
      jsonb_build_object('id', 'broken-date', 'type', 'link', 'schedule', jsonb_build_object('from', 'not a date')),
      jsonb_build_object('id', 'broken-flag', 'type', 'link', 'visible', 'maybe'),
      jsonb_build_object('id', 'plain-2', 'type', 'newsletter', 'visible', true)
    ))),
  ('a1000000-0000-4000-8000-000000000002', false, '{}', '{"profile":{"displayName":"Quinn"},"blocks":[{"id":"1"}]}'),
  ('a1000000-0000-4000-8000-000000000003', true, '{}', '{"profile":{"displayName":"Rae"},"blocks":[{"id":"1"}]}'),
  ('a1000000-0000-4000-8000-000000000004', true, '{}', '{"profile":{"displayName":"Sam"},"blocks":[{"id":"1"}]}');
update public.profiles set status = 'suspended' where id = 'a1000000-0000-4000-8000-000000000004';

-- ── 1–2. Only public blocks, in their order; a broken schedule hides its block ──────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select lives_ok($$ select public.public_page('pia') $$, 'a block whose schedule is not a date does not break the page');
select is(
  (select array_agg(b ->> 'id' order by n)
   from jsonb_array_elements(public.public_page('pia') #> '{page,blocks}') with ordinality as e (b, n)),
  array['plain-1', 'active', 'plain-2'],
  'visitors get the plain blocks and the active scheduled one, in their order (newsletter blocks are the route''s job)');
select ok(not exists (
    select 1 from jsonb_array_elements(public.public_page('pia') #> '{page,blocks}') b
    where b ->> 'id' in ('hidden', 'future', 'expired')),
  'hidden, future and expired blocks never reach a visitor');
select ok(not exists (
    select 1 from jsonb_array_elements(public.public_page('pia') #> '{page,blocks}') b where b ->> 'id' = 'broken-date'),
  'a block with "from": "not a date" is left out');
select ok(not exists (
    select 1 from jsonb_array_elements(public.public_page('pia') #> '{page,blocks}') b where b ->> 'id' = 'broken-flag'),
  'and so is one whose "visible" is not a boolean');
select is(public.public_page('pia') #>> '{page,profile,displayName}', 'Pia', 'the rest of the page is unchanged');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.public_page('pia')) k),
  array['legal', 'page', 'theme', 'updatedAt'], 'the answer keeps its shape');
select throws_ok($$ select public.block_is_public('{}'::jsonb, now()) $$, '42501', null,
  'visitors cannot call the block filter directly');

-- ── 3. Pages that are not public stay hidden ────────────────────────────────────────────────
select is(public.public_page('quinn'), null, 'not onboarded → no page');
select is(public.public_page('rae'), null, 'unconfirmed e-mail → no page');
select is(public.public_page('sam'), null, 'suspended → no page');
select is(public.public_page('nobody-here'), null, 'unknown name → no page');

-- ── 4. Every first-level route is reserved ──────────────────────────────────────────────────
select is(public.username_status('templates'), 'reservedUsername', 'templates is reserved');
select is(public.username_status('checkout'), 'reservedUsername', 'checkout is reserved');
select is(public.username_status('kuendigen'), 'reservedUsername', 'kuendigen is reserved');
select is(public.username_status('widerruf'), 'reservedUsername', 'widerruf is reserved');
select is(public.username_status('service'), 'reservedUsername', 'service is reserved');
reset role;

select is((select count(*)::int from public.reserved_usernames), 56, 'the 33 first names and the 23 of v7 are reserved');

select * from finish();
rollback;
