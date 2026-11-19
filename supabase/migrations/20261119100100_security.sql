-- Account security: the sign-in log (30 days) and blocked addresses (ADR 0028, ADR 0030).
-- Only our server writes sign-ins: it performs the sign-in itself, so result, IP and device are
-- what really happened, not what a browser claims.

create table public.sign_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  result text not null constraint result_known check (result in ('success', 'failed')),
  ip inet not null,
  country text constraint country_code check (country is null or country ~ '^[A-Z]{2}$'),
  city text constraint city_short check (char_length(city) <= 80),
  device jsonb not null default '{}'::jsonb,
  device_id text not null constraint device_id_short check (char_length(device_id) <= 64),
  signature text constraint signature_short check (char_length(signature) <= 128),
  -- The auth session a successful sign-in opened, so the team can sign that device out.
  session_id uuid
);
create index sign_ins_profile on public.sign_ins (profile_id, at desc);
create index sign_ins_ip on public.sign_ins (ip);
create index sign_ins_at on public.sign_ins (at);

alter table public.sign_ins enable row level security;
create policy "owners read their sign-ins" on public.sign_ins
  for select to authenticated using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.sign_ins from authenticated, anon;

create table public.blocked_ips (
  ip inet primary key,
  reason text not null default '' constraint reason_short check (char_length(reason) <= 200),
  blocked_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.blocked_ips enable row level security;
-- Read by the team through functions (see team migration); never by customers.
revoke all on public.blocked_ips from authenticated, anon;

/** Is this address blocked? Asked by our server before every sign-in and sign-up. */
create function public.is_ip_blocked(address inet) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocked_ips where ip = address);
$$;
revoke execute on function public.is_ip_blocked(inet) from public, anon, authenticated;
grant execute on function public.is_ip_blocked(inet) to service_role;

/**
 * Records one sign-in for the account with this email (server only). Unknown emails record
 * nothing: there is no account to protect, and no one to show it to.
 */
create function public.record_sign_in(
  email text,
  result text,
  ip inet,
  country text,
  city text,
  device jsonb,
  device_id text,
  signature text,
  session_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  account uuid;
begin
  select id into account from auth.users where lower(auth.users.email) = lower(trim(record_sign_in.email));
  if account is null then
    return;
  end if;
  insert into public.sign_ins (profile_id, result, ip, country, city, device, device_id, signature, session_id)
  values (
    account, record_sign_in.result, record_sign_in.ip,
    nullif(upper(record_sign_in.country), ''), nullif(left(record_sign_in.city, 80), ''),
    coalesce(record_sign_in.device, '{}'::jsonb), left(record_sign_in.device_id, 64),
    nullif(left(record_sign_in.signature, 128), ''), record_sign_in.session_id
  );
  if record_sign_in.result = 'success' then
    update public.profiles set last_seen_at = now() where id = account;
  end if;
end;
$$;
revoke execute on function public.record_sign_in(text, text, inet, text, text, jsonb, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_sign_in(text, text, inet, text, text, jsonb, text, text, uuid)
  to service_role;

/** Failed attempts for this email in the last 15 minutes (server: slows down password guessing). */
create function public.recent_failures(email text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer
  from public.sign_ins s
  join auth.users u on u.id = s.profile_id
  where lower(u.email) = lower(trim(recent_failures.email))
    and s.result = 'failed' and s.at > now() - interval '15 minutes';
$$;
revoke execute on function public.recent_failures(text) from public, anon, authenticated;
grant execute on function public.recent_failures(text) to service_role;

-- ── Retention: sign-ins are kept 30 days, then deleted ──────────────────────────────────────
create function public.purge_old_sign_ins() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.sign_ins where at < now() - interval '30 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke execute on function public.purge_old_sign_ins() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('linkyo-purge-sign-ins', '17 3 * * *', 'select public.purge_old_sign_ins()');
