-- The invite program (ADR 0064): codes, sign-up attribution, the server's checks, counting,
-- rewards (never revenue), verification requests, team actions and privacy. Run as a customer, a
-- visitor (anon), our server (postgres), a team owner, an editor and a viewer.
-- Run: pnpm db:test. Everything happens in one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ── Helpers for this file (temporary, called as postgres only) ──────────────────────────────
-- Ids and codes are kept in settings, so they can be read under any role (row-level security
-- would hide other people's profiles from the temporary functions).
create function pg_temp.uid(handle text) returns uuid
language sql stable as $$
  select nullif(current_setting('test.id_' || handle, true), '')::uuid;
$$;

create function pg_temp.code(handle text) returns text
language sql stable as $$
  select nullif(current_setting('test.code_' || handle, true), '');
$$;

/** A new account, as GoTrue makes it: user metadata with the page address and an invite code. */
create function pg_temp.person(handle text, address text, ref text default null, confirmed boolean default true) returns uuid
language plpgsql as $$
declare
  made uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
  values (made, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address,
    jsonb_strip_nulls(jsonb_build_object('username', handle, 'locale', 'en', 'ref', ref)), '{}', now(), now(),
    case when confirmed then now() end);
  perform set_config('test.id_' || handle, made::text, true);
  perform set_config('test.code_' || handle, (select referral_code from public.profiles where id = made), true);
  return made;
end;
$$;

/** One successful sign-in in the security log, as our server writes it. */
create function pg_temp.seen(handle text, ip inet, device text, sig text default null) returns void
language sql as $$
  insert into public.sign_ins (profile_id, result, ip, device_id, signature)
  select pg_temp.uid(handle), 'success', ip, device, sig;
$$;

create function pg_temp.settle(handle text) returns text
language sql as $$
  select public.settle_referral(pg_temp.uid(handle));
$$;

create function pg_temp.referral(handle text) returns public.referrals
language sql stable as $$
  select * from public.referrals where invitee_id = pg_temp.uid(handle);
$$;

/** The next statements run as this account (after `set local role authenticated`). */
create function pg_temp.act_as(handle text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', pg_temp.uid(handle), 'role', 'authenticated')::text, true);
end;
$$;

/** Our server or the hourly job: no signed-in user (the log says "system"). */
create function pg_temp.as_server() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- People: Ana, Ivy, Lou and Sam invite friends; Ben is a customer; Cara owns the team, Eli edits,
-- Dan views. Only this test's team (everything is rolled back).
select pg_temp.person('ana', 'ana@example.com');
select pg_temp.person('ivy', 'ivy@example.com');
select pg_temp.person('lou', 'lou@example.com');
select pg_temp.person('sam', 'sam@example.com');
select pg_temp.person('ben', 'ben@example.com');
select pg_temp.person('cara', 'cara@example.com');
select pg_temp.person('eli', 'eli@example.com');
select pg_temp.person('dan', 'dan@example.com');
delete from public.team_members;
select public.make_owner('cara@example.com');
insert into public.team_members (user_id, role) values (pg_temp.uid('eli'), 'editor'), (pg_temp.uid('dan'), 'viewer');
-- Ana finished the welcome flow, so her page name may show to the people she invites.
insert into public.sites (profile_id, onboarded, theme, page) values
  (pg_temp.uid('ana'), true, '{}', '{"profile":{"displayName":"Ana Lund"},"blocks":[]}');

-- ── 1. Codes ────────────────────────────────────────────────────────────────────────────────
select is((select count(*)::int from public.profiles where referral_code is null or referral_code !~ '^[2-9a-hjkmnp-z]{8}$'), 0,
  'every account gets a code of 8 unambiguous symbols');
select is((select count(distinct referral_code)::int from public.profiles), (select count(*)::int from public.profiles),
  'codes are unique');
select col_not_null('public', 'profiles', 'referral_code', 'no account is without a code');
select col_has_default('public', 'profiles', 'referral_code', 'the database makes the code');
select matches(public.new_referral_code(), '^[2-9a-hjkmnp-z]{8}$', 'the generator uses only the 31 symbols');

select pg_temp.act_as('ana');
set local role authenticated;
select is((select referral_code from public.profiles), pg_temp.code('ana'), 'owners read their own code');
select throws_ok($$ update public.profiles set referral_code = '22222222' $$, '42501', null,
  'but cannot choose or change it');
select throws_ok($$ select public.new_referral_code() $$, '42501', null, 'nor make codes');
reset role;
select pg_temp.as_server();

-- ── 2. Sign-up ──────────────────────────────────────────────────────────────────────────────
select pg_temp.person('eve', 'eve@example.com', pg_temp.code('ana'));
select is((pg_temp.referral('eve')).inviter_id, pg_temp.uid('ana'), 'signing up with a code remembers the inviter');
select is((pg_temp.referral('eve')).state::text, 'pending', 'as pending until the checks have run');
select pg_temp.person('eva', 'eva@example.com', upper(pg_temp.code('ana')));
select is((pg_temp.referral('eva')).inviter_id, pg_temp.uid('ana'), 'a code typed in capitals still counts');
select pg_temp.person('una', 'una@example.com', 'zzzzzzzz');
select pg_temp.person('mal', 'mal@example.com', 'ana-link!');
select pg_temp.person('nob', 'nob@example.com');
select is((select count(*)::int from public.referrals where invitee_id in (pg_temp.uid('una'), pg_temp.uid('mal'), pg_temp.uid('nob'))), 0,
  'an unknown, a malformed or no code: no invite');
select isnt(pg_temp.uid('mal'), null, 'and the sign-up still works');
select throws_ok(format($$ insert into public.referrals (inviter_id, invitee_id) values (%L, %L) $$, pg_temp.uid('ivy'), pg_temp.uid('eve')),
  '23505', null, 'an account has one inviter, never a second');
select throws_ok(format($$ insert into public.referrals (inviter_id, invitee_id) values (%L, %L) $$, pg_temp.uid('ben'), pg_temp.uid('ben')),
  '23514', null, 'nobody invites themselves');
update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('ref', pg_temp.code('ana')) where id = pg_temp.uid('ben');
select is((select count(*)::int from public.referrals where invitee_id = pg_temp.uid('ben')), 0,
  'existing accounts are never attributed later');

-- ── 3. Access ───────────────────────────────────────────────────────────────────────────────
select pg_temp.act_as('ana');
set local role authenticated;
select throws_ok($$ select 1 from public.referrals $$, '42501', null, 'customers cannot read invites directly');
select throws_ok($$ select 1 from public.verification_requests $$, '42501', null, 'nor verification requests');
select throws_ok($$ insert into public.rewards (profile_id, kind) select id, 'pro_for_life' from public.profiles $$,
  '42501', null, 'nor give themselves a reward');
select throws_ok($$ select public.settle_referral((select id from public.profiles)) $$, '42501', null,
  'only our server settles an invite');
select throws_ok($$ select public.settle_pending_referrals() $$, '42501', null, 'and only the hourly job settles the rest');
select throws_ok($$ select public.email_identity('a@example.com') $$, '42501', null, 'the helpers are internal');
select is_empty($$ select 1 from public.disposable_domains $$, 'the throwaway list is not readable');
select throws_ok($$ select public.admin_referral_queue() $$, '42501', 'linkyo:forbidden', 'customers cannot open the queue');
select throws_ok(format($$ select public.admin_customer_referrals(%L) $$, pg_temp.uid('ben')), '42501', 'linkyo:forbidden',
  'nor another customer''s invites');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.referral_inviter(pg_temp.code('ana')), '{"name": "Ana Lund"}'::jsonb, 'visitors look an invite code up');
select throws_ok($$ select public.my_referrals() $$, '42501', null, 'but nothing else of the program');
select throws_ok($$ select public.request_verification('{https://example.com/a}') $$, '42501', null, 'cannot ask for a review');
select throws_ok($$ select public.admin_referral_queue() $$, '42501', null, 'nor open the team''s queue');
select is_empty($$ select 1 from public.rewards $$, 'and read no rewards');
reset role;
select pg_temp.as_server();

-- ── 4. Helpers (mirrored by emailIdentity() in the app) ─────────────────────────────────────
select is(public.email_identity('A.b+x@gmail.com'), 'ab@gmail.com', 'Gmail ignores dots and +tags');
select is(public.email_identity(' Mila.Kade+test@GoogleMail.com '), 'milakade@gmail.com', 'Googlemail is Gmail');
select is(public.email_identity('Mila.Kade+news@Example.com'), 'mila.kade@example.com', 'other domains keep their dots');
select ok(public.same_network('203.0.113.10', '203.0.113.10'), 'one IPv4 address is one network');
select ok(not public.same_network('203.0.113.10', '203.0.113.11'), 'a neighbour is not');
select ok(public.same_network('2001:db8:0:1::1', '2001:db8:0:1::2'), 'one IPv6 /64 is one household');
select ok(not public.same_network('2001:db8:0:1::1', '2001:db8:0:2::1'), 'another /64 is not');
select ok(not public.same_network('127.0.0.1', '127.0.0.1'), 'loopback (no IP known) is never compared');
select ok(not public.same_network('::1', '::1'), 'in IPv6 neither');

-- ── 5. Settling: the server's checks ────────────────────────────────────────────────────────
select pg_temp.seen('ivy', '203.0.113.10', 'dev_ivy', 'sig_ivy');
select pg_temp.seen('ivy', '203.0.113.12', 'dev_email_link', null);
select pg_temp.person('uma', 'uma@example.org', pg_temp.code('ivy'), false);
select is(pg_temp.settle('uma'), 'pending', 'an unconfirmed email stays pending');

select pg_temp.person('fay', 'fay@example.org', pg_temp.code('ivy'));
select pg_temp.seen('fay', '198.51.100.21', 'dev_fay', 'sig_fay');
select is(pg_temp.settle('fay'), 'qualified', 'another browser on another network counts');
select is((pg_temp.referral('fay')).signals,
  '{"cluster": false, "emailLink": false, "disposable": false, "sameNetwork": false, "sameSignature": false}'::jsonb,
  'and only yes/no signals are kept');
select is(pg_temp.settle('fay'), 'none', 'a settled invite is not settled again');
select is(pg_temp.settle('ivy'), 'none', 'an account nobody invited has nothing to settle');

select pg_temp.person('gus', 'gus@example.org', pg_temp.code('ivy'));
select pg_temp.seen('gus', '198.51.100.22', 'dev_ivy', 'sig_gus');
select is(pg_temp.settle('gus'), 'rejected', 'the inviter''s own browser does not count');
select is((pg_temp.referral('gus')).reason, 'sameDevice', 'as the same device');

select pg_temp.person('ivyx', 'ivy+x@example.com', pg_temp.code('ivy'));
select pg_temp.seen('ivyx', '198.51.100.23', 'dev_ivyx', 'sig_ivyx');
select is(pg_temp.settle('ivyx'), 'rejected', 'the inviter''s own mailbox does not count');
select is((pg_temp.referral('ivyx')).reason, 'self', 'as a self-invite');

select pg_temp.person('mai', 'x@mailinator.com', pg_temp.code('ivy'));
select pg_temp.seen('mai', '198.51.100.24', 'dev_mai', 'sig_mai');
select pg_temp.person('maieu', 'x@eu.mailinator.com', pg_temp.code('ivy'));
select pg_temp.seen('maieu', '198.51.100.25', 'dev_maieu', 'sig_maieu');
select is(pg_temp.settle('mai'), 'rejected', 'throwaway addresses do not count');
select is((pg_temp.referral('mai')).reason, 'disposable', 'reason: disposable');
select is(pg_temp.settle('maieu'), 'rejected', 'their subdomains neither');
select is((pg_temp.referral('maieu')).reason, 'disposable', 'reason: disposable');

select pg_temp.person('hal', 'hal@example.org', pg_temp.code('ivy'));
select pg_temp.seen('hal', '203.0.113.10', 'dev_hal', 'sig_ivy');
select is(pg_temp.settle('hal'), 'held', 'same network and same browser signature: held for the team');
select is((pg_temp.referral('hal')).reason, 'sameNetwork', 'reason: sameNetwork');
select is((pg_temp.referral('hal')).signals ->> 'sameSignature', 'true', 'with the signals the team sees');

select pg_temp.person('joy', 'joy@example.org', pg_temp.code('ivy'));
select pg_temp.seen('joy', '203.0.113.10', 'dev_joy', 'sig_joy');
select is(pg_temp.settle('joy'), 'qualified', 'the same network alone never holds (a shared flat)');
select is((pg_temp.referral('joy')).signals ->> 'sameNetwork', 'true', 'but it is noted');

select pg_temp.person('kim', 'kim@example.org', pg_temp.code('ivy'));
select is(pg_temp.settle('kim'), 'held', 'confirmed without our sign-in log: held');
select is((pg_temp.referral('kim')).reason, 'noSignals', 'reason: noSignals');

select pg_temp.person('cl1', 'cl1@example.org', pg_temp.code('ivy'));
select pg_temp.seen('cl1', '192.0.2.50', 'dev_cl1', 'sig_cl1');
select pg_temp.person('cl2', 'cl2@example.org', pg_temp.code('ivy'));
select pg_temp.seen('cl2', '192.0.2.50', 'dev_cl2', 'sig_cl2');
select pg_temp.person('cl3', 'cl3@example.org', pg_temp.code('ivy'));
select pg_temp.seen('cl3', '192.0.2.50', 'dev_cl3', 'sig_cl3');
select is(pg_temp.settle('cl1'), 'qualified', 'a friend from another network counts');
select is(pg_temp.settle('cl2'), 'qualified', 'and a second from that network too');
select is(pg_temp.settle('cl3'), 'held', 'the third from that network within 7 days is checked by the team');
select is((pg_temp.referral('cl3')).reason, 'cluster', 'reason: cluster');

select pg_temp.person('sus', 'sus@example.org', pg_temp.code('ivy'));
select pg_temp.seen('sus', '198.51.100.26', 'dev_sus', 'sig_sus');
update public.profiles set status = 'suspended' where id = pg_temp.uid('sus');
select is(pg_temp.settle('sus'), 'rejected', 'a suspended account does not count');
select is((pg_temp.referral('sus')).reason, 'inviteeSuspended', 'reason: inviteeSuspended');

select pg_temp.person('eml', 'eml@example.org', pg_temp.code('ivy'));
select pg_temp.seen('eml', '198.51.100.27', 'dev_email_link', null);
select is(pg_temp.settle('eml'), 'qualified', 'the emailed link is not "the same browser"');
select is((pg_temp.referral('eml')).signals ->> 'emailLink', 'true', 'it is noted as confirmed by link');

select pg_temp.seen('lou', '127.0.0.1', 'dev_lou', 'sig_lo');
select pg_temp.person('loe', 'loe@example.org', pg_temp.code('lou'));
select pg_temp.seen('loe', '127.0.0.1', 'dev_loe', 'sig_lo');
select is(pg_temp.settle('loe'), 'qualified', 'loopback and the same signature (local development) count');

-- ── 6. Counting, rewards and revenue ────────────────────────────────────────────────────────
select pg_temp.seen('ana', '203.0.113.30', 'dev_ana', 'sig_ana');
do $$
begin
  for n in 1..11 loop
    perform pg_temp.person('ana' || n, 'ana' || n || '@example.net', pg_temp.code('ana'));
    perform pg_temp.seen('ana' || n, ('198.51.101.' || n)::inet, 'dev_ana' || n, 'sig_ana' || n);
  end loop;
end;
$$;
select is(pg_temp.settle('ana1'), 'qualified', 'a friend counts');
select is(pg_temp.settle('ana2'), 'qualified', 'a second one too');
select is_empty(format($$ select 1 from public.rewards where profile_id = %L $$, pg_temp.uid('ana')), 'two are not a reward yet');
select is(pg_temp.settle('ana3'), 'qualified', 'the third counts');
select is((select kind::text from public.rewards where profile_id = pg_temp.uid('ana')), 'verification_review',
  'and unlocks the verification review');
select is((select actor from public.audit_log where action = 'reward.verification' and target_id = pg_temp.uid('ana')), 'system',
  'logged as given by the system');
select is((select count(*)::int from public.profiles where id = pg_temp.uid('ana') and verified), 0,
  'the review is not the check: nobody is verified automatically');
select pg_temp.settle('ana' || n) from generate_series(4, 9) as n;
select is((select count(*)::int from public.rewards where profile_id = pg_temp.uid('ana')), 1, 'nine are still one reward');
select is(pg_temp.settle('ana10'), 'qualified', 'the tenth counts');
select is((select array_agg(kind::text order by kind) from public.rewards where profile_id = pg_temp.uid('ana')),
  array['verification_review', 'pro_for_life'], 'and gives Pro for life');
select is((select count(*)::int from public.subscriptions where profile_id = pg_temp.uid('ana')), 0,
  'Pro for life is never a subscription (never revenue)');
select is((select actor from public.audit_log where action = 'reward.pro' and target_id = pg_temp.uid('ana')), 'system',
  'logged as well');

select pg_temp.act_as('ana');
set local role authenticated;
select is((public.my_referrals() ->> 'counted')::int, 10, 'the inviter sees 10 counted');
select is(public.my_referrals() ->> 'code', (select referral_code from public.profiles), 'and their code');
select is(public.my_referrals() #>> '{rewards,pro_for_life,revoked}', 'false', 'and Pro for life');
select is(jsonb_array_length(public.my_referrals() -> 'invited'), 13, 'and everyone who signed up with the link');
select is((select count(*)::int from jsonb_array_elements(public.my_referrals() -> 'invited') p where p ->> 'status' = 'pending'), 3,
  'the ones not settled yet show as not confirmed');
select is_empty($$ select 1 from public.rewards where profile_id <> auth.uid() $$, 'customers see only their own rewards');
reset role;

select pg_temp.act_as('cara');
set local role authenticated;
select ok(exists (
  select 1 from jsonb_array_elements(public.admin_referral_queue() -> 'rewards') w
  where w ->> 'username' = 'ana' and w ->> 'kind' = 'pro_for_life' and w ->> 'source' = 'referrals' and (w ->> 'counted')::int = 10),
  'the team''s queue lists the Pro-for-life reward');
select is((select c -> 'subscription' ->> 'plan' from jsonb_array_elements(public.admin_customers()) c where c ->> 'username' = 'ana'), 'free',
  'and the customer is still on the free plan');
reset role;
select pg_temp.as_server();

-- A suspended invitee stops counting while suspended; rewards stay.
update public.profiles set status = 'suspended' where id = pg_temp.uid('ana1');
select is(public.referral_count(pg_temp.uid('ana')), 9, 'a suspended friend stops counting');
select is((select count(*)::int from public.rewards where profile_id = pg_temp.uid('ana') and revoked_at is null), 2,
  'but rewards are permanent');
update public.profiles set status = 'active' where id = pg_temp.uid('ana1');
select is(public.referral_count(pg_temp.uid('ana')), 10, 'and counts again once let back in');

-- An inviter suspended when the 3rd friend counts gets nothing until they are active again.
do $$
begin
  for n in 1..3 loop
    perform pg_temp.person('sam' || n, 'sam' || n || '@example.net', pg_temp.code('sam'));
    perform pg_temp.seen('sam' || n, ('198.51.102.' || n)::inet, 'dev_sam' || n, 'sig_sam' || n);
  end loop;
end;
$$;
update public.profiles set status = 'suspended' where id = pg_temp.uid('sam');
select is(pg_temp.settle('sam1'), 'qualified', 'invites of a suspended inviter keep settling');
select is(pg_temp.settle('sam2'), 'qualified', 'all of them');
select is(pg_temp.settle('sam3'), 'qualified', 'up to the third');
select is_empty(format($$ select 1 from public.rewards where profile_id = %L $$, pg_temp.uid('sam')), 'but give no reward');
update public.profiles set status = 'active' where id = pg_temp.uid('sam');
-- One invite the routes missed: confirmed an hour ago and still pending.
select pg_temp.person('old', 'old@example.net', pg_temp.code('sam'));
update auth.users set email_confirmed_at = now() - interval '1 hour' where id = pg_temp.uid('old');
select pg_temp.seen('old', '198.51.102.9', 'dev_old', 'sig_old');
select is(public.settle_pending_referrals(), 1, 'the hourly job settles what the routes missed');
select is((pg_temp.referral('old')).state::text, 'qualified', 'by the same checks');
select is((select kind::text from public.rewards where profile_id = pg_temp.uid('sam')), 'verification_review',
  'and gives the reward once the inviter is active again');
select isnt((select jobid from cron.job where jobname = 'linkyo-settle-referrals'), null, 'every hour');

-- ── 7. Verification requests ────────────────────────────────────────────────────────────────
select pg_temp.act_as('ben');
set local role authenticated;
select is(public.request_verification('{https://instagram.com/ben}'), 'notUnlocked', 'without the reward there is nothing to ask');
reset role;

select pg_temp.act_as('ana');
set local role authenticated;
select is(public.request_verification('{http://instagram.com/ana}'), 'invalidLinks', 'links must start with https://');
select is(public.request_verification(array['https://a.example/1', 'https://a.example/2', 'https://a.example/3', 'https://a.example/4']),
  'invalidLinks', 'at most three links');
select is(public.request_verification('{" "}'), 'invalidLinks', 'and at least one');
select is(public.request_verification('{https://instagram.com/ana, https://instagram.com/ana}', 'My only account'), 'ok',
  'with the reward, a creator asks for the review');
select is(public.request_verification('{https://instagram.com/ana}'), 'alreadyOpen', 'one request at a time');
select is(public.my_referrals() #>> '{verification,state}', 'requested', 'the creator sees it as requested');
reset role;

select set_config('test.request', (select id::text from public.verification_requests where profile_id = pg_temp.uid('ana')), true);
select pg_temp.act_as('dan');
set local role authenticated;
select throws_ok($$ select public.admin_review_verification(current_setting('test.request')::uuid, 'approve') $$,
  '42501', 'linkyo:forbidden', 'a viewer cannot approve');
select lives_ok($$ select public.admin_referral_queue() $$, 'but sees the queue');
reset role;

select pg_temp.act_as('cara');
set local role authenticated;
select is((select v ->> 'note' from jsonb_array_elements(public.admin_referral_queue() -> 'verifications') v where v ->> 'username' = 'ana'),
  'My only account', 'the team sees the request with its note');
select is((select jsonb_array_length(v -> 'links') from jsonb_array_elements(public.admin_referral_queue() -> 'verifications') v where v ->> 'username' = 'ana'),
  1, 'and each link once');
select throws_ok($$ select public.admin_review_verification(current_setting('test.request')::uuid, 'start') $$,
  'P0001', 'linkyo:invalidAction', 'there is no claim step, only approve or decline');
select throws_ok($$ select public.admin_review_verification(current_setting('test.request')::uuid, 'decline') $$,
  'P0001', 'linkyo:invalidAction', 'a decline needs a reason');
select lives_ok($$ select public.admin_review_verification(current_setting('test.request')::uuid, 'approve') $$,
  'the owner approves');
select throws_ok($$ select public.admin_review_verification(current_setting('test.request')::uuid, 'decline', 'other') $$,
  'P0001', 'linkyo:notFound', 'a decided request is closed');
reset role;
select is((select verified from public.profiles where id = pg_temp.uid('ana')), true, 'approving sets the blue check');
select is((select page #>> '{profile,verified}' from public.sites where profile_id = pg_temp.uid('ana')), 'true', 'and the page shows it');
select is((select actor from public.audit_log where action = 'verification.approve' and target_id = pg_temp.uid('ana')), 'cara@example.com',
  'logged with the reviewer');
select is((select reviewer_id from public.verification_requests where id = current_setting('test.request')::uuid), pg_temp.uid('cara'),
  'who is kept on the request');

select pg_temp.act_as('ana');
set local role authenticated;
select is(public.request_verification('{https://instagram.com/ana}'), 'alreadyVerified', 'a verified page asks no more');
reset role;

-- A decline: Ivy may ask again only after 7 days.
select pg_temp.act_as('ivy');
set local role authenticated;
select is(public.request_verification('{https://instagram.com/ivy}'), 'ok', 'another creator asks');
reset role;
select set_config('test.request_ivy', (select id::text from public.verification_requests where profile_id = pg_temp.uid('ivy')), true);
select pg_temp.act_as('cara');
set local role authenticated;
select lives_ok($$ select public.admin_review_verification(current_setting('test.request_ivy')::uuid, 'decline', 'identityUnclear') $$,
  'the owner declines with a reason');
reset role;
select pg_temp.act_as('ivy');
set local role authenticated;
select is(public.request_verification('{https://instagram.com/ivy}'), 'tooSoon', 'asking again the same day is too soon');
select is(public.my_referrals() #>> '{verification,declineReason}', 'identityUnclear', 'the creator sees why');
select is((public.my_referrals() #>> '{verification,retryAt}')::timestamptz, now() + interval '7 days', 'and from when to ask again');
select is(jsonb_array_length(public.my_verification_requests()), 1, 'the data export lists the creator''s own requests');
select ok(public.my_verification_requests() -> 0 ? 'declineReason' and not (public.my_verification_requests() -> 0 ? 'reviewer'),
  'with the decision, never the reviewer');
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select public.my_verification_requests() $$, '42501', null, 'visitors have no requests to export');
reset role;

-- The team can give the review by hand; nobody reviews their own request.
select pg_temp.act_as('cara');
set local role authenticated;
select lives_ok(format($$ select public.admin_set_reward(%L, 'verification_review', true) $$, pg_temp.uid('cara')),
  'the team gives a reward by hand');
select is(public.request_verification('{https://instagram.com/cara}'), 'ok', 'which unlocks the request');
reset role;
select set_config('test.request_cara', (select id::text from public.verification_requests where profile_id = pg_temp.uid('cara')), true);
select pg_temp.act_as('cara');
set local role authenticated;
select throws_ok($$ select public.admin_review_verification(current_setting('test.request_cara')::uuid, 'approve') $$,
  'P0001', 'linkyo:notYourself', 'nobody approves their own request');
reset role;
select is((select source from public.rewards where profile_id = pg_temp.uid('cara')), 'team', 'a hand-given reward says so');

-- ── 8. Team writes ──────────────────────────────────────────────────────────────────────────
select set_config('test.a3', (pg_temp.referral('ana3')).id::text, true);
select set_config('test.hal', (pg_temp.referral('hal')).id::text, true);
select set_config('test.eve', (pg_temp.referral('eve')).id::text, true);

select pg_temp.act_as('eli');
set local role authenticated;
select throws_ok(format($$ select public.admin_set_reward(%L, 'pro_for_life', false) $$, pg_temp.uid('ana')),
  '42501', 'linkyo:forbidden', 'an editor cannot remove Pro for life (billing)');
select throws_ok($$ select public.admin_set_referral(current_setting('test.a3')::uuid, 'revoked') $$,
  '42501', 'linkyo:forbidden', 'nor remove an invite');
select lives_ok(format($$ select public.admin_customer_referrals(%L) $$, pg_temp.uid('ana')), 'but reads a customer''s invites');
reset role;

select pg_temp.act_as('cara');
set local role authenticated;
select lives_ok($$ select public.admin_set_referral(current_setting('test.a3')::uuid, 'revoked', 'bought sign-up') $$,
  'the owner removes an invite');
select is((public.admin_customer_referrals(pg_temp.uid('ana')) ->> 'counted')::int, 9, 'which stops counting');
select is((select r ->> 'reason' from jsonb_array_elements(public.admin_customer_referrals(pg_temp.uid('ana')) -> 'invited') r
  where r ->> 'id' = current_setting('test.a3')), 'team', 'marked as removed by the team');
select is((select count(*)::int from jsonb_object_keys(public.admin_customer_referrals(pg_temp.uid('ana')) -> 'rewards')), 2, 'rewards stay');
select lives_ok($$ select public.admin_set_referral(current_setting('test.a3')::uuid, 'qualified') $$, 'and restores it');
select is((public.admin_customer_referrals(pg_temp.uid('ana')) ->> 'counted')::int, 10, 'it counts again');
select ok(exists (select 1 from jsonb_array_elements(public.admin_referral_queue() -> 'held') h where h ->> 'invitee' = 'hal'),
  'held invites wait in the queue');
select lives_ok($$ select public.admin_set_referral(current_setting('test.hal')::uuid, 'qualified') $$, 'the owner counts a held one');
select ok(not exists (select 1 from jsonb_array_elements(public.admin_referral_queue() -> 'held') h where h ->> 'invitee' = 'hal'),
  'and it leaves the queue');
select throws_ok($$ select public.admin_set_referral(current_setting('test.eve')::uuid, 'qualified') $$,
  'P0001', 'linkyo:notFound', 'an unconfirmed invite cannot be decided by hand');
select throws_ok($$ select public.admin_set_referral(current_setting('test.a3')::uuid, 'held') $$,
  'P0001', 'linkyo:invalidAction', 'only count or remove');
select lives_ok(format($$ select public.admin_set_reward(%L, 'verification_review', false, 'abuse') $$, pg_temp.uid('ana')),
  'the owner removes a reward');
select throws_ok(format($$ select public.admin_set_reward(%L, 'verification_review', false) $$, pg_temp.uid('ana')),
  'P0001', 'linkyo:notFound', 'a removed reward cannot be removed twice');
select is(public.admin_customer_referrals(pg_temp.uid('ana')) #>> '{rewards,verification_review,reason}', 'abuse', 'with the reason');
select is(public.admin_customer_referrals(pg_temp.uid('ana1')) #>> '{invitedBy,username}', 'ana', 'an invited customer shows who invited them');
reset role;
select is((select array_agg(action order by id) from public.audit_log where action like 'referral.%'),
  array['referral.revoke', 'referral.restore', 'referral.release'], 'every team decision is in the activity log');
select pg_temp.as_server();
select is(pg_temp.settle('ana11'), 'qualified', 'a later friend counts');
select isnt((select revoked_at from public.rewards where profile_id = pg_temp.uid('ana') and kind = 'verification_review'), null,
  'but a removed reward is never given again automatically');

select pg_temp.act_as('cara');
set local role authenticated;
select lives_ok(format($$ select public.admin_set_reward(%L, 'verification_review', true) $$, pg_temp.uid('ana')),
  'the team can give it back');
reset role;
select is((select revoked_at from public.rewards where profile_id = pg_temp.uid('ana') and kind = 'verification_review'), null,
  'and then it is active');
select is((select count(*)::int from public.audit_log where action in ('reward.revoke', 'reward.restore') and target_id = pg_temp.uid('ana')), 2,
  'both logged');

-- ── 9. Privacy and deleting ─────────────────────────────────────────────────────────────────
insert into public.sites (profile_id, onboarded, theme, page) values
  (pg_temp.uid('ana4'), true, '{}', '{"profile":{"displayName":"Alex Four"},"blocks":[]}'),
  (pg_temp.uid('ana5'), false, '{}', '{"profile":{"displayName":"Hidden Five"},"blocks":[]}');
select pg_temp.act_as('ana');
set local role authenticated;
select is(position('@' in public.my_referrals()::text), 0, 'the inviter never sees an email');
select ok(public.my_referrals()::text like '%Alex Four%', 'they see a friend''s page name once the page is set up');
select ok(public.my_referrals()::text not like '%Hidden Five%', 'not before');
reset role;
select pg_temp.act_as('ana1');
set local role authenticated;
select is(public.my_referrals() -> 'invitedBy', '{"name": "Ana Lund"}'::jsonb, 'the invited person sees who invited them');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is(public.referral_inviter(pg_temp.code('ivy')), '{"name": null}'::jsonb, 'a page that is not set up shows no name at sign-up');
select is(public.referral_inviter('zzzzzzzz'), null, 'an unknown code shows nothing');
reset role;
update public.profiles set status = 'suspended' where id = pg_temp.uid('lou');
select is(public.referral_inviter(pg_temp.code('lou')), null, 'nor does a suspended inviter''s');
select pg_temp.as_server();

delete from auth.users where id = pg_temp.uid('ana2');
select is(public.referral_count(pg_temp.uid('ana')), 11, 'a friend who deletes their account after counting still counts');
select pg_temp.act_as('ana');
set local role authenticated;
select is((select count(*)::int from jsonb_array_elements(public.my_referrals() -> 'invited') p
  where (p ->> 'deleted')::boolean and p ->> 'name' is null and p ->> 'status' = 'counted'), 1,
  'shown as a deleted account, without a name');
reset role;
delete from auth.users where id = pg_temp.uid('eve');
select is_empty(format($$ select 1 from public.referrals where id = %L $$, current_setting('test.eve')),
  'an invite that never counted goes with the account');
delete from auth.users where id = pg_temp.uid('ivy');
select is_empty($$ select 1 from public.referrals where inviter_id = pg_temp.uid('ivy') $$,
  'deleting the inviter deletes their invites');
select is((select count(*)::int from public.verification_requests where profile_id = pg_temp.uid('ivy')), 0,
  'and their verification requests');

select * from finish();
rollback;
