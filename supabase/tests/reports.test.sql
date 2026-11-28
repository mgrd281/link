-- Notice and action (20261128100000_reports.sql): who may file and read reports, the decisions and
-- their statement of reasons, what visitors see afterwards, the yearly count and the purge.
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Mona and Nils publish pages; Olga owns the team, Pete is an admin, Rita an editor, Sven a viewer.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) values
  ('a3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mona@example.com', '{"username":"mona-report","locale":"en"}', '{}', now(), now(), now()),
  ('a3000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nils@example.com', '{"username":"nils-report","locale":"de"}', '{}', now(), now(), now()),
  ('a3000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olga@example.com', '{"username":"olga-team","locale":"de"}', '{}', now(), now(), now()),
  ('a3000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pete@example.com', '{"username":"pete-team","locale":"de"}', '{}', now(), now(), now()),
  ('a3000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rita@example.com', '{"username":"rita-team","locale":"de"}', '{}', now(), now(), now()),
  ('a3000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sven@example.com', '{"username":"sven-team","locale":"de"}', '{}', now(), now(), now());
insert into public.team_members (user_id, role) values
  ('a3000000-0000-4000-8000-000000000003', 'owner'),
  ('a3000000-0000-4000-8000-000000000004', 'admin'),
  ('a3000000-0000-4000-8000-000000000005', 'editor'),
  ('a3000000-0000-4000-8000-000000000006', 'viewer');
insert into public.sites (profile_id, onboarded, theme, page) values
  ('a3000000-0000-4000-8000-000000000001', true, '{}', jsonb_build_object(
    'profile', jsonb_build_object('displayName', 'Mona'),
    'blocks', jsonb_build_array(
      jsonb_build_object('id', 'shop', 'type', 'link', 'title', 'My shop', 'url', 'https://example.com'),
      jsonb_build_object('id', 'note', 'type', 'text', 'text', 'A long text that names somebody else'),
      jsonb_build_object('id', 'gone', 'type', 'link', 'title', 'Old', 'visible', false)
    ))),
  ('a3000000-0000-4000-8000-000000000002', true, '{}', '{"profile":{"displayName":"Nils"},"blocks":[{"id":"tour","type":"link","title":"Tour"}]}');

-- ── 1. Tables: functions only, row-level security on ────────────────────────────────────────
select ok((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), 'reports have row-level security');
select ok((select relrowsecurity from pg_class where oid = 'public.moderation_decisions'::regclass), 'decisions have row-level security');
select ok(not has_table_privilege('anon', 'public.reports', 'insert'), 'visitors cannot insert reports directly');
select ok(not has_table_privilege('anon', 'public.reports', 'select'), 'or read them');
select ok(not has_table_privilege('authenticated', 'public.reports', 'insert'), 'accounts cannot insert reports directly');
select ok(not has_table_privilege('authenticated', 'public.moderation_decisions', 'insert'), 'or write decisions');
select ok(not has_function_privilege('anon', 'public.submit_report(text, text, text, boolean, text, text, text, text)', 'execute'),
  'the publishable key cannot file a report around the server''s limit');
select ok(not has_function_privilege('authenticated', 'public.submit_report(text, text, text, boolean, text, text, text, text)', 'execute'),
  'nor can a signed-in account');
select ok(has_function_privilege('service_role', 'public.submit_report(text, text, text, boolean, text, text, text, text)', 'execute'),
  'only the server files reports');
select ok(not has_function_privilege('anon', 'public.moderation_digest()', 'execute'), 'the digest is the server''s');
select ok(not has_function_privilege('authenticated', 'public.moderation_purge()', 'execute'), 'and so is the purge');
select ok(has_function_privilege('anon', 'public.reports_accepting()', 'execute'), 'the form may ask whether reports are taken');
select results_eq(
  $$ select role::text from public.role_permissions where permission = 'reports.manage' order by role $$,
  $$ values ('admin'), ('owner') $$, 'owners and admins handle reports (types.ts)');

set local role anon;
select throws_ok($$ insert into public.reports (page, category, explanation, good_faith) values ('mona-report', 'other', 'Twenty characters at least.', true) $$,
  '42501', null, 'as a visitor, an insert into the table fails');
select throws_ok($$ select public.submit_report('mona-report', 'other', 'Twenty characters at least.', true) $$,
  '42501', null, 'and so does the function');
select is(public.reports_accepting(), true, 'but the form learns that reports are taken');
reset role;

-- ── 2. Filing (as the server) ───────────────────────────────────────────────────────────────
set local role service_role;
select set_config('test.report1', (public.submit_report(
  'Mona-Report', 'privacy', '  The text block shows my home address without my consent.  ', true,
  'https://linkyo.example/mona-report', 'Kai Example', 'Kai@Example.com', 'de') ->> 'id'), true);
select set_config('test.report2', (public.submit_report(
  'nils-report', 'fraud', 'The tour link sells tickets that do not exist.', true, null, 'Lia Example', 'lia@example.com', 'en') ->> 'id'), true);
select set_config('test.report3', (public.submit_report(
  'nobody-here', 'minors', 'An anonymous report about a page that is not there.', true) ->> 'id'), true);
select set_config('test.report4', (public.submit_report(
  'mona-report', 'other', 'A second report that the team will dismiss.', true, null, 'Max Example', 'max@example.com', 'ar') ->> 'id'), true);
select is((public.submit_report('mona-report', 'privacy', 'The same reporter files the same thing again today.', true, null, 'Kai Example', 'kai@example.com') ->> 'id'),
  current_setting('test.report1'), 'the same address, page and reason within a day gets the open report back');
select is((public.submit_report('mona-report', 'privacy', 'The same reporter files the same thing again today.', true, null, 'Kai Example', 'kai@example.com') ->> 'duplicate'),
  'true', 'marked as a duplicate');
select throws_ok($$ select public.submit_report('../admin', 'other', 'Twenty characters at least.', true, null, 'Kai', 'kai@example.com') $$,
  'P0001', 'linkyo:invalid', 'a page that is not an address is refused');
select throws_ok($$ select public.submit_report('mona-report', 'spam', 'Twenty characters at least.', true, null, 'Kai', 'kai@example.com') $$,
  'P0001', 'linkyo:invalid', 'an unknown category is refused');
select throws_ok($$ select public.submit_report('mona-report', 'other', 'Too short.', true, null, 'Kai', 'kai@example.com') $$,
  'P0001', 'linkyo:invalid', 'an explanation under 20 characters is refused');
select throws_ok($$ select public.submit_report('mona-report', 'other', 'Twenty characters at least.', true) $$,
  'P0001', 'linkyo:invalid', 'name and e-mail are required (Art. 16(2)(c))');
select throws_ok($$ select public.submit_report('mona-report', 'other', 'Twenty characters at least.', true, null, 'Kai', 'not-an-address') $$,
  'P0001', 'linkyo:invalid', 'an e-mail address must be one');
select throws_ok($$ select public.submit_report('mona-report', 'other', 'Twenty characters at least.', false, null, 'Kai', 'kai@example.com') $$,
  'P0001', 'linkyo:invalid', 'the good-faith statement is required');
select throws_ok($$ select public.submit_report('mona-report', 'other', 'Twenty characters at least.', true, 'javascript:alert(1)', 'Kai', 'kai@example.com') $$,
  'P0001', 'linkyo:invalid', 'a link must be a web address');
reset role;
-- One transaction has one now(): spread the arrivals so "oldest first" has an order.
update public.reports set received_at = now() - interval '4 hours' where id = current_setting('test.report1')::uuid;
update public.reports set received_at = now() - interval '3 hours' where id = current_setting('test.report2')::uuid;
update public.reports set received_at = now() - interval '2 hours' where id = current_setting('test.report3')::uuid;
update public.reports set received_at = now() - interval '1 hour' where id = current_setting('test.report4')::uuid;
select is((select count(*)::int from public.reports), 4, 'four reports are stored');
select is((select profile_id::text from public.reports where id = current_setting('test.report1')::uuid), 'a3000000-0000-4000-8000-000000000001',
  'a report names the account of the page');
select is((select page || ' ' || reporter_email || ' ' || explanation from public.reports where id = current_setting('test.report1')::uuid),
  'mona-report kai@example.com The text block shows my home address without my consent.', 'trimmed and in lower case where it is an address');
select is((select profile_id from public.reports where id = current_setting('test.report3')::uuid), null, 'a page that is not there has no account');

-- ── 3. Who reads them ───────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::int from public.reports), 0, 'a creator does not see reports, not even about their page');
select throws_ok($$ select public.admin_reports() $$, '42501', 'linkyo:forbidden', 'nor the queue');
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select count(*)::int from public.reports), 0, 'an editor sees no report');
select throws_ok($$ select public.admin_reports() $$, '42501', 'linkyo:forbidden', 'an editor cannot read the queue');
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000001', 'unpublish', 'Ten chars or more.', 'terms') $$,
  '42501', 'linkyo:forbidden', 'or decide');
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is((select count(*)::int from public.reports), 0, 'a viewer sees no report either');
select throws_ok($$ select public.admin_reports() $$, '42501', 'linkyo:forbidden', 'a viewer cannot read the queue');
select throws_ok($$ select public.admin_moderation_counts() $$, '42501', 'linkyo:forbidden', 'or the yearly count');

select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.reports), 4, 'the owner reads the reports');
select is(jsonb_array_length(public.admin_reports()), 4, 'the queue holds the four open reports');
select is(public.admin_reports() -> 0 ->> 'id', current_setting('test.report1'), 'oldest first');
select is(public.admin_reports() -> 0 -> 'account' ->> 'username', 'mona-report', 'with the account as it is now');
select is(public.admin_reports() -> 2 -> 'account', 'null'::jsonb, 'none for a page that is not there');
select is(jsonb_array_length(public.admin_moderation_target('a3000000-0000-4000-8000-000000000001') -> 'blocks'), 3, 'the target lists every stored block');
select is(public.admin_moderation_target('a3000000-0000-4000-8000-000000000001') -> 'blocks' -> 1 ->> 'label', 'A long text that names somebody else',
  'named by its title or its text');
select is((public.admin_moderation_target('a3000000-0000-4000-8000-000000000001') -> 'blocks' -> 2 ->> 'visible')::boolean, false,
  'with the owner''s own switch');

-- ── 4. Deciding ─────────────────────────────────────────────────────────────────────────────
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000001', 'hide_block', 'short', 'illegal', 'note') $$,
  'P0001', 'linkyo:reasonRequired', 'a decision needs a reason the creator can read');
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000001', 'hide_block', 'The block shows a private address.', null, 'note') $$,
  'P0001', 'linkyo:groundRequired', 'and a ground');
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000001', 'hide_block', 'The block shows a private address.', 'illegal', 'nope') $$,
  'P0001', 'linkyo:blockNotFound', 'a block that is not on the page cannot be hidden');
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000002', 'hide_block', 'The block shows a private address.', 'illegal', 'tour', current_setting('test.report1')::uuid) $$,
  'P0001', 'linkyo:mismatch', 'a report decides only about its own page');
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000003', 'unpublish', 'Testing on myself here.', 'terms') $$,
  'P0001', 'linkyo:notYourself', 'the team never restricts its own account');
select throws_ok($$ select public.admin_moderate(null, 'dismiss', 'Nothing illegal on the page.') $$,
  'P0001', 'linkyo:reportRequired', 'a dismissal belongs to a report');

select is(public.public_page('mona-report') -> 'page' -> 'blocks' -> 1 ->> 'id', 'note', 'before: visitors see the text block');
select set_config('test.hide', (public.admin_moderate('a3000000-0000-4000-8000-000000000001', 'hide_block',
  'The block shows a private home address without consent.', 'illegal', 'note', current_setting('test.report1')::uuid) ->> 'decision'), true);
select is((select action || ' ' || ground || ' ' || block_label from public.moderation_decisions where id = current_setting('test.hide')::uuid),
  'hide_block illegal A long text that names somebody else', 'the decision is recorded with its ground and the block');
select is((select status from public.reports where id = current_setting('test.report1')::uuid), 'decided', 'the report is decided');
select is((select action from public.audit_log order by id desc limit 1), 'moderation.hide', 'the activity log has it');
select is((select details ->> 'decision' from public.audit_log order by id desc limit 1), current_setting('test.hide'), 'pointing at the decision');
select ok((select (details::text not like '%home address%') from public.audit_log order by id desc limit 1),
  'but not the reason (editors and viewers read the log)');
select is((select jsonb_agg(b ->> 'id') from jsonb_array_elements(public.public_page('mona-report') -> 'page' -> 'blocks') b),
  '["shop"]'::jsonb, 'visitors no longer get the hidden block (nor the switched-off one)');
select ok((public.admin_moderation_target('a3000000-0000-4000-8000-000000000001') -> 'blocks' -> 1 ->> 'hidden')::boolean, 'the target shows it hidden');
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000001', 'hide_block', 'Hiding the very same block twice.', 'illegal', 'note') $$,
  'P0001', 'linkyo:alreadyDone', 'a block is hidden once');
select throws_ok($$ select public.admin_moderate('a3000000-0000-4000-8000-000000000001', 'hide_block', 'Deciding the same report twice.', 'illegal', 'shop', current_setting('test.report1')::uuid) $$,
  'P0001', 'linkyo:alreadyDecided', 'and a report is decided once');
reset role;
update public.reports set decided_at = now() - interval '30 minutes' where id = current_setting('test.report1')::uuid;
select is((select page -> 'blocks' -> 1 ->> 'id' from public.sites where profile_id = 'a3000000-0000-4000-8000-000000000001'), 'note',
  'the creator''s page itself is unchanged (only visitors miss the block)');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.my_moderation() -> 0 ->> 'reason', 'The block shows a private home address without consent.', 'the creator reads the reason');
select is(public.my_moderation() -> 0 ->> 'blockId', 'note', 'and which block');

-- The admin takes Nils's page offline, then lifts it again.
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select set_config('test.offline', (public.admin_moderate('a3000000-0000-4000-8000-000000000002', 'unpublish',
  'The page sells tickets to an event that does not exist.', 'terms', null, current_setting('test.report2')::uuid) ->> 'decision'), true);
select is(public.public_page('nils-report'), null, 'a page taken offline is not found');
select is((select action from public.audit_log order by id desc limit 1), 'moderation.unpublish', 'logged');
select ok((public.admin_reports('decided') -> 0 -> 'account' ->> 'offline')::boolean, 'the decided list shows the page offline');
select is(public.admin_reports('decided') -> 0 -> 'decision' ->> 'by', 'pete@example.com', 'and who decided');
select throws_ok($$ select public.admin_lift_moderation(current_setting('test.offline')::uuid, 'no') $$,
  'P0001', 'linkyo:reasonRequired', 'lifting needs a reason too');
select is(public.admin_lift_moderation(current_setting('test.offline')::uuid, 'The organiser showed the event is real.') ->> 'action', 'unpublish',
  'the admin lifts it after a complaint');
select is(public.public_page('nils-report') -> 'page' -> 'blocks' -> 0 ->> 'id', 'tour', 'the page is back');
select is((select action from public.audit_log order by id desc limit 1), 'moderation.lift', 'logged');
select throws_ok($$ select public.admin_lift_moderation(current_setting('test.offline')::uuid, 'The same lift again, twice.') $$,
  'P0001', 'linkyo:alreadyDone', 'once');

-- Suspending needs a reason now; letting the account back in lifts the suspension.
reset role;
insert into auth.sessions (id, user_id, created_at, updated_at) values ('a3000000-0000-4000-8000-0000000000aa', 'a3000000-0000-4000-8000-000000000002', now(), now());
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.admin_set_status('a3000000-0000-4000-8000-000000000002', 'suspended') $$,
  'P0001', 'linkyo:reasonRequired', 'admin_set_status no longer suspends without a reason');
select public.admin_moderate('a3000000-0000-4000-8000-000000000002', 'suspend', 'Repeated fake ticket sales after a warning.', 'terms');
reset role;
select is((select status::text from public.profiles where id = 'a3000000-0000-4000-8000-000000000002'), 'suspended', 'the account is suspended');
select is_empty($$ select 1 from auth.sessions where user_id = 'a3000000-0000-4000-8000-000000000002' $$, 'and signed out everywhere');
select is((select action from public.audit_log order by id desc limit 1), 'customer.suspend', 'logged as before');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select public.admin_set_status('a3000000-0000-4000-8000-000000000002', 'active');
reset role;
select is((select status::text from public.profiles where id = 'a3000000-0000-4000-8000-000000000002'), 'active', 'the account is back');
select is_empty($$ select 1 from public.moderation_decisions where profile_id = 'a3000000-0000-4000-8000-000000000002' and action = 'suspend' and lifted_at is null $$,
  'and its suspension is no longer in force');

-- Dismissing: no restriction, the reporter is told.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(public.admin_moderate(null, 'dismiss', 'Nothing on the page breaks the law or the terms.', null, null, current_setting('test.report4')::uuid) -> 'report' ->> 'email',
  'max@example.com', 'a dismissal answers the reporter''s address for the notice');
select is((select action from public.audit_log order by id desc limit 1), 'report.dismiss', 'logged');
select is(public.admin_moderate(null, 'dismiss', 'The page in the report does not exist here.', null, null, current_setting('test.report3')::uuid) -> 'report' ->> 'email',
  null, 'an anonymous report has no address to tell');
select is(jsonb_array_length(public.admin_reports()), 0, 'the queue is empty');

-- ── 5. The yearly count ─────────────────────────────────────────────────────────────────────
select is((public.admin_moderation_counts() ->> 'received')::int, 4, 'four reports this year');
select is(public.admin_moderation_counts() -> 'byAction', '{"dismiss": 2, "suspend": 1, "unpublish": 1, "hide_block": 1}'::jsonb, 'decisions by action');
select is(public.admin_moderation_counts() -> 'byGround', '{"terms": 2, "illegal": 1}'::jsonb, 'by ground');
select is((public.admin_moderation_counts() ->> 'lifted')::int, 2, 'two restrictions lifted (the page and the suspension)');
select is((public.admin_moderation_counts() ->> 'openNow')::int, 0, 'none open');
select throws_ok($$ select public.admin_moderation_counts(1999) $$, 'P0001', 'linkyo:invalid', 'a year outside the range is refused');
reset role;

-- ── 6. The digest and the purge (the server) ────────────────────────────────────────────────
set local role service_role;
select is((public.submit_report('mona-report', 'hate', 'A new report that waits for the team.', true, null, 'Kai Example', 'kai@example.com') ->> 'duplicate'),
  'false', 'a new report after the decision is a new one');
select is(jsonb_array_length(public.moderation_digest() -> 'open'), 1, 'the digest counts the open report');
select ok((public.moderation_digest() -> 'recipients') @> '["olga@example.com", "pete@example.com"]'::jsonb
  and not (public.moderation_digest() -> 'recipients') @> '["rita@example.com"]'::jsonb, 'and goes to the owners and admins only');
reset role;
update public.reports set decided_at = now() - interval '181 days' where id = current_setting('test.report1')::uuid;
set local role service_role;
select is(public.moderation_purge(), 1, 'the purge takes reports decided more than 180 days ago');
reset role;
select is((select coalesce(reporter_name, '') || coalesce(reporter_email, '') || coalesce(explanation, '') || coalesce(url, '')
  from public.reports where id = current_setting('test.report1')::uuid), '', 'their name, address, words and link are gone');
select is((select page || ' ' || category from public.reports where id = current_setting('test.report1')::uuid), 'mona-report privacy', 'the count keeps the rest');
select is((select count(*)::int from cron.job where jobname = 'linkyo-purge-reports'), 1, 'the purge runs every night');

-- ── 7. An account that is deleted takes nothing of the record along ─────────────────────────
delete from auth.users where id = 'a3000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.moderation_decisions where username = 'mona-report' and profile_id is null), 2, 'its decisions stay for the count');
select is((select profile_id from public.reports where id = current_setting('test.report1')::uuid), null, 'its reports lose the link to it');

select * from finish();
rollback;
