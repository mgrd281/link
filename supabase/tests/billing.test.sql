-- Selling (v7): orders, proposals, revisions, refunds, Pro, withdrawals and cancellations, checked as
-- our server (postgres), customers, a visitor and the team. Numbers in the headings follow the plan.
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- People: Ana (Start), Mia (Premium) and Kai (two orders) buy the service; Ben is another customer;
-- Cara builds pages (editor), Dan is a viewer, Olga owns the team; Pete, Quin, Rita, Stan, Vic, Wes and
-- Xia test Pro; Zoe deletes her account.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) values
  ('b3000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@example.com', '{"username":"ana"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@example.com', '{"username":"ben"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cara@example.com', '{"username":"cara"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dan@example.com', '{"username":"dan"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olga@example.com', '{"username":"olga"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mia@example.com', '{"username":"mia"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kai@example.com', '{"username":"kai"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pete@example.com', '{"username":"pete"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'quin@example.com', '{"username":"quin"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rita@example.com', '{"username":"rita"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stan@example.com', '{"username":"stan"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vic@example.com', '{"username":"vic"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wes@example.com', '{"username":"wes"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'xia@example.com', '{"username":"xia"}', '{}', now(), now(), now()),
  ('b3000000-0000-4000-8000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zoe@example.com', '{"username":"zoe"}', '{}', now(), now(), now());
insert into public.sites (profile_id, onboarded, theme, page) values
  ('b3000000-0000-4000-8000-000000000001', true, '{"template":"nocturne"}', '{"profile":{"displayName":"Ana"},"blocks":[{"id":"a","type":"link","title":"Shop","url":"https://example.com"}]}'),
  ('b3000000-0000-4000-8000-000000000006', true, '{"template":"daylight"}', '{"profile":{"displayName":"Mia"},"blocks":[]}');
delete from public.team_members;
insert into public.team_members (user_id, role) values
  ('b3000000-0000-4000-8000-000000000003', 'editor'),
  ('b3000000-0000-4000-8000-000000000004', 'viewer'),
  ('b3000000-0000-4000-8000-000000000005', 'owner');

-- ── 1. Checkout → consent → paid order ──────────────────────────────────────────────────────
select public.record_checkout_intent('cs_a1', 'b3000000-0000-4000-8000-000000000001', 'service-start', 'de');
select is(public.record_checkout_consent('cs_a1', 'b3000000-0000-4000-8000-000000000002', true, 'x', now(), now()),
  'notFound', 'only the account that opened the checkout gives the consent');
select is(public.record_checkout_consent('cs_a1', 'b3000000-0000-4000-8000-000000000001', true,
  'Ich möchte, dass ihr sofort beginnt.', now() + interval '1 hour', now() + interval '2 days'), 'ok',
  'the consent fixes the dates');
select set_config('test.a1', public.record_service_order('cs_a1', 'pi_a1', 2499, ' ana@example.com ', 'Ana Vega') ->> 'id', true);
select matches((select number from public.orders where id = current_setting('test.a1')::uuid), '^LNK-\d{4}-\d{6}$',
  'the order gets a number like LNK-2026-000001');
select is((select revisions_allowed::int from public.orders where id = current_setting('test.a1')::uuid), 1,
  'Start comes with one revision round');
select is((select start_after from public.orders where id = current_setting('test.a1')::uuid), now() + interval '1 hour',
  'the start is the consent''s');
select is((select promised_due_at from public.orders where id = current_setting('test.a1')::uuid), now() + interval '2 days',
  'and so is the promised date');
select is((select early_start_text from public.orders where id = current_setting('test.a1')::uuid),
  'Ich möchte, dass ihr sofort beginnt.', 'the early-start consent is kept word for word');
select is((select status::text || '/' || customer_email from public.orders where id = current_setting('test.a1')::uuid),
  'paid/ana@example.com', 'the order starts as paid');
select is(public.record_service_order('cs_a1', 'pi_a1', 2499, 'ana@example.com'),
  jsonb_build_object('id', current_setting('test.a1')::uuid, 'number',
    (select number from public.orders where id = current_setting('test.a1')::uuid), 'created', false),
  'a second delivery of the same event returns the same order');
select is((select count(*)::int from public.order_events where order_id = current_setting('test.a1')::uuid and kind = 'paid'), 1,
  'and the timeline has the payment once');
select is(public.record_checkout_consent('cs_a1', 'b3000000-0000-4000-8000-000000000001', false, null, now(), now()),
  'notFound', 'once the order exists its consent cannot change');

select public.record_checkout_intent('cs_m1', 'b3000000-0000-4000-8000-000000000006', 'service-premium', 'de');
select is(public.record_checkout_consent('cs_m1', 'b3000000-0000-4000-8000-000000000006', false, 'not used',
  now() + interval '14 days', now() + interval '16 days'), 'ok', 'Mia consents without an early start');
select set_config('test.m1', public.record_service_order('cs_m1', 'pi_m1', 7999, 'mia@example.com') ->> 'id', true);
select is((select package::text || '/' || revisions_allowed from public.orders where id = current_setting('test.m1')::uuid),
  'premium/3', 'Premium comes with three revision rounds');
select is((select start_after from public.orders where id = current_setting('test.m1')::uuid), now() + interval '14 days',
  'without an early start the order keeps the later start');
select is((select early_start::text || '/' || coalesce(early_start_text, '-') from public.orders where id = current_setting('test.m1')::uuid),
  'false/-', 'and no early-start text');

select is(public.record_service_order('cs_unknown', 'pi_x', 2499, 'x@example.com'), '{"error":"notFound"}'::jsonb,
  'a session without an intent creates nothing');
select public.record_checkout_intent('cs_b_noconsent', 'b3000000-0000-4000-8000-000000000002', 'service-start', 'en');
select is(public.record_service_order('cs_b_noconsent', 'pi_y', 2499, 'ben@example.com'), '{"error":"noConsent"}'::jsonb,
  'an intent without a consent is refused');
select is_empty($$ select 1 from public.orders where stripe_session_id = 'cs_b_noconsent' $$, 'and no order is made');
select public.record_checkout_intent('cs_b_pro', 'b3000000-0000-4000-8000-000000000002', 'pro-monthly', 'en');
select is(public.record_checkout_consent('cs_b_pro', 'b3000000-0000-4000-8000-000000000002', true, 'x', now(), now()),
  'notFound', 'Pro has no service consent');

-- ── 2. The queue shows an order once its confirmation went out ──────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select ok(not exists (select 1 from jsonb_array_elements(public.admin_orders('all')) o where o ->> 'id' = current_setting('test.a1')),
  'before its confirmation e-mail an order is not in the queue');
reset role;
select public.mark_confirmation_sent(current_setting('test.a1')::uuid);
select public.mark_confirmation_sent(current_setting('test.a1')::uuid);
select public.mark_confirmation_sent(current_setting('test.m1')::uuid);
select is((select count(*)::int from public.order_events where order_id = current_setting('test.a1')::uuid and kind = 'confirmation_sent'),
  1, 'the confirmation is recorded once');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select o ->> 'status' from jsonb_array_elements(public.admin_orders('all')) o where o ->> 'id' = current_setting('test.a1')),
  'awaiting_briefing', 'after it the order is in the queue, waiting for its briefing');
select throws_ok($$ select public.admin_orders('everything') $$, 'P0001', 'linkyo:invalid', 'only known scopes');
reset role;

-- ── 3. The briefing ─────────────────────────────────────────────────────────────────────────
select is(public.set_order_briefing(current_setting('test.a1')::uuid, 'b3000000-0000-4000-8000-000000000002',
  '{"wishes":"x"}', now() + interval '2 days'), 'notFound', 'another account cannot brief Ana''s order');
select is(public.set_order_briefing(current_setting('test.a1')::uuid, 'b3000000-0000-4000-8000-000000000001',
  '{"wishes":"Bitte in Grün"}', now() + interval '2 days'), 'ok', 'Ana briefs her order');
select is((select status::text from public.orders where id = current_setting('test.a1')::uuid), 'queued', 'and it joins the queue');
select is((select due_at from public.orders where id = current_setting('test.a1')::uuid), now() + interval '2 days',
  'with the due date the route decided');
select is(public.set_order_briefing(current_setting('test.a1')::uuid, 'b3000000-0000-4000-8000-000000000001',
  '{"wishes":"Doch Blau"}', now() + interval '3 days'), 'locked', 'a second briefing is refused');
select is(public.set_order_briefing(current_setting('test.m1')::uuid, 'b3000000-0000-4000-8000-000000000006',
  '{"wishes":"Elegant"}', now() + interval '16 days'), 'ok', 'Mia briefs hers');

-- ── 4. Who reads and writes orders ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select array_agg(id::text) from public.orders), array[current_setting('test.a1')], 'Ana reads her own order only');
select throws_ok($$ select public.admin_orders() $$, '42501', 'linkyo:forbidden', 'customers cannot open the order queue');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is_empty($$ select 1 from public.orders $$, 'Ben reads no order');
select throws_ok($$ insert into public.orders (customer_email, package, locale, amount_cents, vat_mode, early_start,
    start_after, promised_due_at, revisions_allowed, stripe_session_id)
  values ('ben@example.com', 'premium', 'en', 1, 'standard19', true, now(), now(), 5, 'cs_fake') $$,
  '42501', null, 'nobody writes orders from the browser');
select throws_ok($$ update public.orders set status = 'completed' $$, '42501', null, 'or changes them');
select throws_ok($$ select public.record_service_order('cs_a1', 'pi', 1, 'x') $$, '42501', null,
  'or calls the server''s order functions');
select throws_ok($$ select public.has_pro('b3000000-0000-4000-8000-000000000002') $$, '42501', null, 'or asks who has Pro');
select is_empty($$ select 1 from public.order_events $$, 'customers do not read the team''s timeline');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is_empty($$ select 1 from public.orders $$, 'visitors read no orders');
select throws_ok($$ select public.my_orders() $$, '42501', null, 'and call no order functions');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select ok((select count(*) from jsonb_array_elements(public.admin_orders('all'))) >= 2, 'a viewer reads the queue');

-- ── 5–6. Proposals never touch the page; drafts stay with the team ──────────────────────────
select throws_ok(format($$ select public.admin_save_proposal(%L, '{"profile":{},"blocks":[]}', '{}') $$, current_setting('test.a1')),
  '42501', 'linkyo:forbidden', 'a viewer cannot write proposals');
reset role;
create temp table site_before as
  select page::text as page, theme::text as theme from public.sites where profile_id = 'b3000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('test.a1p0', public.admin_save_proposal(current_setting('test.a1')::uuid,
  '{"profile":{"displayName":"Ana","aiFields":["bio"]},"blocks":[{"id":"p1","type":"link","origin":"ai"}]}',
  '{"template":"daylight"}', 'musician', 'Hier ist dein Entwurf.', '{"bioInstagram":"Kurz"}',
  array['b3000000-0000-4000-8000-000000000001/' || current_setting('test.a1') || '/s1.png'])::text, true);
select isnt(current_setting('test.a1p0'), '', 'an editor saves a proposal');
select is(public.admin_save_proposal(current_setting('test.a1')::uuid, '{"profile":{"displayName":"Ana V"},"blocks":[]}',
  '{"template":"daylight"}')::text, current_setting('test.a1p0'), 'saving again updates the same draft');
select throws_ok(format($$ select public.admin_save_proposal(%L, '{"profile":{},"blocks":[]}', '{}', null, null, null,
  array['b3000000-0000-4000-8000-000000000002/x/s.png']) $$, current_setting('test.a1')),
  'P0001', 'linkyo:invalid', 'story pictures must lie in the customer''s order folder');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is_empty($$ select 1 from public.site_proposals $$, 'the customer cannot read a draft');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(public.admin_deliver_proposal(current_setting('test.a1p0')::uuid) - 'reviseUntil',
  jsonb_build_object('customerEmail', 'ana@example.com', 'locale', 'de',
    'number', (select number from public.orders where id = current_setting('test.a1')::uuid),
    'package', 'start', 'round', 0, 'revisionsLeft', 1, 'aiAssisted', false, 'hasKit', false),
  'delivering returns what the e-mail needs');
select throws_ok(format($$ select public.admin_save_proposal(%L, '{"profile":{},"blocks":[]}', '{}') $$, current_setting('test.a1')),
  'P0001', 'linkyo:locked', 'after delivery (no revision asked) there is nothing to save');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select status::text from public.site_proposals where id = current_setting('test.a1p0')::uuid), 'delivered',
  'once delivered the customer reads it');
select is((select status::text from public.orders where id = current_setting('test.a1')::uuid), 'delivered', 'the order is delivered');
reset role;
select is((select page::text from public.sites where profile_id = 'b3000000-0000-4000-8000-000000000001'),
  (select page from site_before), 'saving and delivering a proposal leave the customer''s page byte for byte');
select is((select theme::text from public.sites where profile_id = 'b3000000-0000-4000-8000-000000000001'),
  (select theme from site_before), 'and its look');

select is(public.record_revision(current_setting('test.a1p0')::uuid, 'b3000000-0000-4000-8000-000000000001',
  ' Bitte das Foto tauschen ', now() + interval '2 days'), 'ok', 'Ana asks for changes');
select is((select request from public.site_proposals where id = current_setting('test.a1p0')::uuid), 'Bitte das Foto tauschen',
  'her request is kept with the proposal');
select is((select status::text || '/' || revisions_used from public.orders where id = current_setting('test.a1')::uuid),
  'revision_requested/1', 'the order waits for the revision');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('test.a1p1', public.admin_save_proposal(current_setting('test.a1')::uuid,
  '{"profile":{"displayName":"Ana"},"blocks":[]}', '{"template":"daylight"}')::text, true);
select is((select round::int from public.site_proposals where id = current_setting('test.a1p1')::uuid), 1, 'the revision is round 1');
select is((select extras from public.site_proposals where id = current_setting('test.a1p1')::uuid), '{"bioInstagram":"Kurz"}'::jsonb,
  'it starts from round 0''s kit');
select is((select story_paths from public.site_proposals where id = current_setting('test.a1p1')::uuid),
  array['b3000000-0000-4000-8000-000000000001/' || current_setting('test.a1') || '/s1.png'], 'and story pictures');
select is(public.admin_deliver_proposal(current_setting('test.a1p1')::uuid) ->> 'round', '1', 'round 1 is delivered');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select array_agg(round || ':' || status order by round) from public.site_proposals), array['0:superseded', '1:delivered'],
  'a second delivery supersedes the first');
reset role;
select is((select page::text from public.sites where profile_id = 'b3000000-0000-4000-8000-000000000001'),
  (select page from site_before), 'the page is still untouched');

-- ── 17. Premium needs its marketing kit ─────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('test.m1p0', public.admin_save_proposal(current_setting('test.m1')::uuid,
  '{"profile":{"displayName":"Mia"},"blocks":[{"id":"x","type":"link"}]}', '{"template":"daylight"}')::text, true);
select throws_ok(format($$ select public.admin_deliver_proposal(%L) $$, current_setting('test.m1p0')),
  'P0001', 'linkyo:incomplete', 'Premium without the kit cannot be delivered');
select public.admin_save_proposal(current_setting('test.m1')::uuid, '{"profile":{"displayName":"Mia"},"blocks":[]}', '{}', null, null,
  '{"bioInstagram":"Mode & Reisen","bioTiktok":"Mode","postingPlan":[{"week":1,"idea":"a"},{"week":2,"idea":"b"},{"week":3,"idea":"c"},{"week":4,"idea":"d"}]}',
  array['b3000000-0000-4000-8000-000000000006/' || current_setting('test.m1') || '/1.png',
        'b3000000-0000-4000-8000-000000000006/' || current_setting('test.m1') || '/2.png']);
select throws_ok(format($$ select public.admin_deliver_proposal(%L) $$, current_setting('test.m1p0')),
  'P0001', 'linkyo:incomplete', 'nor with two story pictures');
select public.admin_save_proposal(current_setting('test.m1')::uuid, '{"profile":{"displayName":"Mia"},"blocks":[]}', '{}', null, null,
  '{"bioInstagram":"Mode & Reisen","bioTiktok":"Mode","postingPlan":[{"week":1,"idea":"a"},{"week":2,"idea":"b"},{"week":3,"idea":""},{"week":4,"idea":"d"}]}',
  array['b3000000-0000-4000-8000-000000000006/' || current_setting('test.m1') || '/1.png',
        'b3000000-0000-4000-8000-000000000006/' || current_setting('test.m1') || '/2.png',
        'b3000000-0000-4000-8000-000000000006/' || current_setting('test.m1') || '/3.png']);
select throws_ok(format($$ select public.admin_deliver_proposal(%L) $$, current_setting('test.m1p0')),
  'P0001', 'linkyo:incomplete', 'nor with a week of the plan empty');
select public.admin_save_proposal(current_setting('test.m1')::uuid, '{"profile":{"displayName":"Mia"},"blocks":[]}', '{}', null, null,
  '{"bioInstagram":"Mode & Reisen","bioTiktok":"Mode","postingPlan":[{"week":1,"idea":"a"},{"week":2,"idea":"b"},{"week":3,"idea":"c"},{"week":4,"idea":"d"}]}');
select is(public.admin_deliver_proposal(current_setting('test.m1p0')::uuid) ->> 'hasKit', 'true',
  'with both bios, four weeks and three pictures it is delivered');
reset role;

-- ── 7. Revisions ────────────────────────────────────────────────────────────────────────────
select is(public.record_revision(current_setting('test.a1p1')::uuid, 'b3000000-0000-4000-8000-000000000001', 'Noch etwas',
  now() + interval '2 days'), 'noneLeft', 'Start allows one round');
select is(public.record_revision(current_setting('test.m1p0')::uuid, 'b3000000-0000-4000-8000-000000000002', 'x',
  now() + interval '2 days'), 'notFound', 'Ben cannot ask for changes to Mia''s proposal');
update public.orders set delivered_at = now() - interval '15 days' where id = current_setting('test.m1')::uuid;
select is(public.record_revision(current_setting('test.m1p0')::uuid, 'b3000000-0000-4000-8000-000000000006', 'x',
  now() + interval '2 days'), 'expired', 'more than 14 days after the first delivery it is too late');
update public.orders set delivered_at = now() - interval '1 day' where id = current_setting('test.m1')::uuid;
select is(public.record_revision(current_setting('test.m1p0')::uuid, 'b3000000-0000-4000-8000-000000000006', 'Mehr Farbe',
  now() + interval '2 days'), 'ok', 'within 14 days Premium asks for a revision');
select is(public.record_revision(current_setting('test.m1p0')::uuid, 'b3000000-0000-4000-8000-000000000006', 'Und noch',
  now() + interval '2 days'), 'locked', 'one revision at a time');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select set_config('test.m1p1', public.admin_save_proposal(current_setting('test.m1')::uuid,
  '{"profile":{"displayName":"Mia"},"blocks":[]}', '{"template":"daylight"}')::text, true);
reset role;

-- ── 8. Using a proposal ─────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.mark_proposal_applied(current_setting('test.a1p1')::uuid), 'notFound', 'Ben cannot use Ana''s proposal');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.mark_proposal_applied(current_setting('test.a1p0')::uuid), 'notFound', 'a superseded proposal is not offered');
select is(public.mark_proposal_applied(current_setting('test.a1p1')::uuid), 'ok', 'Ana uses hers');
select is((select status::text from public.site_proposals where id = current_setting('test.a1p1')::uuid), 'applied', 'it is marked applied');
select is(jsonb_array_length(public.my_proposals()), 0, 'and leaves the Home card');
select is(public.my_orders() -> 0 ->> 'id', current_setting('test.a1'), 'Ana lists her orders');
select is(public.my_order(current_setting('test.a1')::uuid) -> 'proposals' -> 0 ->> 'aiAssisted', 'false',
  'a proposal without AI blocks or AI profile text is the team''s');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.my_order(current_setting('test.a1')::uuid), null, 'nobody reads another account''s order');
reset role;

-- ── 9. Who has Pro ──────────────────────────────────────────────────────────────────────────
insert into public.entitlements (profile_id, product, source, status, current_period_end) values
  ('b3000000-0000-4000-8000-000000000008', 'pro', 'team', 'active', now() + interval '30 days');
select ok(public.has_pro('b3000000-0000-4000-8000-000000000008'), 'an active entitlement gives Pro');
update public.entitlements set current_period_end = now() - interval '1 second' where profile_id = 'b3000000-0000-4000-8000-000000000008';
select ok(not public.has_pro('b3000000-0000-4000-8000-000000000008'), 'not after its period ended');
insert into public.rewards (profile_id, kind) values ('b3000000-0000-4000-8000-000000000009', 'pro_for_life');
select ok(public.has_pro('b3000000-0000-4000-8000-000000000009'), 'Pro for life (invite program) gives Pro');
update public.rewards set revoked_at = now() where profile_id = 'b3000000-0000-4000-8000-000000000009';
select ok(not public.has_pro('b3000000-0000-4000-8000-000000000009'), 'a removed reward does not');
insert into public.subscriptions (profile_id, plan, status, started_at) values
  ('b3000000-0000-4000-8000-000000000010', 'pro', 'active', now());
select ok(public.has_pro('b3000000-0000-4000-8000-000000000010'), 'Pro the team set by hand counts');
select public.upsert_pro_subscription('b3000000-0000-4000-8000-000000000011', 'cus_stan', 'sub_stan', 'active',
  now() - interval '1 day', false);
select is((select plan::text || '/' || status::text from public.subscriptions where profile_id = 'b3000000-0000-4000-8000-000000000011'),
  'pro/active', 'a Stripe subscription is mirrored for the console');
select ok(not public.has_pro('b3000000-0000-4000-8000-000000000011'),
  'but a Stripe customer''s mirror never extends Pro past the period end');
select is(public.has_pro('b3000000-0000-4000-8000-000000000002'), false, 'a free account has no Pro');

-- ── 10. Stripe subscription states ──────────────────────────────────────────────────────────
select public.upsert_pro_subscription('b3000000-0000-4000-8000-000000000012', 'cus_vic', 'sub_vic', 'active',
  now() + interval '30 days', false);
select ok(public.has_pro('b3000000-0000-4000-8000-000000000012'), 'an active subscription gives Pro');
select public.upsert_pro_subscription('b3000000-0000-4000-8000-000000000012', 'cus_vic', 'sub_vic', 'canceled',
  now() + interval '30 days', false);
select is((select plan::text || '/' || coalesce(status::text, 'null') from public.subscriptions
  where profile_id = 'b3000000-0000-4000-8000-000000000012'), 'free/null', 'a canceled one mirrors as free');
select public.update_pro_subscription('sub_vic', 'refunded');
select public.upsert_pro_subscription('b3000000-0000-4000-8000-000000000012', 'cus_vic', 'sub_vic', 'active',
  now() + interval '60 days', false);
select is((select status::text from public.entitlements where stripe_subscription_id = 'sub_vic'), 'refunded',
  'refunded is final: a late event does not revive it');
select is(public.mark_pro_confirmation_sent('sub_vic'), true, 'the Pro e-mail goes out once');
select is(public.mark_pro_confirmation_sent('sub_vic'), false, 'and only once');
select throws_ok($$ select public.update_pro_subscription('sub_nobody', 'canceled') $$, 'P0001', 'linkyo:notFound',
  'unknown subscriptions are reported');

-- ── 11. Refunds and the money-back promise ──────────────────────────────────────────────────
select public.record_checkout_intent('cs_k1', 'b3000000-0000-4000-8000-000000000007', 'service-start', 'de');
select is(public.record_checkout_consent('cs_k1', 'b3000000-0000-4000-8000-000000000007', true, 'sofort', now(),
  now() + interval '1 day'), 'ok', 'Kai orders twice (1)');
select set_config('test.k1', public.record_service_order('cs_k1', 'pi_k1', 2499, 'kai@example.com') ->> 'id', true);
select public.record_checkout_intent('cs_k2', 'b3000000-0000-4000-8000-000000000007', 'service-start', 'de');
select is(public.record_checkout_consent('cs_k2', 'b3000000-0000-4000-8000-000000000007', true, 'sofort', now(),
  now() + interval '1 day'), 'ok', 'Kai orders twice (2)');
select set_config('test.k2', public.record_service_order('cs_k2', 'pi_k2', 2499, 'kai@example.com') ->> 'id', true);
-- Both delivered yesterday (fixtures; delivering itself is tested above).
update public.orders set status = 'delivered', delivered_at = now() - interval '1 day', confirmation_sent_at = now()
  where id in (current_setting('test.k1')::uuid, current_setting('test.k2')::uuid);
insert into public.site_proposals (order_id, profile_id, round, status, page, theme, delivered_at) values
  (current_setting('test.k1')::uuid, 'b3000000-0000-4000-8000-000000000007', 0, 'delivered', '{"profile":{},"blocks":[]}', '{}', now() - interval '1 day'),
  (current_setting('test.k2')::uuid, 'b3000000-0000-4000-8000-000000000007', 0, 'delivered', '{"profile":{},"blocks":[]}', '{}', now() - interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
select is(public.my_order(current_setting('test.k1')::uuid) ->> 'voluntaryRefundAvailable', 'true',
  'a first order delivered yesterday offers the money back');
reset role;
update public.orders set delivered_at = now() - interval '15 days' where id = current_setting('test.k1')::uuid;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
select is(public.my_order(current_setting('test.k1')::uuid) ->> 'voluntaryRefundAvailable', 'false',
  'one delivered 15 days ago does not');
reset role;
update public.orders set delivered_at = now() - interval '1 day' where id = current_setting('test.k1')::uuid;
select is(public.record_refund('pi_k1'), 'ok', 'the refund of the first order is recorded');
select is(public.record_refund('pi_k1'), 'ok', 'twice is harmless');
select is((select status::text || '/' || refund_kind from public.orders where id = current_setting('test.k1')::uuid),
  'refunded/voluntary', 'the order is refunded (voluntary)');
select is((select count(*)::int from public.order_events where order_id = current_setting('test.k1')::uuid and kind = 'refunded'), 1,
  'once');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is(public.admin_order_refund_target(current_setting('test.k2')::uuid),
  '{"paymentIntent":"pi_k2","amountCents":2499,"voluntaryUsed":true}'::jsonb,
  'the team sees that the account already used its money-back');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
select is(public.my_order(current_setting('test.k2')::uuid) ->> 'voluntaryRefundAvailable', 'false',
  'so the second order offers it no more (once per account)');
select is((select p ->> 'voluntaryRefundAvailable' from jsonb_array_elements(public.my_proposals()) p
  where p ->> 'orderId' = current_setting('test.k2')), 'false', 'neither does its Home card');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(format($$ select public.admin_order_refund_target(%L) $$, current_setting('test.k2')),
  '42501', 'linkyo:forbidden', 'refunds need billing.manage');
reset role;
select is(public.record_refund('pi_unknown'), 'notFound', 'an unknown payment is reported');
select throws_ok($$ select public.record_refund('pi_k2', 'gift') $$, 'P0001', 'linkyo:invalid', 'only known refund kinds');

select public.upsert_pro_subscription('b3000000-0000-4000-8000-000000000014', 'cus_xia', 'sub_xia', 'active',
  now() + interval '30 days', false);
select public.record_invoice('in_xia', 'b3000000-0000-4000-8000-000000000014', 'sub_xia', 800, 'paid', 'pi_in_xia');
select is(public.record_refund('pi_in_xia'), 'ok', 'a Pro invoice is found by its payment');
select is((select status from public.invoices where id = 'in_xia'), 'refunded', 'the invoice is refunded');
select is((select status::text from public.entitlements where stripe_subscription_id = 'sub_xia'), 'refunded',
  'and so is its entitlement');
select ok(not public.has_pro('b3000000-0000-4000-8000-000000000014'), 'which ends Pro');
select public.record_invoice('in_xia', 'b3000000-0000-4000-8000-000000000014', 'sub_xia', 800, 'paid');
select is((select status || '/' || payment_intent from public.invoices where id = 'in_xia'), 'refunded/pi_in_xia',
  'a late "paid" event keeps the refund and the payment');

-- ── 15. Capacity per day ────────────────────────────────────────────────────────────────────
-- Fixtures 60 days ahead: due (briefed), promised (not briefed), refunded; and one due tomorrow.
insert into public.orders (profile_id, customer_email, package, status, locale, amount_cents, vat_mode, early_start,
    start_after, promised_due_at, due_at, revisions_allowed, stripe_session_id, confirmation_sent_at, briefing, refunded_at) values
  ('b3000000-0000-4000-8000-000000000002', 'ben@example.com', 'start', 'queued', 'en', 2499, 'standard19', false,
    now(), now() + interval '59 days', public.berlin_midnight(((now() + interval '60 days') at time zone 'Europe/Berlin')::date) + interval '10 hours',
    1, 'cs_load_1', now(), '{}', null),
  ('b3000000-0000-4000-8000-000000000002', 'ben@example.com', 'start', 'awaiting_briefing', 'en', 2499, 'standard19', false,
    now(), public.berlin_midnight(((now() + interval '60 days') at time zone 'Europe/Berlin')::date) + interval '18 hours', null,
    1, 'cs_load_2', now(), null, null),
  ('b3000000-0000-4000-8000-000000000002', 'ben@example.com', 'start', 'refunded', 'en', 2499, 'standard19', false,
    now(), now(), public.berlin_midnight(((now() + interval '60 days') at time zone 'Europe/Berlin')::date) + interval '12 hours',
    1, 'cs_load_3', now(), null, now()),
  ('b3000000-0000-4000-8000-000000000002', 'ben@example.com', 'start', 'queued', 'en', 2499, 'standard19', false,
    now(), now(), now() + interval '1 day', 1, 'cs_soon', now(), '{}', null);
select is((select booked from public.service_load(((now() + interval '60 days') at time zone 'Europe/Berlin')::date, 1)), 2,
  'two orders due on one day count 2 (a refunded one does not)');
select is((select booked from public.service_load(((now() + interval '60 days') at time zone 'Europe/Berlin')::date, 1,
  (select id from public.orders where stripe_session_id = 'cs_load_1'))), 1, 'the order being rescheduled is left out');
select is((select count(*)::int from public.service_load(((now() + interval '59 days') at time zone 'Europe/Berlin')::date, 3)), 3,
  'one row per day asked for');
select is(public.service_capacity(), 4, 'four orders may fall due per day');

-- ── 12. Withdrawal ──────────────────────────────────────────────────────────────────────────
select set_config('test.w1', public.record_withdrawal(' Mia Moor ', 'MIA@Example.com',
  (select lower(number) from public.orders where id = current_setting('test.m1')::uuid), 'ip-mia') ->> 'id', true);
select is((select matched::text || '/' || suspect from public.withdrawals where id = current_setting('test.w1')::uuid), 'true/false',
  'a withdrawal matches the order by number and e-mail, whatever the case');
select is((select received_at from public.withdrawals where id = current_setting('test.w1')::uuid), now(),
  'it is received at the server''s time');
select is((select withdrawal_pending from public.orders where id = current_setting('test.m1')::uuid), true, 'work on the order stops');
select is((select count(*)::int from public.order_events where order_id = current_setting('test.m1')::uuid and kind = 'withdrawal_received'),
  1, 'and the timeline shows it');
select is(public.record_withdrawal('Mia', 'someone@example.com',
  (select number from public.orders where id = current_setting('test.m1')::uuid), 'ip-mia') -> 'matched', 'false'::jsonb,
  'with a wrong e-mail it does not match');
select is(public.record_withdrawal('Mia', 'someone@example.com',
  (select number from public.orders where id = current_setting('test.m1')::uuid), 'ip-mia') -> 'accountEmail', 'null'::jsonb,
  'and names no account');
select is(public.record_revision(current_setting('test.m1p0')::uuid, 'b3000000-0000-4000-8000-000000000006', 'x',
  now() + interval '2 days'), 'locked', 'no revision while a withdrawal waits');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(format($$ select public.admin_save_proposal(%L, '{"profile":{},"blocks":[]}', '{}') $$, current_setting('test.m1')),
  'P0001', 'linkyo:locked', 'the team cannot save');
select throws_ok(format($$ select public.admin_deliver_proposal(%L) $$, current_setting('test.m1p1')),
  'P0001', 'linkyo:locked', 'or deliver');
select ok(
  (select min(n) from jsonb_array_elements(public.admin_orders('open')) with ordinality as e (o, n)
   where o ->> 'id' = current_setting('test.m1'))
  < (select min(n) from jsonb_array_elements(public.admin_orders('open')) with ordinality as e (o, n)
     where o ->> 'withdrawalPending' = 'false'),
  'the order comes before every order without a withdrawal, even ones due sooner');
select is((select o ->> 'withdrawalPending' from jsonb_array_elements(public.admin_orders('open')) o
  where o ->> 'id' = current_setting('test.m1')), 'true', 'marked as waiting for a decision');
reset role;

select public.record_withdrawal('Flood', 'flood' || n || '@example.com', 'Vertrag', 'ip-flood') from generate_series(1, 10) n;
select is((select count(*)::int from public.withdrawals where email like 'flood%' and suspect), 0, 'ten in an hour are fine');
select is(public.record_withdrawal('Flood', 'flood11@example.com', 'Vertrag', 'ip-flood') -> 'suspect', 'true'::jsonb,
  'the 11th within an hour from one address is suspect');
select is((select count(*)::int from public.withdrawals where email = 'flood11@example.com'), 1, 'but still stored');
insert into public.withdrawals (name, email, contract, receipt_sent_at) values
  ('M', 'many@example.com', 'x', now() - interval '1 hour'), ('M', 'many@example.com', 'x', now() - interval '2 hours'),
  ('M', 'many@example.com', 'x', now() - interval '3 hours');
select is(public.record_withdrawal('M', 'Many@example.com', 'x', 'ip-many') -> 'suspect', 'true'::jsonb,
  'a fourth receipt to one mailbox within a day is held');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select throws_ok(format($$ select public.admin_resolve_withdrawal(%L, 'rejected') $$, current_setting('test.w1')),
  'P0001', 'linkyo:invalid', 'rejecting a withdrawal needs a note');
select is(public.admin_resolve_withdrawal(current_setting('test.w1')::uuid, 'rejected',
  'Leistung nach Verlangen vollständig erbracht') ->> 'paymentIntent', 'pi_m1', 'with a note it is rejected');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(format($$ select public.admin_save_proposal(%L, '{"profile":{"displayName":"Mia"},"blocks":[]}', '{}') $$,
  current_setting('test.m1')), 'and work resumes');
reset role;
select is((select withdrawal_pending from public.orders where id = current_setting('test.m1')::uuid), false, 'the order is free again');
select is((select booked from public.service_load(((now() + interval '16 days') at time zone 'Europe/Berlin')::date, 1)), 1,
  'and counts toward its day');
select set_config('test.w2', public.record_withdrawal('Mia', 'mia@example.com',
  (select number from public.orders where id = current_setting('test.m1')::uuid), 'ip-mia') ->> 'id', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is(public.admin_resolve_withdrawal(current_setting('test.w2')::uuid, 'accepted', null, 7999),
  '{"paymentIntent":"pi_m1","subscription":null,"accountEmail":"mia@example.com","locale":"de"}'::jsonb,
  'an accepted withdrawal tells the route what to refund');
select throws_ok(format($$ select public.admin_resolve_withdrawal(%L, 'rejected', 'x') $$, current_setting('test.w2')),
  'P0001', 'linkyo:locked', 'a decided withdrawal stays decided');
reset role;
select is(public.record_refund('pi_m1', 'withdrawal', 7999), 'ok', 'the refund is recorded as a withdrawal');
select is((select status::text || '/' || (withdrawn_at is not null) || '/' || withdrawal_pending from public.orders
  where id = current_setting('test.m1')::uuid), 'withdrawn/true/false', 'the order is withdrawn');
select is((select booked from public.service_load(((now() + interval '16 days') at time zone 'Europe/Berlin')::date, 1)), 0,
  'and no longer counts toward capacity');

select public.upsert_pro_subscription('b3000000-0000-4000-8000-000000000013', 'cus_wes', 'sub_wes', 'active',
  now() + interval '20 days', false);
select public.record_invoice('in_wes', 'b3000000-0000-4000-8000-000000000013', 'sub_wes', 800, 'paid', 'pi_in_wes');
select is(public.record_withdrawal('Wes', 'WES@example.com', 'Linkyo Pro', 'ip-wes') ->> 'accountEmail', 'wes@example.com',
  'a Pro withdrawal matches the account by its e-mail');

-- ── 13. Cancellation ────────────────────────────────────────────────────────────────────────
select set_config('test.c1', public.record_cancellation('ordinary', 'Wes', ' WES@example.com ', 'pro-monthly',
  'wes@example.com', 'ip-wes') ->> 'id', true);
select is((select matched from public.cancellations where id = current_setting('test.c1')::uuid), true,
  'a cancellation matches the account with an active Stripe Pro');
select is(public.record_cancellation('ordinary', 'Wes', 'wes@example.com', 'pro-monthly', 'wes@example.com', 'ip-wes')
  ->> 'subscription', 'sub_wes', 'and tells the server which subscription');
select is(public.record_cancellation('ordinary', 'X', 'nobody@example.com', 'pro-monthly', 'x@example.com', 'ip-x')
  -> 'matched', 'false'::jsonb, 'an unknown address is stored unmatched');
select throws_ok($$ select public.record_cancellation('ordinary', 'Wes', 'wes@example.com', 'pro-monthly',
  'wes@example.com', 'ip-wes', reason => 'x') $$, '23514', null, 'an ordinary cancellation carries no reason');
select set_config('test.c2', public.record_cancellation('extraordinary', 'Wes', 'wes@example.com', 'pro-monthly',
  'wes@example.com', 'ip-wes', reason => ' Umzug ins Ausland ', wanted => current_date + 3) ->> 'id', true);
select is((select reason || '/' || (wanted_date = current_date + 3) from public.cancellations
  where id = current_setting('test.c2')::uuid), 'Umzug ins Ausland/true', 'an extraordinary one keeps its reason and the wanted date');
select public.confirm_cancellation(current_setting('test.c1')::uuid, 'scheduled',
  (select current_period_end from public.entitlements where stripe_subscription_id = 'sub_wes'));
select is((select cancel_at_period_end::text || '/' || coalesce(cancel_at::text, 'null') from public.entitlements
  where stripe_subscription_id = 'sub_wes'), 'true/null', 'scheduled for the period end');
select public.confirm_cancellation(current_setting('test.c1')::uuid, 'scheduled',
  (select current_period_end + interval '30 days' from public.entitlements where stripe_subscription_id = 'sub_wes'));
select is((select cancel_at_period_end::text || '/' || (cancel_at = current_period_end + interval '30 days') from public.entitlements
  where stripe_subscription_id = 'sub_wes'), 'false/true', 'scheduled for a later date');
select public.confirm_cancellation(current_setting('test.c1')::uuid, 'resumed');
select is((select cancel_at_period_end::text || '/' || coalesce(cancel_at::text, 'null') from public.entitlements
  where stripe_subscription_id = 'sub_wes'), 'false/null', 'resumed clears both');
select is((select decision || '/' || (handled_at is not null) from public.cancellations where id = current_setting('test.c1')::uuid),
  'resumed/true', 'and is a decision');

-- ── 14. Who handles contract requests ───────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select throws_ok(format($$ select public.admin_resolve_cancellation(%L, 'resumed', null) $$, current_setting('test.c1')),
  'P0001', 'linkyo:invalid', 'taking a cancellation back needs the holder''s request as a note');
select is(public.admin_resolve_cancellation(current_setting('test.c1')::uuid, 'resumed', 'Bitte doch weiter (Mail vom Konto)'),
  '{"subscription":"sub_wes","accountEmail":"wes@example.com"}'::jsonb, 'with it the team resumes');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.admin_contract_requests() $$, '42501', 'linkyo:forbidden', 'customers see no requests');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.admin_contract_requests() $$, '42501', 'linkyo:forbidden', 'editors neither (billing.view)');
select is_empty($$ select 1 from public.withdrawals $$, 'nor read the table');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select (r ->> 'refundDueAt')::timestamptz from jsonb_array_elements(public.admin_contract_requests()) r
  where r ->> 'id' = current_setting('test.w2')), now() + interval '14 days', 'a viewer reads them, with the refund deadline');
select is(public.admin_contract_requests() -> 0 ->> 'handledAt', null, 'unhandled requests come first');
select throws_ok(format($$ select public.admin_mark_contract_handled('withdrawal', %L) $$, current_setting('test.w1')),
  '42501', 'linkyo:forbidden', 'but cannot mark one handled');
select throws_ok(format($$ select public.admin_resolve_withdrawal(%L, 'accepted') $$, current_setting('test.w1')),
  '42501', 'linkyo:forbidden', 'or decide a withdrawal');
select throws_ok(format($$ select public.admin_resolve_cancellation(%L, 'ended', 'x') $$, current_setting('test.c1')),
  '42501', 'linkyo:forbidden', 'or a cancellation');
select set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select lives_ok($$ select public.admin_mark_contract_handled('withdrawal',
  (select id from public.withdrawals where email = 'flood11@example.com'), 'Spam') $$, 'the owner marks a request handled');
reset role;
select is((select note from public.withdrawals where email = 'flood11@example.com'), 'Spam', 'with the note');
select is((select count(*)::int from public.audit_log where at = now() and action in ('withdrawal.rejected',
  'withdrawal.accepted', 'cancellation.resumed', 'withdrawal.handled')), 4, 'every decision is in the activity log');

-- ── 16. Retention ───────────────────────────────────────────────────────────────────────────
insert into public.orders (profile_id, customer_email, package, status, locale, amount_cents, vat_mode, early_start,
    start_after, promised_due_at, revisions_allowed, stripe_session_id, delivered_at, completed_at, briefing) values
  ('b3000000-0000-4000-8000-000000000002', 'ben@example.com', 'start', 'delivered', 'en', 2499, 'standard19', false,
    now(), now(), 1, 'cs_old_delivered', now() - interval '15 days', null, '{"wishes":"a"}'),
  ('b3000000-0000-4000-8000-000000000002', 'ben@example.com', 'start', 'completed', 'en', 2499, 'standard19', false,
    now(), now(), 1, 'cs_old_completed', now() - interval '60 days', now() - interval '31 days', '{"wishes":"b"}'),
  ('b3000000-0000-4000-8000-000000000015', 'zoe@example.com', 'start', 'queued', 'de', 2499, 'standard19', false,
    now(), now(), 1, 'cs_zoe', null, null, '{"wishes":"c"}');
insert into public.withdrawals (received_at, name, email, contract) values
  (now() - interval '3 years 1 day', 'Old', 'old@example.com', 'x'),
  (now() - interval '1 day', 'New', 'new@example.com', 'x');
select ok((public.service_maintenance() ->> 'completed')::int >= 1, 'the daily job runs');
select is((select status::text from public.orders where stripe_session_id = 'cs_old_delivered'), 'completed',
  'a delivered order 15 days after its first delivery is completed');
select is((select count(*)::int from public.order_events e join public.orders o on o.id = e.order_id
  where o.stripe_session_id = 'cs_old_delivered' and e.kind = 'completed'), 1, 'with a timeline entry');
select is((select briefing from public.orders where stripe_session_id = 'cs_old_completed'), null,
  'a briefing is forgotten 30 days after the order ended');
select is((select array_agg(bucket || ':' || prefix) from public.storage_purge where prefix like 'b3000000-0000-4000-8000-000000000002/%'),
  array['briefing:b3000000-0000-4000-8000-000000000002/' || (select id from public.orders where stripe_session_id = 'cs_old_completed') || '/'],
  'and its photos are queued for deletion through the Storage API');
select isnt((select id from public.orders where stripe_session_id = 'cs_old_completed'), null, 'the order itself is kept');
select is((select array_agg(name) from public.withdrawals where name in ('Old', 'New')), array['New'],
  'withdrawals are deleted after 3 years, newer ones kept');
select isnt((select jobid from cron.job where jobname = 'linkyo-service-maintenance'), null, 'every night');
select isnt((select jobid from cron.job where jobname = 'linkyo-purge-form-limits'), null, 'form limits are purged nightly');
insert into public.form_limits (ip_hash, form, at) values ('ip-old', 'withdrawal', now() - interval '2 days');
select is(public.purge_form_limits(), 1, 'after a day');
delete from auth.users where id = 'b3000000-0000-4000-8000-000000000015';
select is((select briefing from public.orders where stripe_session_id = 'cs_zoe'), null,
  'a deleted account leaves no briefing behind');
select is((select coalesce(profile_id::text, 'gone') from public.orders where stripe_session_id = 'cs_zoe'), 'gone',
  'and the order no longer names the person');

select * from finish();
rollback;
