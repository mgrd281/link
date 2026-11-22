-- The AI builder (v7): reserving and settling runs, every limit, the team route, clean-up and who
-- may read or call what. Numbers in the headings follow the plan.
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Fay, Eli, Bea, Sid and the others are free accounts; Pia has Pro (entitlement), Quin Pro for life;
-- Gus bought the service; Cara builds pages (editor), Dan is a viewer, Olga owns the team; Sus is suspended.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
select ('c4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', name || '@example.com', jsonb_build_object('username', name), '{}', now(), now(), now()
from (values (1, 'fay'), (2, 'ben'), (3, 'cara'), (4, 'dan'), (5, 'olga'), (6, 'pia'), (7, 'quin'), (8, 'gus'),
  (9, 'hal'), (10, 'hana'), (11, 'hugo'), (12, 'hedi'), (13, 'hope'), (14, 'huw'), (15, 'eli'), (16, 'bea'),
  (17, 'rob'), (18, 'ria'), (19, 'gil'), (20, 'gina'), (21, 'sid'), (22, 'sus')) as people (n, name);
update public.profiles set status = 'suspended' where id = 'c4000000-0000-4000-8000-000000000022';
delete from public.team_members;
insert into public.team_members (user_id, role) values
  ('c4000000-0000-4000-8000-000000000003', 'editor'),
  ('c4000000-0000-4000-8000-000000000004', 'viewer'),
  ('c4000000-0000-4000-8000-000000000005', 'owner');
-- Only this test's runs and money (a database in use may have its own; everything is rolled back).
delete from public.ai_runs;
delete from public.ai_budget_days;
delete from public.ai_usage;

select results_eq(
  $$ select enabled, daily_budget_micros, free_drafts, pro_drafts_per_month, ip_runs_per_day, account_concurrency,
       global_concurrency, uncounted_failures_per_day from public.ai_settings $$,
  $$ values (true, 10000000::bigint, 1, 5, 5, 1, 10, 3) $$,
  'the defaults: $10 a day, 1 free draft, 5 a month with Pro, 5 runs per address, 1 per account, 10 at once, 3 failures');

-- ── 1. A free account: one draft for life ───────────────────────────────────────────────────
select set_config('test.fay1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000001', 'ip-fay', 'welcome',
  1050000, 'prompt-v1', 'plan-v1')::text, true);
select is(current_setting('test.fay1')::jsonb - 'id',
  '{"ok":true,"plan":"free","allowance":1,"used":0,"left":1}'::jsonb, 'a free account may start its draft (1 left)');
select is((select status::text || '/' || reserved_micros from public.ai_runs where id = (current_setting('test.fay1')::jsonb ->> 'id')::uuid),
  'running/1050000', 'the run is reserved with the worst case');
select is((select spent_micros::bigint || '/' || runs from public.ai_budget_days where day = (now() at time zone 'Europe/Berlin')::date),
  '1050000/1', 'and the day''s budget holds it');
select public.ai_record_progress((current_setting('test.fay1')::jsonb ->> 'id')::uuid, '[{"key":"read","state":"done","count":3,"ms":800}]');
select is((select progress from public.ai_runs where id = (current_setting('test.fay1')::jsonb ->> 'id')::uuid),
  '[{"key":"read","state":"done","count":3,"ms":800}]'::jsonb, 'progress is recorded while it runs');
select throws_ok(format($$ select public.ai_record_progress(%L, '{"key":"read"}') $$, current_setting('test.fay1')::jsonb ->> 'id'),
  'P0001', 'linkyo:invalid', 'progress is a list');
select public.ai_settle_run((current_setting('test.fay1')::jsonb ->> 'id')::uuid, 'succeeded', true, 300000,
  '{"model":"mock-model","served_by":"mock-model","effort":"medium","stop_reason":"end_turn","calls":1,"sources":2,"blocks":4,"dropped":1,"fixed":0,"ms_total":42000,"input_tokens":18000,"output_tokens":9000}',
  '{"page":{"profile":{"displayName":"Fay"},"blocks":[]},"theme":{},"kind":"music","notes":[]}');
select is((select status::text || '/' || counted || '/' || blocks || '/' || ms_total || '/' || model || '/' || input_tokens
  from public.ai_runs where id = (current_setting('test.fay1')::jsonb ->> 'id')::uuid),
  'succeeded/true/4/42000/mock-model/18000', 'settling stores the outcome and the numbers');
select is((select result ->> 'kind' from public.ai_runs where id = (current_setting('test.fay1')::jsonb ->> 'id')::uuid), 'music',
  'and the draft');
select is((select spent_micros from public.ai_budget_days where day = (now() at time zone 'Europe/Berlin')::date), 300000::bigint,
  'the reservation becomes the real cost');
select is((select counted from public.ai_usage where profile_id = 'c4000000-0000-4000-8000-000000000001'), 1, 'the draft counts');
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000001', 'ip-fay', 'welcome', 1050000, 'prompt-v1', 'plan-v1'),
  '{"ok":false,"reason":"quota"}'::jsonb, 'a second draft is refused: quota');

-- ── 10. Settling twice changes nothing ──────────────────────────────────────────────────────
select public.ai_settle_run((current_setting('test.fay1')::jsonb ->> 'id')::uuid, 'failed', true, 999999, '{}');
select is((select status::text || '/' || cost_micros from public.ai_runs where id = (current_setting('test.fay1')::jsonb ->> 'id')::uuid),
  'succeeded/300000', 'a second settle is a no-op');
select is((select counted from public.ai_usage where profile_id = 'c4000000-0000-4000-8000-000000000001'), 1, 'and counts nothing more');
select public.ai_record_progress((current_setting('test.fay1')::jsonb ->> 'id')::uuid, '[]');
select is(jsonb_array_length((select progress from public.ai_runs where id = (current_setting('test.fay1')::jsonb ->> 'id')::uuid)), 1,
  'a finished run keeps its progress');
select throws_ok(format($$ select public.ai_settle_run(%L, 'running', false, 0, '{}') $$, current_setting('test.fay1')::jsonb ->> 'id'),
  'P0001', 'linkyo:invalid', 'a run cannot be settled as running');

-- ── 2. Uncounted failures: free, but at most 3 a day ────────────────────────────────────────
select set_config('test.eli1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000015', 'ip-eli', 'welcome', 1050000, 'p', 's') ->> 'id', true);
select public.ai_settle_run(current_setting('test.eli1')::uuid, 'failed', false, 20000, '{"error_code":"server"}');
select set_config('test.eli2', public.ai_reserve_run('c4000000-0000-4000-8000-000000000015', 'ip-eli', 'welcome', 1050000, 'p', 's') ->> 'id', true);
select isnt(current_setting('test.eli2'), '', 'a failed run used no draft');
select public.ai_settle_run(current_setting('test.eli2')::uuid, 'refused', false, 20000, '{"stop_reason":"refusal"}');
select set_config('test.eli3', public.ai_reserve_run('c4000000-0000-4000-8000-000000000015', 'ip-eli', 'welcome', 1050000, 'p', 's') ->> 'id', true);
select isnt(current_setting('test.eli3'), '', 'neither did a refused one');
select public.ai_settle_run(current_setting('test.eli3')::uuid, 'stopped', false, 20000, '{"blocks":0}');
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000015', 'ip-eli', 'welcome', 1050000, 'p', 's'),
  '{"ok":false,"reason":"failures"}'::jsonb, 'after 3 uncounted runs (failed, refused, stopped empty) the 4th is refused');
select is((select count(*)::int from public.ai_usage where profile_id = 'c4000000-0000-4000-8000-000000000015'), 0,
  'none of them counted');

-- ── 3. One run at a time per account, 10 at once overall ────────────────────────────────────
select set_config('test.bea1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000016', 'ip-bea', 'dashboard', 1050000, 'p', 's') ->> 'id', true);
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000016', 'ip-bea', 'dashboard', 1050000, 'p', 's'),
  '{"ok":false,"reason":"busy"}'::jsonb, 'a second run while one is running: busy');
update public.ai_settings set global_concurrency = 2;
select set_config('test.rob1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000017', 'ip-rob', 'dashboard', 1050000, 'p', 's') ->> 'id', true);
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000018', 'ip-ria', 'dashboard', 1050000, 'p', 's'),
  '{"ok":false,"reason":"busy"}'::jsonb, 'with two runs of other accounts running and a limit of 2: busy');
select public.ai_settle_run(current_setting('test.bea1')::uuid, 'failed', false, 0, '{}');
select public.ai_settle_run(current_setting('test.rob1')::uuid, 'failed', false, 0, '{}');
update public.ai_settings set global_concurrency = 10;

-- ── 4. The daily budget ─────────────────────────────────────────────────────────────────────
update public.ai_settings set daily_budget_micros = 1000000;
update public.ai_budget_days set spent_micros = 0 where day = (now() at time zone 'Europe/Berlin')::date;
select set_config('test.gil1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000019', 'ip-gil', 'dashboard', 600000, 'p', 's') ->> 'id', true);
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000020', 'ip-gina', 'dashboard', 600000, 'p', 's'),
  '{"ok":false,"reason":"budget"}'::jsonb, 'a reservation over the day''s budget is refused');
select public.ai_settle_run(current_setting('test.gil1')::uuid, 'succeeded', true, 50000, '{}');
select is((select spent_micros from public.ai_budget_days where day = (now() at time zone 'Europe/Berlin')::date), 50000::bigint,
  'settling the first with its real cost frees the rest');
select set_config('test.gina1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000020', 'ip-gina', 'dashboard', 600000, 'p', 's') ->> 'id', true);
select isnt(current_setting('test.gina1'), '', 'so the next one fits');
select public.ai_settle_run(current_setting('test.gina1')::uuid, 'failed', false, 0, '{}');
update public.ai_settings set daily_budget_micros = 10000000;

-- ── 5. Five runs per address and day ────────────────────────────────────────────────────────
select ok(public.ai_reserve_run(('c4000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'ip-shared', 'welcome', 100000, 'p', 's') ->> 'ok' = 'true',
  'run ' || (n - 8) || ' from one address') from generate_series(9, 13) n;
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000014', 'ip-shared', 'welcome', 100000, 'p', 's'),
  '{"ok":false,"reason":"ip"}'::jsonb, 'the sixth from one address in a day is refused');
select public.ai_settle_run(id, 'failed', false, 0, '{}') from public.ai_runs where ip_hash = 'ip-shared';

-- ── 6–7. Pro: five drafts a month ───────────────────────────────────────────────────────────
insert into public.entitlements (profile_id, product, source, status, current_period_end) values
  ('c4000000-0000-4000-8000-000000000006', 'pro', 'stripe', 'active', now() + interval '20 days');
insert into public.ai_usage (profile_id, month, counted) values
  ('c4000000-0000-4000-8000-000000000006', (date_trunc('month', now() at time zone 'Europe/Berlin') - interval '1 month')::date, 9);
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000006', 'ip-pia-0', 'dashboard', 1050000, 'p', 's') - 'id',
  '{"ok":true,"plan":"pro","allowance":5,"used":0,"left":5}'::jsonb, 'Pro has 5 drafts a month; last month''s do not count');
select public.ai_settle_run(id, 'succeeded', true, 100000, '{}') from public.ai_runs
  where profile_id = 'c4000000-0000-4000-8000-000000000006' and status = 'running';
do $$
declare
  reserved jsonb;
begin
  for i in 1..4 loop
    reserved := public.ai_reserve_run('c4000000-0000-4000-8000-000000000006', 'ip-pia-' || i, 'dashboard', 1050000, 'p', 's');
    perform public.ai_settle_run((reserved ->> 'id')::uuid, 'succeeded', true, 100000, '{}');
  end loop;
end;
$$;
select is((select counted from public.ai_usage where profile_id = 'c4000000-0000-4000-8000-000000000006'
  and month = date_trunc('month', now() at time zone 'Europe/Berlin')::date), 5, 'five drafts this month');
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000006', 'ip-pia-6', 'dashboard', 1050000, 'p', 's'),
  '{"ok":false,"reason":"quota"}'::jsonb, 'the sixth this month is refused');
insert into public.rewards (profile_id, kind) values ('c4000000-0000-4000-8000-000000000007', 'pro_for_life');
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000007', 'ip-quin', 'dashboard', 1050000, 'p', 's') - 'id',
  '{"ok":true,"plan":"pro","allowance":5,"used":0,"left":5}'::jsonb, 'Pro for life comes with the same 5 drafts');
select public.ai_settle_run(id, 'failed', false, 0, '{}') from public.ai_runs
  where profile_id = 'c4000000-0000-4000-8000-000000000007' and status = 'running';

-- ── 8. The kill switch ──────────────────────────────────────────────────────────────────────
update public.ai_settings set enabled = false;
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000021', 'ip-sid', 'dashboard', 1050000, 'p', 's'),
  '{"ok":false,"reason":"disabled"}'::jsonb, 'switched off: disabled');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is(public.admin_ai_status() ->> 'enabled', 'false', 'a viewer sees the switch');
select throws_ok($$ select public.admin_set_ai_enabled(true) $$, '42501', 'linkyo:forbidden', 'but cannot flip it');
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.admin_ai_status() $$, '42501', 'linkyo:forbidden', 'customers see no AI status');
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select lives_ok($$ select public.admin_set_ai_enabled(true) $$, 'the owner switches it on');
select is(public.admin_ai_status() - 'today', '{"enabled":true,"running":0}'::jsonb, 'and sees it on, nothing running');
select set_config('test.status', public.admin_ai_status()::text, true);
reset role;
select is((current_setting('test.status')::jsonb -> 'today' ->> 'runs')::int,
  (select count(*)::int from public.ai_runs where created_at = now()), 'with today''s runs');
select is((select action || ':' || (details ->> 'enabled') from public.audit_log where at = now() and action = 'ai.enabled'),
  'ai.enabled:true', 'the switch is in the activity log');
select public.ai_disable('spend limit reached');
select is((select enabled from public.ai_settings), false, 'Anthropic''s spend limit switches it off');
update public.ai_settings set enabled = true;
select is(public.ai_reserve_run('c4000000-0000-4000-8000-000000000022', 'ip-sus', 'dashboard', 1050000, 'p', 's'),
  '{"ok":false,"reason":"disabled"}'::jsonb, 'a suspended account cannot start a run');

-- ── 9. The team's run for an order ──────────────────────────────────────────────────────────
insert into public.orders (id, profile_id, customer_email, package, status, locale, amount_cents, vat_mode, early_start,
    start_after, promised_due_at, revisions_allowed, stripe_session_id) values
  ('0c400000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000008', 'gus@example.com', 'start', 'in_progress',
    'de', 2499, 'standard19', true, now(), now() + interval '1 day', 1, 'cs_ai_gus'),
  ('0c400000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000008', 'gus@example.com', 'start', 'in_progress',
    'de', 2499, 'standard19', true, now(), now() + interval '1 day', 1, 'cs_ai_gus_2');
update public.orders set withdrawal_pending = true where id = '0c400000-0000-4000-8000-000000000002';
-- Cara has used her own free draft, and the address is at its limit: neither matters for the team.
insert into public.ai_usage (profile_id, month, counted) values
  ('c4000000-0000-4000-8000-000000000003', date_trunc('month', now() at time zone 'Europe/Berlin')::date, 1);
select throws_ok($$ select public.ai_reserve_run('c4000000-0000-4000-8000-000000000003', null, 'team', 1850000, 'p', 's',
  'c4000000-0000-4000-8000-000000000003') $$, 'P0001', 'linkyo:invalid', 'a team run needs its order');
select throws_ok($$ select public.ai_reserve_run('c4000000-0000-4000-8000-000000000003', null, 'team', 1850000, 'p', 's',
  'c4000000-0000-4000-8000-000000000003', '0c400000-0000-4000-8000-000000000002') $$, 'P0001', 'linkyo:locked',
  'no team run while a withdrawal waits');
select set_config('test.team1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000003', 'ip-shared', 'team', 1850000,
  'p', 's', 'c4000000-0000-4000-8000-000000000003', '0c400000-0000-4000-8000-000000000001')::text, true);
select is(current_setting('test.team1')::jsonb - 'id', '{"ok":true,"plan":"team","allowance":null,"used":null,"left":null}'::jsonb,
  'the team has no quota and no address limit');
select is((select profile_id::text || '/' || actor_id || '/' || order_id from public.ai_runs
  where id = (current_setting('test.team1')::jsonb ->> 'id')::uuid),
  'c4000000-0000-4000-8000-000000000003/c4000000-0000-4000-8000-000000000003/0c400000-0000-4000-8000-000000000001',
  'the run belongs to the team member, for the order');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
select is_empty($$ select id from public.ai_runs $$, 'the customer never sees the team''s run or its draft');
select is(public.ai_request_stop((current_setting('test.team1')::jsonb ->> 'id')::uuid), 'notFound', 'nor stops it');
reset role;
select set_config('test.gus1', public.ai_reserve_run('c4000000-0000-4000-8000-000000000008', 'ip-gus', 'dashboard', 1050000, 'p', 's')::text, true);
select is(current_setting('test.gus1')::jsonb ->> 'ok', 'true', 'and is not busy while it runs');
select public.ai_settle_run((current_setting('test.team1')::jsonb ->> 'id')::uuid, 'succeeded', true, 400000, '{}');
select is((select counted from public.ai_usage where profile_id = 'c4000000-0000-4000-8000-000000000003'), 1,
  'a team draft counts toward nobody''s quota');

-- ── 14. Stopping ────────────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.ai_request_stop((current_setting('test.gus1')::jsonb ->> 'id')::uuid), 'notFound', 'Ben cannot stop Gus''s run');
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
select is(public.ai_request_stop((current_setting('test.gus1')::jsonb ->> 'id')::uuid), 'ok', 'Gus stops his');
reset role;
select ok(public.ai_stop_requested((current_setting('test.gus1')::jsonb ->> 'id')::uuid), 'the pipeline sees the stop');
select ok(not public.ai_stop_requested((current_setting('test.team1')::jsonb ->> 'id')::uuid), 'only for that run');
select public.ai_settle_run((current_setting('test.gus1')::jsonb ->> 'id')::uuid, 'stopped', true, 100000, '{"blocks":2}',
  '{"page":{"profile":{},"blocks":[]}}');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000008","role":"authenticated"}', true);
select is(public.ai_request_stop((current_setting('test.gus1')::jsonb ->> 'id')::uuid), 'finished', 'after it ended: finished');
select public.ai_mark_applied((current_setting('test.gus1')::jsonb ->> 'id')::uuid);
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select public.ai_mark_applied((current_setting('test.fay1')::jsonb ->> 'id')::uuid);
reset role;
select isnt((select applied_at from public.ai_runs where id = (current_setting('test.gus1')::jsonb ->> 'id')::uuid), null,
  'the owner marks the draft used');
select is((select applied_at from public.ai_runs where id = (current_setting('test.fay1')::jsonb ->> 'id')::uuid), null,
  'nobody else can');

-- ── 12. Who reads and calls what ────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select array_agg(status::text || ':' || (result ->> 'kind')) from (select id, status, result from public.ai_runs) r),
  array['succeeded:music'], 'the owner reads her run and its draft');
select throws_ok($$ select ip_hash from public.ai_runs $$, '42501', null, 'never the address hash');
select throws_ok($$ select cost_micros, input_tokens from public.ai_runs $$, '42501', null, 'nor money or tokens');
select throws_ok($$ select public.ai_reserve_run('c4000000-0000-4000-8000-000000000001', 'x', 'welcome', 1, 'p', 's') $$,
  '42501', null, 'browsers cannot reserve runs');
select throws_ok(format($$ select public.ai_settle_run(%L, 'succeeded', true, 0, '{}') $$, current_setting('test.fay1')::jsonb ->> 'id'),
  '42501', null, 'or settle them');
select throws_ok($$ select 1 from public.ai_settings $$, '42501', null, 'or read the settings');
select throws_ok($$ select 1 from public.ai_usage $$, '42501', null, 'or the counters');
select throws_ok($$ update public.ai_runs set counted = false $$, '42501', null, 'or change a run');
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is_empty($$ select id from public.ai_runs $$, 'Ben sees no run');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select id from public.ai_runs $$, '42501', null, 'visitors read no runs');
select throws_ok($$ select public.my_ai_quota() $$, '42501', null, 'and have no quota');
reset role;

-- ── 13. The quota as the customer sees it ───────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000015","role":"authenticated"}', true);
select is(public.my_ai_quota(),
  '{"enabled":true,"plan":"free","allowance":1,"used":0,"left":1,"period":"life","resetsAt":null}'::jsonb,
  'free: one draft for life, failed runs did not use it');
select set_config('request.jwt.claims', '{"sub":"c4000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
select is(public.my_ai_quota() - 'resetsAt', '{"enabled":true,"plan":"pro","allowance":5,"used":5,"left":0,"period":"month"}'::jsonb,
  'Pro: five a month, all used');
select is((public.my_ai_quota() ->> 'resetsAt')::timestamptz,
  (date_trunc('month', now() at time zone 'Europe/Berlin') + interval '1 month') at time zone 'Europe/Berlin',
  'they come back on the first of next month (Berlin)');
reset role;

-- ── 11. Clean-up ────────────────────────────────────────────────────────────────────────────
insert into public.ai_runs (id, profile_id, route, status, reserved_micros, prompt_version, schema_version, created_at, result) values
  ('0c4c0000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000021', 'welcome', 'running', 500000, 'p', 's',
    now() - interval '11 minutes', null),
  ('0c4c0000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000021', 'welcome', 'succeeded', 500000, 'p', 's',
    now() - interval '8 days', '{"page":{}}'),
  ('0c4c0000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000021', 'welcome', 'succeeded', 500000, 'p', 's',
    now() - interval '31 days', '{"page":{}}');
insert into public.ai_usage (profile_id, month, counted) values
  ('c4000000-0000-4000-8000-000000000021', (date_trunc('month', now() at time zone 'Europe/Berlin') - interval '1 month')::date, 1);
insert into public.ai_budget_days (day, spent_micros) values
  (((now() - interval '11 minutes') at time zone 'Europe/Berlin')::date, 0) on conflict (day) do nothing;
update public.ai_budget_days set spent_micros = spent_micros + 500000
  where day = ((now() - interval '11 minutes') at time zone 'Europe/Berlin')::date;
select set_config('test.spent', (select spent_micros::text from public.ai_budget_days
  where day = ((now() - interval '11 minutes') at time zone 'Europe/Berlin')::date), true);
insert into public.ai_budget_days (day, spent_micros) values ((now() at time zone 'Europe/Berlin')::date - 91, 5);
select ok(public.ai_cleanup() >= 3, 'the clean-up runs');
select is((select status::text || '/' || error_code from public.ai_runs where id = '0c4c0000-0000-4000-8000-000000000001'),
  'failed/stale', 'a run stuck for 10 minutes fails as stale');
select is((select spent_micros from public.ai_budget_days where day = ((now() - interval '11 minutes') at time zone 'Europe/Berlin')::date),
  current_setting('test.spent')::bigint - 500000, 'and gives its reservation back');
select is((select result from public.ai_runs where id = '0c4c0000-0000-4000-8000-000000000002'), null,
  'drafts are cleared after 7 days, the run stays');
select is_empty($$ select 1 from public.ai_runs where id = '0c4c0000-0000-4000-8000-000000000003' $$, 'runs are deleted after 30 days');
select is((select sum(counted)::int from public.ai_usage where profile_id = 'c4000000-0000-4000-8000-000000000021'), 1,
  'the usage counters stay');
select is_empty($$ select 1 from public.ai_budget_days where day < (now() at time zone 'Europe/Berlin')::date - 90 $$,
  'budget days go after 90 days');
select isnt((select jobid from cron.job where jobname = 'linkyo-ai-cleanup'), null, 'every 5 minutes');
select is((select array_agg(jobname::text order by jobname) from cron.job where jobname like 'linkyo-%'),
  array['linkyo-ai-cleanup', 'linkyo-purge-form-limits', 'linkyo-purge-sign-ins', 'linkyo-purge-unconfirmed',
    'linkyo-service-maintenance', 'linkyo-settle-referrals'], 'six nightly or frequent jobs in all');

select * from finish();
rollback;
