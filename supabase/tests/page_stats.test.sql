-- Cookie-free page statistics (20261125100000_page_stats.sql): what is kept (no IP address, no
-- browser string), who may read it (owners their own, the team totals, visitors nothing), and how a
-- view or a tap is counted (public pages and blocks only, one visitor a day, capped, salts forgotten).
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- The console's totals by day have an index of their own (the primary key leads with the page).
select has_index('public', 'page_stats', 'page_stats_page_day', 'the console reads the page rows by day through an index');

-- Pia and Quinn have public pages; Rae is still in the welcome flow; Tess runs the team; Uli is a viewer.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) values
  ('a2000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pia@example.com', '{"username":"pia-stats","locale":"de"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quinn@example.com', '{"username":"quinn-stats","locale":"en"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rae@example.com', '{"username":"rae-stats","locale":"ar"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tess@example.com', '{"username":"tess-stats","locale":"de"}', '{}', now(), now(), now()),
  ('a2000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'uli@example.com', '{"username":"uli-stats","locale":"de"}', '{}', now(), now(), now());
insert into public.team_members (user_id, role) values
  ('a2000000-0000-4000-8000-000000000004', 'owner'),
  ('a2000000-0000-4000-8000-000000000005', 'viewer');

insert into public.sites (profile_id, onboarded, theme, page) values
  ('a2000000-0000-4000-8000-000000000001', true, '{"template":"nocturne"}', jsonb_build_object(
    'profile', jsonb_build_object('displayName', 'Pia'),
    'blocks', jsonb_build_array(
      jsonb_build_object('id', 'shop', 'type', 'link', 'visible', true),
      jsonb_build_object('id', 'secret', 'type', 'link', 'visible', false)
    ))),
  ('a2000000-0000-4000-8000-000000000002', true, '{}', '{"profile":{"displayName":"Quinn"},"blocks":[{"id":"tour","type":"link","visible":true}]}'),
  ('a2000000-0000-4000-8000-000000000003', false, '{}', '{"profile":{"displayName":"Rae"},"blocks":[{"id":"1","type":"link","visible":true}]}');

-- ── 1. No IP address, no browser string ─────────────────────────────────────────────────────
select is((
    select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name like 'page\_stats%'
      and (column_name ~* '(^|_)(ip|ips|address|addr|user_agent|useragent|ua|agent|browser|cookie|fingerprint)($|_)'
           or data_type in ('inet', 'cidr'))),
  0, 'no table of the statistics has a column for an IP address, a browser string or a cookie');
select columns_are('public', 'page_stats', array['profile_id', 'day', 'dimension', 'key', 'views', 'visitors', 'clicks'],
  'the counts hold a page, a day, a dimension and its key, and three numbers');
select columns_are('public', 'page_stats_visitors', array['day', 'profile_id', 'visitor', 'views', 'clicks'],
  'a visitor of the running day is a hash and two numbers');
select columns_are('public', 'page_stats_salts', array['day', 'salt'], 'the salt is kept apart from the counts');

-- ── 2. Counting (as our server) ─────────────────────────────────────────────────────────────
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(public.page_stats_record('pia-stats', 'view', repeat('a', 64), null, 'instagram', 'DE', 'mobile'), 'counted', 'a view of a public page counts');
select is(public.page_stats_record('Pia-Stats ', 'view', repeat('a', 64), null, 'instagram', 'DE', 'mobile'), 'counted', 'the same visitor again (the name in any case)');
select is(public.page_stats_record('pia-stats', 'view', repeat('b', 64), null, null, 'AT', 'desktop'), 'counted', 'a second visitor');
select is(public.page_stats_record('pia-stats', 'click', repeat('a', 64), 'shop'), 'counted', 'a tap on a visible block counts');
select is(public.page_stats_record('pia-stats', 'click', repeat('a', 64), 'secret'), 'unknownBlock', 'a hidden block is never counted');
select is(public.page_stats_record('pia-stats', 'click', repeat('a', 64), 'made-up'), 'unknownBlock', 'nor a block the page does not have');
select is(public.page_stats_record('pia-stats', 'click', repeat('a', 64)), 'unknownBlock', 'a tap names its block');
select is(public.page_stats_record('rae-stats', 'view', repeat('a', 64)), 'unknown', 'a page still in the welcome flow is never counted');
select is(public.page_stats_record('nobody-here', 'view', repeat('a', 64)), 'unknown', 'nor a name without a page');
select is(public.page_stats_record('pia-stats', 'view', '1.2.3.4'), 'invalid', 'anything but a 64-character hash is refused (an address never gets in)');
select is(public.page_stats_record('pia-stats', 'scroll', repeat('a', 64)), 'invalid', 'only views and taps are counted');
select is(public.page_stats_record('quinn-stats', 'view', repeat('c', 64), null, 'somewhere-else', 'germany', 'fridge'), 'counted',
  'unknown keys do not stop a view');
reset role;

select results_eq($$ select views, visitors, clicks from public.page_stats
                     where profile_id = 'a2000000-0000-4000-8000-000000000001' and dimension = 'page' $$,
  $$ values (3, 2, 1) $$, 'three views by two visitors and one tap');
select results_eq($$ select key, clicks from public.page_stats
                     where profile_id = 'a2000000-0000-4000-8000-000000000001' and dimension = 'block' $$,
  $$ values ('shop'::text, 1) $$, 'the tap is counted on its block');
select results_eq($$ select dimension, key, views from public.page_stats
                     where profile_id = 'a2000000-0000-4000-8000-000000000001' and dimension in ('referrer', 'country', 'device')
                     order by dimension, key $$,
  $$ values ('country'::text, 'AT'::text, 1), ('country', 'DE', 2), ('device', 'desktop', 1), ('device', 'mobile', 2), ('referrer', 'instagram', 2) $$,
  'views by country, device and referrer group (a view without a referrer adds none)');
select results_eq($$ select dimension, key from public.page_stats
                     where profile_id = 'a2000000-0000-4000-8000-000000000002' order by dimension, key $$,
  $$ values ('page'::text, ''::text), ('referrer', 'other') $$,
  'an unknown referrer becomes "other"; a country or device outside its list is not stored');

-- A visitor who reloads all day counts 30 times, then no more; the page's visitors stay one.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((select count(*)::int from generate_series(1, 31) n
           where public.page_stats_record('quinn-stats', 'view', repeat('d', 64)) = 'counted'), 30,
  'at most 30 views a day per visitor and page');
select is(public.page_stats_record('quinn-stats', 'view', repeat('d', 64)), 'capped', 'the next one is capped');
reset role;
select results_eq($$ select views, visitors from public.page_stats
                     where profile_id = 'a2000000-0000-4000-8000-000000000002' and dimension = 'page' $$,
  $$ values (31, 2) $$, 'Quinn: 31 views by two visitors');

-- ── 3. Owners read their own numbers, nobody else's ─────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(distinct profile_id)::int from public.page_stats), 1, 'an owner sees only the rows of their own page');
select is((select bool_and(profile_id = 'a2000000-0000-4000-8000-000000000001') from public.page_stats), true, 'and they are theirs');
select is((public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 29, (now() at time zone 'Europe/Berlin')::date) #>> '{days,0,views}')::int, 3, 'my_page_stats: the day''s views');
select is((public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 29, (now() at time zone 'Europe/Berlin')::date) #>> '{days,0,visitors}')::int, 2, 'its visitors');
select is(public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 29, (now() at time zone 'Europe/Berlin')::date) -> 'blocks', '[{"key":"shop","clicks":1}]'::jsonb, 'taps per block');
select is((public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 29, (now() at time zone 'Europe/Berlin')::date) ->> 'since')::date, (now() at time zone 'Europe/Berlin')::date, 'counting began today');
select is(public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 29, (now() at time zone 'Europe/Berlin')::date) -> 'previous', '{"views":0,"visitors":0,"clicks":0}'::jsonb,
  'the period before holds nothing');
select is(jsonb_array_length(public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 59, (now() at time zone 'Europe/Berlin')::date - 30) -> 'days'), 0,
  'a range without counts has no days');
select throws_ok($$ select public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 400, (now() at time zone 'Europe/Berlin')::date) $$, '22023', 'linkyo:invalid',
  'at most a year at a time');
select throws_ok($$ update public.page_stats set views = 999 $$, '42501', null, 'owners cannot change their numbers');
select throws_ok($$ insert into public.page_stats (profile_id, day, dimension, views) values ('a2000000-0000-4000-8000-000000000001', current_date, 'page', 5) $$,
  '42501', null, 'or add to them');
select throws_ok($$ select * from public.page_stats_visitors $$, '42501', null, 'visitor hashes are out of reach');
select throws_ok($$ select * from public.page_stats_salts $$, '42501', null, 'and so is the salt');
select throws_ok($$ select public.page_stats_salt() $$, '42501', null, 'which only our server may ask for');
select throws_ok($$ select public.page_stats_record('pia-stats', 'view', repeat('e', 64)) $$, '42501', null,
  'nobody signed in counts a visit directly');
select throws_ok($$ select public.admin_page_stats(30) $$, '42501', 'linkyo:forbidden', 'a customer gets no team totals');

select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 6, (now() at time zone 'Europe/Berlin')::date) #>> '{days,0,views}')::int, 31, 'Quinn reads Quinn''s numbers');
select is(public.my_page_stats((now() at time zone 'Europe/Berlin')::date - 6, (now() at time zone 'Europe/Berlin')::date) -> 'blocks', '[]'::jsonb, 'and none of Pia''s taps');
reset role;

-- ── 4. Visitors (anon) read and write nothing ───────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.page_stats $$, '42501', null, 'visitors cannot read any numbers');
select throws_ok($$ select public.my_page_stats(current_date, current_date) $$, '42501', null, 'not even through the owner''s function');
select throws_ok($$ select public.page_stats_record('pia-stats', 'view', repeat('f', 64)) $$, '42501', null,
  'and cannot count a visit around our server');
select throws_ok($$ select public.admin_page_stats(30) $$, '42501', null, 'or read the team''s totals');
reset role;

-- ── 5. The team reads totals with analytics.view ────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((public.admin_page_stats(30) #>> '{days,0,views}')::int, 34, 'a viewer reads all pages'' views of the day (3 + 31)');
select is((public.admin_page_stats(30) #>> '{days,0,visitors}')::int, 4, 'their visitors');
select is((
    select (p ->> 'views')::int from jsonb_array_elements(public.admin_page_stats(30) -> 'pages') p
    where p ->> 'id' = 'a2000000-0000-4000-8000-000000000001'),
  3, 'and the views per page, for views30 in the console');
select is((
    select array_agg(k order by k) from jsonb_object_keys(public.admin_page_stats(30)) k),
  array['days', 'from', 'pages', 'since', 'to'], 'totals only: no referrers, countries, devices or hashes');
select throws_ok($$ select public.admin_page_stats(0) $$, '22023', 'linkyo:invalid', 'a range of at least one day');
reset role;

-- ── 6. Salts rotate and are forgotten with the visitor hashes ───────────────────────────────
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select matches(public.page_stats_salt() ->> 'salt', '^[0-9a-f]{64}$', 'today''s salt: 32 random bytes');
select is(public.page_stats_salt() ->> 'salt', public.page_stats_salt() ->> 'salt', 'the same all day');
reset role;
-- Yesterday, as it was: its own salt and a visitor hash.
insert into public.page_stats_salts (day, salt) values ((now() at time zone 'Europe/Berlin')::date - 1, repeat('0', 64));
insert into public.page_stats_visitors (day, profile_id, visitor, views) values ((now() at time zone 'Europe/Berlin')::date - 1, 'a2000000-0000-4000-8000-000000000001', repeat('9', 64), 1);
insert into public.page_stats (profile_id, day, dimension, key, views, visitors) values ('a2000000-0000-4000-8000-000000000001', (now() at time zone 'Europe/Berlin')::date - 1, 'page', '', 1, 1);
select isnt((select salt from public.page_stats_salts where day = (now() at time zone 'Europe/Berlin')::date), repeat('0', 64), 'each day has a salt of its own');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.page_stats_purge(), 1, 'the hourly purge forgets yesterday''s visitor hashes');
reset role;
select is((select count(*)::int from public.page_stats_salts where day < (now() at time zone 'Europe/Berlin')::date), 0, 'and yesterday''s salt');
select is((select count(*)::int from public.page_stats_visitors where day = (now() at time zone 'Europe/Berlin')::date), 4, 'today''s hashes stay until the day is over');
select is((select views from public.page_stats where profile_id = 'a2000000-0000-4000-8000-000000000001' and day = (now() at time zone 'Europe/Berlin')::date - 1 and dimension = 'page'), 1,
  'the counts stay');
select is((select count(*)::int from cron.job where jobname = 'linkyo-purge-page-stats' and schedule = '5 * * * *'), 1, 'the purge runs every hour');

-- ── 7. Deleting an account deletes its numbers ──────────────────────────────────────────────
delete from auth.users where id = 'a2000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.page_stats where profile_id = 'a2000000-0000-4000-8000-000000000002'), 0, 'a deleted account leaves no numbers');
select is((select count(*)::int from public.page_stats_visitors where profile_id = 'a2000000-0000-4000-8000-000000000002'), 0, 'and no hashes');

select * from finish();
rollback;
