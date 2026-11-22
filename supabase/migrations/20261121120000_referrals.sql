-- Invite program (ADR 0064): codes, referrals, rewards and verification requests.
-- In code, data and URLs the program is "referral": "invite" already names the team's prepared-page
-- invite (ADR 0015). Customers read only through my_referrals(); the team through admin_* functions.
-- Our server settles an invite right after the invited person's first sign-in, when the sign-in log
-- has the data (settle_referral, called from /api/auth/verify and /api/auth/confirm).
-- Rewards are never a subscription: Pro for life lives in public.rewards, and revenue reads
-- public.subscriptions only.

-- ── Rules: mirrored by REFERRAL_RULES in apps/web/src/features/referrals/rules.ts (rules.test.ts) ──
create function public.referral_rule(name text) returns integer
language sql immutable set search_path = '' as $$
  select case name
    when 'verification_at' then 3
    when 'pro_for_life_at' then 10
    when 'cluster_size' then 3
    when 'cluster_days' then 7
    when 'retry_verification_days' then 7
  end;
$$;

-- ── Codes ───────────────────────────────────────────────────────────────────────────────────
-- 8 symbols without 0/1/i/l/o, made once by the database; never chosen or changed by the customer.
-- Uniform: a byte of 248 or more (the largest multiple of 31 under 256) is drawn again, as newReferralCode() does.
create function public.new_referral_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  bytes bytea;
  drawn integer;
  candidate text;
begin
  loop
    candidate := '';
    while char_length(candidate) < 8 loop
      bytes := extensions.gen_random_bytes(16);
      for i in 0..15 loop
        drawn := get_byte(bytes, i);
        continue when drawn >= 248;
        candidate := candidate || substr(alphabet, 1 + drawn % 31, 1);
        exit when char_length(candidate) = 8;
      end loop;
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.profiles add column referral_code text
  constraint referral_code_format check (referral_code ~ '^[2-9a-hjkmnp-z]{8}$');
do $$
declare
  account record;
begin
  for account in select id from public.profiles where referral_code is null loop
    update public.profiles set referral_code = public.new_referral_code() where id = account.id;
  end loop;
end;
$$;
alter table public.profiles
  alter column referral_code set default public.new_referral_code(),
  alter column referral_code set not null,
  add constraint referral_code_unique unique (referral_code);
-- Owners read their code (the "owners read their profile" policy); the column grant stays
-- `update (locale)`, so nobody changes their own code.

-- ── Helpers (internal) ──────────────────────────────────────────────────────────────────────
/** The mailbox behind an address: lower case, no +tag, Gmail without dots. Mirrors emailIdentity(). */
create function public.email_identity(address text) returns text
language sql immutable set search_path = '' as $$
  with parts as (
    select split_part(lower(trim(address)), '@', 1) as local, split_part(lower(trim(address)), '@', 2) as domain
  )
  select case when domain in ('gmail.com', 'googlemail.com')
    then replace(split_part(local, '+', 1), '.', '') || '@gmail.com'
    else split_part(local, '+', 1) || '@' || domain end
  from parts;
$$;

/** Same IPv4 address or same IPv6 /64 (one household). Loopback (unknown IP in dev) never matches. */
create function public.same_network(a inet, b inet) returns boolean
language sql immutable set search_path = '' as $$
  select a is not null and b is not null
    and not (a << '127.0.0.0/8'::inet or a = '::1'::inet)
    and family(a) = family(b)
    and case family(a) when 4 then host(a) = host(b)
         else network(set_masklen(a, 64)) = network(set_masklen(b, 64)) end;
$$;

-- ── Throwaway email domains (functions only) ────────────────────────────────────────────────
create table public.disposable_domains (domain extensions.citext primary key);
alter table public.disposable_domains enable row level security;
-- No policies: only settle_referral() reads it. The team adds domains with SQL.
insert into public.disposable_domains (domain) values
  ('mailinator.com'), ('guerrillamail.com'), ('guerrillamail.de'), ('guerrillamail.net'), ('sharklasers.com'),
  ('grr.la'), ('10minutemail.com'), ('10minutemail.net'), ('temp-mail.org'), ('temp-mail.io'), ('tempmail.com'),
  ('tempmail.net'), ('tempmailo.com'), ('yopmail.com'), ('yopmail.fr'), ('trashmail.com'), ('trashmail.de'),
  ('trash-mail.com'), ('wegwerfmail.de'), ('wegwerfmail.net'), ('einrot.com'), ('muellmail.com'), ('byom.de'),
  ('spamgourmet.com'), ('maildrop.cc'), ('dispostable.com'), ('getnada.com'), ('mohmal.com'),
  ('throwawaymail.com'), ('fakeinbox.com'), ('mailnesia.com'), ('mintemail.com'), ('emailondeck.com'),
  ('mytemp.email'), ('tempr.email'), ('discard.email'), ('mail.tm'), ('mailpoof.com'), ('inboxkitten.com'),
  ('burnermail.io'), ('spambox.us'), ('emailfake.com'), ('moakt.com'), ('tmpmail.org'), ('tmpmail.net'),
  ('1secmail.com'), ('1secmail.net'), ('1secmail.org');

-- ── Referrals ───────────────────────────────────────────────────────────────────────────────
create type public.referral_state as enum ('pending', 'qualified', 'held', 'rejected', 'revoked');

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  -- The inviter's account goes, their program goes with it.
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  -- One inviter per account. A counted invite outlives the invited account (anonymous: null).
  invitee_id uuid unique references public.profiles (id) on delete set null,
  state public.referral_state not null default 'pending',
  reason text constraint reason_known check (reason is null or reason in (
    'self', 'repeat', 'sameDevice', 'disposable', 'inviteeSuspended', 'noSignals', 'sameNetwork', 'cluster', 'team')),
  -- What the checks saw, as yes/no only (no IPs, no device IDs): sameNetwork, sameSignature, cluster, disposable, emailLink.
  signals jsonb not null default '{}'::jsonb,
  -- Set when settled, so the checks still work after the invited account is deleted (its sign-ins go with it):
  -- the mailbox as sha256 hex of email_identity() (never the address), kept as long as the row, so one
  -- mailbox counts once per inviter ('repeat');
  mailbox_hash text constraint mailbox_hash_format check (mailbox_hash ~ '^[0-9a-f]{64}$'),
  -- and the opening sign-in's network (the IPv4 address or the IPv6 /64, as sign_ins keeps it), for the
  -- cluster check; cleared by the hourly job once older than cluster_days.
  network inet,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  constraint not_self check (inviter_id is distinct from invitee_id)
);
create index referrals_inviter on public.referrals (inviter_id, created_at desc);
create index referrals_pending on public.referrals (state) where state in ('pending', 'held');

alter table public.referrals enable row level security;
-- No policies: functions only. Inviters must not see invitee IDs, reasons or signals.
revoke all on public.referrals from authenticated, anon;

-- An invite that never counted is forgotten with the invited account; a counted one keeps the count, but
-- only if the account was active: a suspended one wasn't counting, and deleting it must not count it again.
create function public.referrals_forget() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.referrals where invitee_id = old.id and (state <> 'qualified' or old.status <> 'active');
  return old;
end;
$$;
create trigger profiles_referrals_forget before delete on public.profiles
  for each row execute function public.referrals_forget();

-- ── Rewards ─────────────────────────────────────────────────────────────────────────────────
-- Not a subscription. Revenue (monthlyRevenue, mrrByMonth, funnel) reads public.subscriptions only.
create type public.reward_kind as enum ('verification_review', 'pro_for_life');

create table public.rewards (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.reward_kind not null,
  source text not null default 'referrals' constraint source_known check (source in ('referrals', 'team')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  revoke_reason text constraint revoke_reason_short check (char_length(revoke_reason) <= 200),
  primary key (profile_id, kind)
);
alter table public.rewards enable row level security;
create policy "owners read their rewards" on public.rewards
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "team reads rewards" on public.rewards
  for select to authenticated using (public.has_permission('customers.view'));
revoke insert, update, delete on public.rewards from authenticated, anon;
-- Who removed a reward and why is the team's (admin_customer_referrals); customers read the rest.
revoke select on public.rewards from authenticated, anon;
grant select (profile_id, kind, source, granted_at, revoked_at) on public.rewards to authenticated;

-- ── Verification requests (functions only) ──────────────────────────────────────────────────
-- No "in review" claim step: the team is small (ADR 0064, what is not built).
create type public.verification_state as enum ('requested', 'approved', 'declined');

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  state public.verification_state not null default 'requested',
  links text[] not null constraint links_count check (cardinality(links) between 1 and 3),
  note text not null default '' constraint note_short check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  reviewer_id uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decline_reason text constraint decline_reason_known check (
    decline_reason is null or decline_reason in ('profileNotLinked', 'identityUnclear', 'impersonation', 'other'))
);
create unique index verification_requests_one_open on public.verification_requests (profile_id)
  where state = 'requested';
alter table public.verification_requests enable row level security;
revoke all on public.verification_requests from authenticated, anon;

-- ── Sign-up: remember the inviter (replaces handle_new_user; same body plus the block marked NEW) ──
-- Sign-up sends { username, locale } as user metadata. An invalid, reserved or taken name makes
-- the whole sign-up fail, so there is never an account without a valid profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  lang text := coalesce(new.raw_user_meta_data ->> 'locale', 'de');
  -- NEW: the code of the invite link this account signed up through (`?ref=`), if any.
  ref_code text := lower(trim(coalesce(new.raw_user_meta_data ->> 'ref', '')));
  verdict text;
begin
  if wanted = '' then
    -- Accounts made without a name (e.g. team members invited by the owner) get a neutral one.
    wanted := 'user-' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  if lang not in ('de', 'en', 'ar') then
    lang := 'de';
  end if;
  verdict := public.username_status(wanted);
  if verdict <> 'ok' then
    raise exception 'linkyo:%', verdict using errcode = 'P0001';
  end if;
  insert into public.profiles (id, username, locale) values (new.id, wanted, lang);
  -- NEW: an invite link. Settled after the email is confirmed (settle_referral). Never stops a sign-up.
  if ref_code ~ '^[2-9a-hjkmnp-z]{8}$' then
    begin
      insert into public.referrals (inviter_id, invitee_id)
      select p.id, new.id from public.profiles p where p.referral_code = ref_code and p.id <> new.id
      on conflict (invitee_id) do nothing;
    exception when foreign_key_violation then
      null; -- the inviter was deleted a moment ago
    end;
  end if;
  return new;
end;
$$;

-- ── Counting and rewards (internal) ─────────────────────────────────────────────────────────
/** Counted invites: qualified, and the invited account is active or was deleted after it counted. */
create function public.referral_count(inviter uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.referrals r
  left join public.profiles p on p.id = r.invitee_id
  where r.inviter_id = referral_count.inviter and r.state = 'qualified'
    and (r.invitee_id is null or p.status = 'active');
$$;

/** Gives the rewards an active inviter has reached. A reward the team removed is never given again. */
create function public.grant_referral_rewards(inviter uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  counted integer;
  granted public.reward_kind;
begin
  if not public.is_active(inviter) then
    return;
  end if;
  counted := public.referral_count(inviter);
  for granted in
    insert into public.rewards (profile_id, kind)
    select grant_referral_rewards.inviter, m.kind
    from (values
      ('verification_review'::public.reward_kind, public.referral_rule('verification_at')),
      ('pro_for_life'::public.reward_kind, public.referral_rule('pro_for_life_at'))
    ) as m (kind, threshold)
    where counted >= m.threshold
    on conflict (profile_id, kind) do nothing
    returning kind
  loop
    -- auth.uid() is null here (server or cron), so the log says "system".
    perform public.audit(
      case when granted = 'pro_for_life' then 'reward.pro' else 'reward.verification' end,
      inviter, public.customer_label(inviter), jsonb_build_object('invites', counted));
  end loop;
end;
$$;

-- ── Settling an invite (server only) ────────────────────────────────────────────────────────
/**
 * Decides an invite once the invited person has confirmed their email. Our server calls it right
 * after writing the sign-in log (/api/auth/verify, /api/auth/confirm), with the invite code the
 * confirming browser carries (`ref`): the code is stored when the account is made, by whoever asked
 * for it first, so only the browser that confirms the mailbox may keep it. Without the same code the
 * invite is dropped. Returns the new state, 'pending' (not confirmed yet), 'dropped' or 'none'.
 */
create function public.settle_referral(invitee uuid, ref text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  found_referral public.referrals;
  invitee_email text;
  inviter_email text;
  inviter_code text;
  mailbox text;
  opening public.sign_ins;
  opening_network inet;
  seen_before boolean;
  same_device boolean := false;
  same_net boolean := false;
  same_signature boolean := false;
  in_cluster boolean := false;
  throwaway boolean;
  verdict public.referral_state;
  why text;
begin
  select * into found_referral from public.referrals r
  where r.invitee_id = settle_referral.invitee and r.state = 'pending' for update;
  if found_referral.id is null then
    return 'none';
  end if;
  select u.email into invitee_email from auth.users u where u.id = found_referral.invitee_id and u.email_confirmed_at is not null;
  if invitee_email is null then
    return 'pending';
  end if;
  select u.email, p.referral_code into inviter_email, inviter_code
  from auth.users u join public.profiles p on p.id = u.id where u.id = found_referral.inviter_id;
  if lower(trim(coalesce(settle_referral.ref, ''))) is distinct from inviter_code then
    -- Confirmed without the link's code (another browser, the sign-in form, someone else's sign-up).
    delete from public.referrals where id = found_referral.id;
    return 'dropped';
  end if;
  mailbox := encode(extensions.digest(public.email_identity(invitee_email), 'sha256'), 'hex');
  seen_before := exists (
    select 1 from public.referrals x
    where x.inviter_id = found_referral.inviter_id and x.id <> found_referral.id and x.mailbox_hash = mailbox);

  select * into opening from public.sign_ins s
  where s.profile_id = found_referral.invitee_id and s.result = 'success' order by s.at limit 1;
  if opening.id is not null then
    -- One household: the IPv4 address or the IPv6 /64 (what same_network() compares).
    opening_network := case family(opening.ip) when 4 then set_masklen(opening.ip, 32) else network(set_masklen(opening.ip, 64)) end;
    same_device := opening.device_id not in ('dev_unknown', 'dev_email_link') and exists (
      select 1 from public.sign_ins s where s.profile_id = found_referral.inviter_id and s.device_id = opening.device_id);
    same_net := exists (
      select 1 from public.sign_ins s where s.profile_id = found_referral.inviter_id and public.same_network(opening.ip, s.ip));
    same_signature := opening.signature is not null and exists (
      select 1 from public.sign_ins s where s.profile_id = found_referral.inviter_id and s.signature = opening.signature);
    -- From the rows, not the sign-in log: a deleted invitee's sign-ins are gone, its network is not.
    in_cluster := (
      select count(*) from public.referrals x
      where x.inviter_id = found_referral.inviter_id and x.id <> found_referral.id
        and x.state in ('qualified', 'held')
        and x.settled_at > now() - make_interval(days => public.referral_rule('cluster_days'))
        and public.same_network(opening.ip, x.network)
    ) >= public.referral_rule('cluster_size') - 1;
  end if;
  throwaway := exists (
    select 1 from public.disposable_domains d
    where split_part(lower(invitee_email), '@', 2) = d.domain::text
       or split_part(lower(invitee_email), '@', 2) like '%.' || d.domain::text);

  if public.email_identity(invitee_email) = public.email_identity(inviter_email) then verdict := 'rejected'; why := 'self';
  elsif seen_before then verdict := 'rejected'; why := 'repeat';
  elsif same_device then verdict := 'rejected'; why := 'sameDevice';
  elsif throwaway then verdict := 'rejected'; why := 'disposable';
  elsif not public.is_active(found_referral.invitee_id) then verdict := 'rejected'; why := 'inviteeSuspended';
  elsif opening.id is null then verdict := 'held'; why := 'noSignals';
  elsif same_net and same_signature then verdict := 'held'; why := 'sameNetwork';
  elsif in_cluster then verdict := 'held'; why := 'cluster';
  else verdict := 'qualified';
  end if;

  update public.referrals set
    state = verdict, reason = why, settled_at = now(), mailbox_hash = mailbox, network = opening_network,
    signals = jsonb_build_object('sameNetwork', same_net, 'sameSignature', same_signature, 'cluster', in_cluster,
      'disposable', throwaway, 'emailLink', coalesce(opening.device_id = 'dev_email_link', false))
  where id = found_referral.id;
  if verdict = 'qualified' then
    perform public.grant_referral_rewards(found_referral.inviter_id);
  end if;
  return verdict::text;
end;
$$;

/**
 * Hourly: drops invites confirmed without the routes settling them (no browser showed the link's code,
 * the same rule as settle_referral), clears networks older than cluster_days, and gives rewards waiting
 * on an inviter who is active again. Returns how many invites it dropped.
 */
create function public.settle_pending_referrals() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  settled integer := 0;
  waiting uuid;
begin
  for waiting in
    select r.invitee_id from public.referrals r join auth.users u on u.id = r.invitee_id
    where r.state = 'pending' and u.email_confirmed_at < now() - interval '15 minutes'
  loop
    perform public.settle_referral(waiting);
    settled := settled + 1;
  end loop;
  update public.referrals set network = null
  where network is not null and settled_at < now() - make_interval(days => public.referral_rule('cluster_days'));
  -- Only inviters who could be owed something: active, with a counted invite, and missing a reward.
  for waiting in
    select distinct r.inviter_id from public.referrals r
    join public.profiles p on p.id = r.inviter_id and p.status = 'active'
    where r.state = 'qualified'
      and (select count(*) from public.rewards w where w.profile_id = r.inviter_id) < 2
  loop
    perform public.grant_referral_rewards(waiting);
  end loop;
  return settled;
end;
$$;
select cron.schedule('linkyo-settle-referrals', '41 * * * *', 'select public.settle_pending_referrals()');

-- ── Customers ───────────────────────────────────────────────────────────────────────────────
/** The caller's invite program, shaped for the Invite screen. Never other people's emails. */
create function public.my_referrals() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  return (
    select jsonb_build_object(
      'code', p.referral_code,
      'counted', public.referral_count(me),
      'rewards', coalesce((
        select jsonb_object_agg(w.kind, jsonb_build_object('at', w.granted_at, 'revoked', w.revoked_at is not null))
        from public.rewards w where w.profile_id = me), '{}'::jsonb),
      'verification', (
        select jsonb_build_object(
          'state', v.state, 'at', v.created_at, 'decidedAt', v.decided_at, 'declineReason', v.decline_reason,
          'retryAt', case when v.state = 'declined'
            then v.decided_at + make_interval(days => public.referral_rule('retry_verification_days')) end)
        from public.verification_requests v where v.profile_id = me order by v.created_at desc limit 1),
      'invited', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id,
          -- The page name once its owner finished the welcome flow; never the email.
          'name', case when s.onboarded then nullif(s.page #>> '{profile,displayName}', '') end,
          'deleted', r.invitee_id is null,
          'status', case
            when r.state = 'qualified' and (r.invitee_id is null or x.status = 'active') then 'counted'
            when r.state = 'pending' then 'pending'
            when r.state = 'held' then 'checking'
            else 'notCounted' end,
          'at', r.created_at) order by r.created_at desc)
        from public.referrals r
        left join public.profiles x on x.id = r.invitee_id
        left join public.sites s on s.profile_id = r.invitee_id
        where r.inviter_id = me), '[]'::jsonb),
      'invitedBy', (
        select jsonb_build_object('name', coalesce(nullif(s2.page #>> '{profile,displayName}', ''), i.username::text))
        from public.referrals r2
        join public.profiles i on i.id = r2.inviter_id
        left join public.sites s2 on s2.profile_id = i.id
        where r2.invitee_id = me)
    )
    from public.profiles p where p.id = me
  );
end;
$$;

/** All of the caller's own verification requests, for the data export (Art. 15); never the reviewer. */
create function public.my_verification_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('state', v.state, 'links', to_jsonb(v.links), 'note', v.note, 'at', v.created_at,
      'decidedAt', v.decided_at, 'declineReason', v.decline_reason) order by v.created_at desc)
    from public.verification_requests v where v.profile_id = me), '[]'::jsonb);
end;
$$;

/**
 * For the sign-up page: the inviter's page name if their page is public (same rules as
 * public_page), {"name": null} for a valid code whose page isn't, null for an unknown code.
 */
create function public.referral_inviter(code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name',
    case when s.onboarded and u.email_confirmed_at is not null then nullif(s.page #>> '{profile,displayName}', '') end)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.sites s on s.profile_id = p.id
  where p.referral_code = lower(trim(referral_inviter.code)) and p.status = 'active';
$$;

/** 'ok' or why not: unavailable, alreadyVerified, notUnlocked, alreadyOpen, tooSoon, invalidLinks. */
create function public.request_verification(links text[], note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text[];
  previous public.verification_requests;
begin
  if me is null or not public.is_active(me) then
    return 'unavailable';
  end if;
  if (select verified from public.profiles where id = me) then
    return 'alreadyVerified';
  end if;
  if not exists (
    select 1 from public.rewards where profile_id = me and kind = 'verification_review' and revoked_at is null
  ) then
    return 'notUnlocked';
  end if;
  select * into previous from public.verification_requests where profile_id = me order by created_at desc limit 1;
  if previous.state = 'requested' then
    return 'alreadyOpen';
  end if;
  if previous.state = 'declined'
     and previous.decided_at > now() - make_interval(days => public.referral_rule('retry_verification_days')) then
    return 'tooSoon';
  end if;
  select array_agg(distinct trim(l)) into clean from unnest(links) as l where trim(l) <> '';
  if clean is null or cardinality(clean) > 3 or exists (
    select 1 from unnest(clean) as l where l !~ '^https://[^\s/]+\.[^\s]+$' or char_length(l) > 300
  ) then
    return 'invalidLinks';
  end if;
  insert into public.verification_requests (profile_id, links, note)
  values (me, clean, left(coalesce(trim(note), ''), 300));
  perform public.audit('verification.request', me, public.customer_label(me));
  return 'ok';
end;
$$;

-- ── Team ────────────────────────────────────────────────────────────────────────────────────
/** One customer's invites, rewards and requests (the Invites tab). */
create function public.admin_customer_referrals(customer uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('customers.view');
  return (
    select jsonb_build_object(
      'code', p.referral_code,
      'counted', public.referral_count(p.id),
      'invitedBy', (
        select jsonb_build_object('id', r.inviter_id, 'username', i.username::text, 'state', r.state,
          'reason', r.reason, 'signals', r.signals, 'at', r.created_at)
        from public.referrals r join public.profiles i on i.id = r.inviter_id where r.invitee_id = p.id),
      'invited', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', r.id, 'inviteeId', r.invitee_id, 'username', x.username::text, 'status', x.status,
          'state', r.state, 'reason', r.reason, 'signals', r.signals,
          'at', r.created_at, 'settledAt', r.settled_at) order by r.created_at desc)
        from public.referrals r left join public.profiles x on x.id = r.invitee_id
        where r.inviter_id = p.id), '[]'::jsonb),
      'rewards', coalesce((
        select jsonb_object_agg(w.kind, jsonb_build_object('at', w.granted_at, 'source', w.source,
          'revokedAt', w.revoked_at, 'reason', w.revoke_reason))
        from public.rewards w where w.profile_id = p.id), '{}'::jsonb),
      'verifications', coalesce((
        select jsonb_agg(jsonb_build_object('id', v.id, 'state', v.state, 'links', to_jsonb(v.links), 'note', v.note,
          'at', v.created_at, 'decidedAt', v.decided_at, 'declineReason', v.decline_reason) order by v.created_at desc)
        from public.verification_requests v where v.profile_id = p.id), '[]'::jsonb)
    )
    from public.profiles p where p.id = customer
  );
end;
$$;

/** The Referrals page: open verification requests (+ 30 days of decisions), held invites, all rewards. */
create function public.admin_referral_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('customers.view');
  return jsonb_build_object(
    'verifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'customerId', v.profile_id, 'username', p.username::text,
        'name', coalesce(nullif(s.page #>> '{profile,displayName}', ''), p.username::text),
        'verified', p.verified, 'links', to_jsonb(v.links), 'note', v.note, 'state', v.state,
        'at', v.created_at, 'decidedAt', v.decided_at, 'declineReason', v.decline_reason,
        'reviewer', (select u.email from auth.users u where u.id = v.reviewer_id),
        'invites', public.referral_count(v.profile_id)) order by v.created_at)
      from public.verification_requests v
      join public.profiles p on p.id = v.profile_id
      left join public.sites s on s.profile_id = p.id
      where v.state = 'requested' or v.decided_at > now() - interval '30 days'), '[]'::jsonb),
    'held', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'inviterId', r.inviter_id, 'inviter', i.username::text,
        'inviteeId', r.invitee_id, 'invitee', x.username::text,
        'reason', r.reason, 'signals', r.signals, 'at', r.created_at,
        'counted', public.referral_count(r.inviter_id)) order by r.created_at)
      from public.referrals r
      join public.profiles i on i.id = r.inviter_id
      left join public.profiles x on x.id = r.invitee_id
      where r.state = 'held'), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'customerId', w.profile_id, 'username', p.username::text, 'kind', w.kind, 'source', w.source,
        'at', w.granted_at, 'revokedAt', w.revoked_at, 'counted', public.referral_count(w.profile_id))
        order by w.granted_at desc)
      from public.rewards w join public.profiles p on p.id = w.profile_id), '[]'::jsonb)
  );
end;
$$;

/** Count a held invite, remove one (fraud), or restore one. Audited on the inviter. */
create function public.admin_set_referral(referral uuid, next_state public.referral_state, why text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  found_referral public.referrals;
  action text;
begin
  perform public.require_permission('customers.manage');
  if next_state not in ('qualified', 'revoked') then
    raise exception 'linkyo:invalidAction' using errcode = 'P0001';
  end if;
  select * into found_referral from public.referrals where id = referral for update;
  if found_referral.id is null or found_referral.state = 'pending' then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  action := case when next_state = 'revoked' then 'referral.revoke'
                 when found_referral.state = 'held' then 'referral.release'
                 else 'referral.restore' end;
  update public.referrals set
    state = next_state, reason = case when next_state = 'revoked' then 'team' end,
    decided_by = auth.uid(), settled_at = coalesce(settled_at, now())
  where id = referral;
  perform public.audit(action, found_referral.inviter_id, public.customer_label(found_referral.inviter_id),
    jsonb_build_object('referral', referral, 'invitee', coalesce(public.customer_label(found_referral.invitee_id), ''),
      'why', left(coalesce(why, ''), 200)));
  if next_state = 'qualified' then
    perform public.grant_referral_rewards(found_referral.inviter_id);
  end if;
end;
$$;

/** Give or remove a reward by hand. Pro for life needs billing.manage. */
create function public.admin_set_reward(customer uuid, kind public.reward_kind, granted boolean, why text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission(case when kind = 'pro_for_life' then 'billing.manage' else 'customers.manage' end);
  if not exists (select 1 from public.profiles where id = customer) then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if granted then
    -- The conflict target names the key, not its columns: `kind` is also this function's argument.
    insert into public.rewards (profile_id, kind, source) values (customer, admin_set_reward.kind, 'team')
    on conflict on constraint rewards_pkey do update set revoked_at = null, revoked_by = null, revoke_reason = null;
  else
    update public.rewards w set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = left(coalesce(why, ''), 200)
    where w.profile_id = customer and w.kind = admin_set_reward.kind and w.revoked_at is null;
    if not found then
      raise exception 'linkyo:notFound' using errcode = 'P0001';
    end if;
    if kind = 'verification_review' then
      update public.verification_requests set state = 'declined', decline_reason = 'other', decided_at = now(),
        reviewer_id = auth.uid()
      where profile_id = customer and state = 'requested';
    end if;
  end if;
  perform public.audit(case when granted then 'reward.restore' else 'reward.revoke' end, customer,
    public.customer_label(customer), jsonb_build_object('kind', kind, 'why', left(coalesce(why, ''), 200)));
end;
$$;

/** approve (sets the blue check, as admin_set_verified does) or decline (with a reason). */
create function public.admin_review_verification(request uuid, decision text, reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  found_request public.verification_requests;
begin
  perform public.require_permission('creators.verify');
  if decision is null or decision not in ('approve', 'decline') then
    raise exception 'linkyo:invalidAction' using errcode = 'P0001';
  end if;
  select * into found_request from public.verification_requests where id = request for update;
  if found_request.id is null or found_request.state <> 'requested' then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_request.profile_id = auth.uid() then
    raise exception 'linkyo:notYourself' using errcode = 'P0001';
  end if;
  if decision = 'approve' then
    update public.profiles set verified = true where id = found_request.profile_id;
    -- sites_guard copies the badge into the page, as admin_set_verified does.
    update public.sites set updated_at = now() where profile_id = found_request.profile_id;
    update public.verification_requests set state = 'approved', reviewer_id = auth.uid(), decided_at = now()
    where id = request;
  else
    if reason is null or reason not in ('profileNotLinked', 'identityUnclear', 'impersonation', 'other') then
      raise exception 'linkyo:invalidAction' using errcode = 'P0001';
    end if;
    update public.verification_requests set state = 'declined', decline_reason = reason, reviewer_id = auth.uid(),
      decided_at = now()
    where id = request;
  end if;
  perform public.audit('verification.' || decision, found_request.profile_id,
    public.customer_label(found_request.profile_id), jsonb_build_object('request', request, 'reason', reason));
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────────
-- Functions are executable by PUBLIC by default; the internal ones by nobody but their owner, and
-- settle_referral by our server.
revoke execute on function public.new_referral_code(), public.email_identity(text), public.same_network(inet, inet),
  public.referrals_forget(), public.referral_count(uuid), public.grant_referral_rewards(uuid),
  public.settle_referral(uuid, text), public.settle_pending_referrals()
  from public, anon, authenticated;
grant execute on function public.settle_referral(uuid, text) to service_role;
revoke execute on function public.my_referrals(), public.my_verification_requests(), public.request_verification(text[], text),
  public.admin_customer_referrals(uuid), public.admin_referral_queue(),
  public.admin_set_referral(uuid, public.referral_state, text),
  public.admin_set_reward(uuid, public.reward_kind, boolean, text),
  public.admin_review_verification(uuid, text, text)
  from public, anon;
grant execute on function public.my_referrals(), public.my_verification_requests(), public.request_verification(text[], text),
  public.admin_customer_referrals(uuid), public.admin_referral_queue(),
  public.admin_set_referral(uuid, public.referral_state, text),
  public.admin_set_reward(uuid, public.reward_kind, boolean, text),
  public.admin_review_verification(uuid, text, text)
  to authenticated;
grant execute on function public.referral_inviter(text) to anon, authenticated;
