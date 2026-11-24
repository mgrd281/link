-- Team money and permissions (Stage 1 WP1.1, migration 20261124100100_admin_money): money moves only
-- through Stripe (the team's refund, cancel and resume are decisions the server carries out), the
-- orders.view and customers.export permissions, editors without customer e-mail addresses, and where
-- Pro comes from. Checked as our server (postgres), customers and every team role.
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- People: Olga owns the team, Ada is an admin, Eli an editor, Vic a viewer. Cleo pays for Pro through
-- Stripe and bought the page service; Tom got Pro from the team by hand; Fay is on Free.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at) values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olga@example.com', '{"username":"olga-m"}', '{}', now(), now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ada@example.com', '{"username":"ada-m"}', '{}', now(), now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eli@example.com', '{"username":"eli-m"}', '{}', now(), now(), now()),
  ('e1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vic@example.com', '{"username":"vic-m"}', '{}', now(), now(), now()),
  ('e1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cleo@example.com', '{"username":"cleo-m","locale":"en"}', '{}', now(), now(), now()),
  ('e1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tom@example.com', '{"username":"tom-m"}', '{}', now(), now(), now()),
  ('e1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fay@example.com', '{"username":"fay-m"}', '{}', now(), now(), now());
insert into public.sites (profile_id, onboarded, theme, page) values
  ('e1000000-0000-4000-8000-000000000005', true, '{"template":"nocturne"}', '{"profile":{"displayName":"Cleo Brandt"},"blocks":[]}'),
  ('e1000000-0000-4000-8000-000000000006', true, '{"template":"daylight"}', '{"profile":{"displayName":"Tom Weber"},"blocks":[]}');
select public.record_sign_in('cleo@example.com', 'success', '198.51.100.21', '{}', 'cleo-phone', 'DE', 'Köln', null, null);
delete from public.team_members;
insert into public.team_members (user_id, role) values
  ('e1000000-0000-4000-8000-000000000001', 'owner'),
  ('e1000000-0000-4000-8000-000000000002', 'admin'),
  ('e1000000-0000-4000-8000-000000000003', 'editor'),
  ('e1000000-0000-4000-8000-000000000004', 'viewer');

-- Cleo's Stripe Pro (as the webhook writes it) with a paid and a failed invoice; Tom's Pro by hand.
select public.upsert_pro_subscription('e1000000-0000-4000-8000-000000000005', 'cus_cleo', 'sub_cleo', 'active',
  now() + interval '20 days', false);
select public.record_invoice('in_cleo_1', 'e1000000-0000-4000-8000-000000000005', 'sub_cleo', 800, 'paid', 'pi_cleo_1');
select public.record_invoice('in_cleo_0', 'e1000000-0000-4000-8000-000000000005', 'sub_cleo', 800, 'failed', 'pi_cleo_0');
insert into public.subscriptions (profile_id, plan, status, started_at) values
  ('e1000000-0000-4000-8000-000000000006', 'pro', 'active', now() - interval '3 days');
-- Cleo's page-service order, confirmed, with a timeline entry she wrote herself (as the owner function does).
select public.record_checkout_intent('cs_cleo', 'e1000000-0000-4000-8000-000000000005', 'service-start', 'en');
select is(public.record_checkout_consent('cs_cleo', 'e1000000-0000-4000-8000-000000000005', true, 'Start now.', now(),
  now() + interval '2 days'), 'ok', 'Cleo orders the page service');
select set_config('test.order', public.record_service_order('cs_cleo', 'pi_cleo_order', 2499, 'cleo@example.com', 'Cleo Brandt') ->> 'id', true);
select public.mark_confirmation_sent(current_setting('test.order')::uuid);
insert into public.order_events (order_id, actor, kind) values
  (current_setting('test.order')::uuid, 'e1000000-0000-4000-8000-000000000005', 'note');

-- ── 1. The role table ───────────────────────────────────────────────────────────────────────
select results_eq(
  $$ select role::text as name, count(*)::int from public.role_permissions group by role order by name $$,
  $$ values ('admin', 16), ('editor', 5), ('owner', 18), ('viewer', 6) $$,
  'roles have the same number of permissions as in the app (types.ts)'
);
select results_eq(
  $$ select role::text from public.role_permissions where permission = 'orders.view' order by role $$,
  $$ values ('admin'), ('editor'), ('owner'), ('viewer') $$,
  'every role reads the page-service orders'
);
select results_eq(
  $$ select role::text from public.role_permissions where permission = 'customers.export' order by role $$,
  $$ values ('admin'), ('owner') $$,
  'only owners and admins export the customer list'
);
select results_eq(
  $$ select role::text from public.role_permissions where permission = 'customers.view' order by role $$,
  $$ values ('admin'), ('owner'), ('viewer') $$,
  'editors no longer see customers'
);
select results_eq(
  $$ select permission from public.role_permissions where role = 'editor' order by permission $$,
  $$ values ('activity.view'), ('analytics.view'), ('orders.view'), ('pages.create'), ('pages.edit') $$,
  'an editor builds pages, works on orders, and reads activity and analytics'
);

-- ── 2. The old refund is the server's alone ─────────────────────────────────────────────────
select ok(not has_function_privilege('authenticated', 'public.admin_refund_invoice(text)', 'execute'),
  'the browser cannot mark an invoice refunded');
select ok(has_function_privilege('service_role', 'public.admin_refund_invoice(text)', 'execute'), 'only our server can');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$ select public.admin_refund_invoice('in_cleo_1') $$, '42501', null, 'not even an owner');
reset role;
select is((select status from public.invoices where id = 'in_cleo_1'), 'paid', 'the invoice stays paid');

-- ── 3. Refunding a Pro invoice: the member decides, Stripe refunds, the server records ──────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_1') $$,
  '42501', 'linkyo:forbidden', 'an editor cannot refund');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_1') $$,
  '42501', 'linkyo:forbidden', 'nor a viewer');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_1') $$,
  '42501', 'linkyo:forbidden', 'nor the customer');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_1'),
  '{"paymentIntent":"pi_cleo_1","amountCents":800,"locale":"en"}'::jsonb, 'an admin gets what to refund');
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000006', 'in_cleo_1') $$,
  'P0001', 'linkyo:notFound', 'only the customer''s own invoice');
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_0') $$,
  'P0001', 'linkyo:locked', 'a failed invoice has nothing to refund');
reset role;
select is((select actor || ' ' || action || ' ' || target || ' ' || (details ->> 'invoice') from public.audit_log
  where action = 'customer.refund' order by id desc limit 1), 'ada@example.com customer.refund cleo-m in_cleo_1',
  'the decision is logged with its member before Stripe is asked');
select is((select status from public.invoices where id = 'in_cleo_1'), 'paid', 'and nothing says "refunded" yet');
-- While a withdrawal of the subscription waits, its refund is decided there, not here.
select public.record_invoice('in_cleo_2', 'e1000000-0000-4000-8000-000000000005', 'sub_cleo', 800, 'paid', 'pi_cleo_2');
create temp table open_withdrawal as
  select public.record_withdrawal('Cleo Brandt', 'cleo@example.com', 'Linkyo Pro', 'ip-cleo') ->> 'id' as id;
select isnt((select entitlement_id from public.withdrawals where id = (select id::uuid from open_withdrawal)), null,
  'Cleo withdraws from Pro');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_2') $$,
  'P0001', 'linkyo:locked', 'a refund waits while a withdrawal of the subscription is open');
reset role;
update public.withdrawals set decision = 'rejected', handled_at = now() where id = (select id::uuid from open_withdrawal);
-- Stripe refunded: the route records it as the server, as Stripe's webhook would.
select is(public.record_refund('pi_cleo_1', 'goodwill', 800), 'ok', 'the server records Stripe''s refund');
select is((select status from public.invoices where id = 'in_cleo_1'), 'refunded', 'now the invoice is refunded');
select is((select status::text from public.entitlements where stripe_subscription_id = 'sub_cleo'), 'active',
  'and Pro goes on (only a withdrawal ends the contract)');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_1') $$,
  'P0001', 'linkyo:locked', 'a refunded invoice is not refunded twice');
reset role;

-- ── 4. Cancel and resume a Stripe subscription ──────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok($$ select public.admin_pro_subscription_target('e1000000-0000-4000-8000-000000000005', 'cancel') $$,
  '42501', 'linkyo:forbidden', 'an editor cannot cancel');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(public.admin_pro_subscription_target('e1000000-0000-4000-8000-000000000005', 'cancel') - 'periodEnd',
  '{"subscription":"sub_cleo","stripeCustomer":"cus_cleo","cancelAtPeriodEnd":false,"locale":"en"}'::jsonb,
  'the owner gets the Stripe subscription to cancel');
select throws_ok($$ select public.admin_pro_subscription_target('e1000000-0000-4000-8000-000000000006', 'cancel') $$,
  'P0001', 'linkyo:notFound', 'Pro the team gave has no Stripe subscription');
select throws_ok($$ select public.admin_pro_subscription_target('e1000000-0000-4000-8000-000000000005', 'refund') $$,
  'P0001', 'linkyo:invalidAction', 'only cancel and resume');
reset role;
select is((select action || ' ' || target from public.audit_log where action like 'customer.%' order by id desc limit 1),
  'customer.cancel cleo-m', 'the cancellation is logged');
-- Stripe set cancel_at_period_end: the route records the subscription as the server.
select public.upsert_pro_subscription('e1000000-0000-4000-8000-000000000005', 'cus_cleo', 'sub_cleo', 'active',
  (select current_period_end from public.entitlements where stripe_subscription_id = 'sub_cleo'), true);
select is((select cancel_at_period_end from public.entitlements where stripe_subscription_id = 'sub_cleo'), true,
  'the subscription ends with its period');

-- ── 5. Where Pro comes from ─────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
create temp table seen_by_viewer as select c from jsonb_array_elements(public.admin_customers()) c;
reset role;
select is((select c -> 'subscription' ->> 'source' from seen_by_viewer where c ->> 'username' = 'cleo-m'), 'stripe',
  'a Stripe subscription says so');
select is((select (c -> 'subscription' ->> 'cancelAtPeriodEnd')::boolean from seen_by_viewer where c ->> 'username' = 'cleo-m'), true,
  'with its end at the period end');
select is((select (c -> 'subscription' ->> 'endsAt')::timestamptz from seen_by_viewer where c ->> 'username' = 'cleo-m'),
  (select current_period_end from public.entitlements where stripe_subscription_id = 'sub_cleo'), 'and the date');
select is((select c -> 'subscription' ->> 'source' from seen_by_viewer where c ->> 'username' = 'tom-m'), 'team',
  'Pro by hand is the team''s');
select is((select c -> 'subscription' ->> 'source' from seen_by_viewer where c ->> 'username' = 'fay-m'), null,
  'Free has no source');
select is((select c ->> 'email' from seen_by_viewer where c ->> 'username' = 'cleo-m'), 'cleo@example.com',
  'a viewer sees the customer''s address');

-- ── 6. Editors: orders and numbers, no customer addresses ───────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
create temp table seen_by_editor as select c from jsonb_array_elements(public.admin_customers()) c;
select is((select count(*)::int from seen_by_editor where c ->> 'username' in ('cleo-m', 'tom-m', 'fay-m')), 3,
  'an editor counts customers for Overview and Analytics');
select is((select count(*)::int from seen_by_editor where c ->> 'email' is not null), 0, 'without any e-mail address');
select is((select c ->> 'name' from seen_by_editor where c ->> 'username' = 'cleo-m'), 'cleo-m', 'or name');
select is((select c ->> 'city' from seen_by_editor where c ->> 'username' = 'cleo-m'), null, 'or city');
select is((select c -> 'subscription' ->> 'source' from seen_by_editor where c ->> 'username' = 'cleo-m'), null,
  'or billing details');
select is((select c ->> 'country' from seen_by_editor where c ->> 'username' = 'cleo-m'), 'DE', 'but with the country');
select ok(exists (select 1 from jsonb_array_elements(public.admin_orders('all')) o where o ->> 'id' = current_setting('test.order')),
  'an editor opens the order queue');
select is((select o -> 'customer' ->> 'email' from jsonb_array_elements(public.admin_orders('all')) o
  where o ->> 'id' = current_setting('test.order')), null, 'without the customer''s address');
select is((select o -> 'customer' ->> 'username' from jsonb_array_elements(public.admin_orders('all')) o
  where o ->> 'id' = current_setting('test.order')), 'cleo-m', 'but with the page address');
select is(public.admin_order(current_setting('test.order')::uuid) -> 'customer' ->> 'email', null,
  'an editor opens the order, without the address');
select is(public.admin_order(current_setting('test.order')::uuid) -> 'customer' ->> 'name', 'Cleo Brandt', 'with the name');
select is((select e ->> 'actor' from jsonb_array_elements(public.admin_order(current_setting('test.order')::uuid) -> 'events') e
  where e ->> 'kind' = 'note'), null, 'the timeline does not name the customer by address either');
select is((select count(*)::int from public.orders where id = current_setting('test.order')::uuid), 1, 'the order row is readable');
select throws_ok($$ select customer_email from public.orders $$, '42501', null, 'but not the address in it');
select is((select count(*)::int from public.order_events where order_id = current_setting('test.order')::uuid) > 0, true,
  'the timeline is readable');
select lives_ok($$ select public.admin_referral_queue() $$, 'the Referrals screen opens');
select throws_ok($$ select public.admin_customers_exported(3) $$, '42501', 'linkyo:forbidden', 'no export');
select is_empty($$ select 1 from public.customer_notes $$, 'no notes about customers');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is((select o -> 'customer' ->> 'email' from jsonb_array_elements(public.admin_orders('all')) o
  where o ->> 'id' = current_setting('test.order')), 'cleo@example.com', 'a viewer sees the order''s address');
select is((select e ->> 'actor' from jsonb_array_elements(public.admin_order(current_setting('test.order')::uuid) -> 'events') e
  where e ->> 'kind' = 'note'), 'cleo@example.com', 'and who wrote a timeline entry');
select throws_ok($$ select public.admin_customers_exported(3) $$, '42501', 'linkyo:forbidden', 'a viewer does not export');
reset role;

-- Customers: their own order without the address column, no team reads.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
select is((select number from public.orders where id = current_setting('test.order')::uuid),
  (select number from public.orders where id = current_setting('test.order')::uuid), 'the customer reads her own order');
select throws_ok($$ select public.admin_orders() $$, '42501', 'linkyo:forbidden', 'customers cannot open the queue');
select throws_ok($$ select public.admin_customers() $$, '42501', 'linkyo:forbidden', 'or the customer list');
select throws_ok($$ select public.admin_referral_queue() $$, '42501', 'linkyo:forbidden', 'or the referral queue');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.admin_pro_refund_target('e1000000-0000-4000-8000-000000000005', 'in_cleo_1') $$,
  '42501', null, 'visitors call no money function');
reset role;

-- ── 7. The export is logged ─────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($$ select public.admin_customers_exported(42) $$, 'an admin exports');
select throws_ok($$ select public.admin_customers_exported(-1) $$, 'P0001', 'linkyo:invalid', 'a real row count');
reset role;
select is((select actor || ' ' || action || ' ' || (details ->> 'rows') from public.audit_log order by id desc limit 1),
  'ada@example.com customer.export 42', 'with who and how many rows');

select * from finish();
rollback;
