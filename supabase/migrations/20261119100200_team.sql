-- The team console on real data: roles → permissions, subscriptions and invoices, notes, the
-- activity log, and team-only functions for every console action (ADR 0016, 0028, 0030).
-- Every function checks the caller's permission first and writes the activity log.

-- ── Team and permissions ────────────────────────────────────────────────────────────────────
create type public.team_role as enum ('owner', 'admin', 'editor', 'viewer');

-- Mirrors ROLE_PERMISSIONS in apps/web/src/features/admin/types.ts (a test compares them).
create table public.role_permissions (
  role public.team_role not null,
  permission text not null,
  primary key (role, permission)
);
alter table public.role_permissions enable row level security;
create policy "everyone signed in reads the role table" on public.role_permissions
  for select to authenticated using (true);
revoke insert, update, delete on public.role_permissions from authenticated, anon;

insert into public.role_permissions (role, permission)
select 'owner', permission from unnest(array[
  'pages.create', 'pages.edit', 'pages.publish', 'pages.delete', 'creators.verify', 'invites.manage',
  'team.manage', 'activity.view', 'customers.view', 'customers.manage', 'customers.delete',
  'billing.view', 'billing.manage', 'security.view', 'security.manage', 'analytics.view'
]) as permission;
insert into public.role_permissions (role, permission)
select 'admin', permission from public.role_permissions
where role = 'owner' and permission not in ('team.manage', 'customers.delete');
insert into public.role_permissions (role, permission)
select 'editor', permission from unnest(array[
  'pages.create', 'pages.edit', 'activity.view', 'customers.view', 'analytics.view'
]) as permission;
insert into public.role_permissions (role, permission)
select 'viewer', permission from unnest(array[
  'activity.view', 'customers.view', 'billing.view', 'security.view', 'analytics.view'
]) as permission;

create table public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.team_role not null,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);
alter table public.team_members enable row level security;
revoke insert, update, delete on public.team_members from authenticated, anon;

/** The caller's team role, or null for customers. */
create function public.my_team_role() returns public.team_role
language sql stable security definer set search_path = '' as $$
  select role from public.team_members where user_id = auth.uid();
$$;
grant execute on function public.my_team_role() to authenticated;

create function public.has_permission(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members m
    join public.role_permissions r on r.role = m.role
    where m.user_id = auth.uid() and r.permission = wanted
  );
$$;
grant execute on function public.has_permission(text) to authenticated;

create policy "team members see the team" on public.team_members
  for select to authenticated using (public.my_team_role() is not null);

create function public.require_permission(wanted text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission(wanted) then
    raise exception 'linkyo:forbidden' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.require_permission(text) from public, anon, authenticated;

-- ── Activity log ────────────────────────────────────────────────────────────────────────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  actor text not null,
  action text not null,
  -- No foreign key: the entry stays when the customer is deleted.
  target_id uuid,
  target text not null default '',
  details jsonb not null default '{}'::jsonb
);
create index audit_log_at on public.audit_log (at desc);
alter table public.audit_log enable row level security;
create policy "team reads the activity log" on public.audit_log
  for select to authenticated using (public.has_permission('activity.view'));
revoke insert, update, delete on public.audit_log from authenticated, anon;

create function public.audit(action text, target_id uuid, target text, details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, actor, action, target_id, target, details)
  values (
    auth.uid(),
    coalesce((select email from auth.users where id = auth.uid()), 'system'),
    audit.action, audit.target_id, coalesce(audit.target, ''), coalesce(audit.details, '{}'::jsonb)
  );
end;
$$;
revoke execute on function public.audit(text, uuid, text, jsonb) from public, anon, authenticated;

-- ── Subscriptions and invoices ──────────────────────────────────────────────────────────────
create type public.plan as enum ('free', 'pro');
create type public.subscription_status as enum ('active', 'trialing', 'past_due', 'canceled');

create table public.subscriptions (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  plan public.plan not null default 'free',
  status public.subscription_status,
  started_at timestamptz,
  renews_at timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint free_has_no_status check (plan <> 'free' or status is null)
);
alter table public.subscriptions enable row level security;
create policy "owners read their subscription" on public.subscriptions
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "billing team reads subscriptions" on public.subscriptions
  for select to authenticated using (public.has_permission('billing.view'));
revoke insert, update, delete on public.subscriptions from authenticated, anon;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table public.invoices (
  id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now(),
  amount_cents integer not null constraint amount_positive check (amount_cents >= 0),
  status text not null constraint status_known check (status in ('paid', 'failed', 'refunded'))
);
create index invoices_profile on public.invoices (profile_id, at desc);
alter table public.invoices enable row level security;
create policy "owners read their invoices" on public.invoices
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "billing team reads invoices" on public.invoices
  for select to authenticated using (public.has_permission('billing.view'));
revoke insert, update, delete on public.invoices from authenticated, anon;

-- ── Notes about customers (team only) ───────────────────────────────────────────────────────
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author text not null,
  body text not null constraint body_length check (char_length(body) between 1 and 2000),
  at timestamptz not null default now()
);
create index customer_notes_customer on public.customer_notes (customer_id, at desc);
alter table public.customer_notes enable row level security;
create policy "team reads notes" on public.customer_notes
  for select to authenticated using (public.has_permission('customers.view'));
revoke insert, update, delete on public.customer_notes from authenticated, anon;

-- The team reads blocked addresses (security), never customers.
grant select on public.blocked_ips to authenticated;
create policy "security team reads blocked addresses" on public.blocked_ips
  for select to authenticated using (public.has_permission('security.view'));

-- The team reads sign-ins of every account (security), customers only their own.
create policy "security team reads sign-ins" on public.sign_ins
  for select to authenticated using (public.has_permission('security.view'));

-- ── Reading: everything the console shows, in the shape the screens use ─────────────────────
/** The caller's role and permissions; null when the caller is not on the team. */
create function public.admin_me() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when m.role is null then null else jsonb_build_object(
    'role', m.role,
    'email', (select email from auth.users where id = auth.uid()),
    'permissions', (select coalesce(jsonb_agg(permission order by permission), '[]'::jsonb)
                    from public.role_permissions where role = m.role)
  ) end
  from (select public.my_team_role() as role) m;
$$;
grant execute on function public.admin_me() to authenticated;

create function public.admin_customers() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  billing boolean := public.has_permission('billing.view');
  security boolean := public.has_permission('security.view');
begin
  perform public.require_permission('customers.view');
  return coalesce((
    select jsonb_agg(customer order by created desc)
    from (
      select p.created_at as created, jsonb_build_object(
        'id', p.id,
        'name', coalesce(nullif(s.page #>> '{profile,displayName}', ''), p.username::text),
        'email', u.email,
        'username', p.username::text,
        'locale', p.locale,
        'country', coalesce(latest.country, ''),
        'city', latest.city,
        'createdAt', p.created_at,
        'lastSeenAt', coalesce(p.last_seen_at, p.created_at),
        'status', p.status,
        'verified', p.verified,
        'subscription', jsonb_build_object(
          'plan', coalesce(sub.plan, 'free'),
          'status', case when billing then sub.status end,
          'startedAt', case when billing then sub.started_at end,
          'renewsAt', case when billing then sub.renews_at end,
          'trialEndsAt', case when billing then sub.trial_ends_at end,
          'canceledAt', case when billing then sub.canceled_at end,
          'invoices', case when billing then coalesce((
            select jsonb_agg(jsonb_build_object('id', i.id, 'at', i.at, 'amount', i.amount_cents, 'status', i.status)
                             order by i.at desc)
            from public.invoices i where i.profile_id = p.id
          ), '[]'::jsonb) else '[]'::jsonb end
        ),
        'usage', jsonb_build_object(
          'kind', coalesce(s.kind, 'other'),
          'template', coalesce(s.theme ->> 'template', ''),
          'blocks', coalesce(jsonb_array_length(s.page -> 'blocks'), 0),
          'onboarded', coalesce(s.onboarded, false),
          'views30', 0,
          'clicks30', 0
        ),
        'logins', case when security then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', l.id, 'at', l.at, 'ip', host(l.ip), 'country', l.country, 'city', l.city,
            'device', l.device, 'deviceId', l.device_id, 'signature', l.signature, 'result', l.result,
            'active', l.session_id is not null and exists (select 1 from auth.sessions x where x.id = l.session_id)
          ) order by l.at desc)
          from public.sign_ins l where l.profile_id = p.id
        ), '[]'::jsonb) else '[]'::jsonb end,
        'notes', coalesce((
          select jsonb_agg(jsonb_build_object('id', n.id, 'at', n.at, 'author', n.author, 'text', n.body)
                           order by n.at desc)
          from public.customer_notes n where n.customer_id = p.id
        ), '[]'::jsonb)
      ) as customer
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.sites s on s.profile_id = p.id
      left join public.subscriptions sub on sub.profile_id = p.id
      left join lateral (
        select l.country, l.city from public.sign_ins l
        where l.profile_id = p.id and l.result = 'success'
        order by l.at desc limit 1
      ) latest on true
    ) rows
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_customers() to authenticated;

create function public.admin_blocked_ips() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('security.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'ip', host(b.ip), 'at', b.created_at, 'reason', b.reason,
      'by', coalesce((select email from auth.users where id = b.blocked_by), '')
    ) order by b.created_at desc)
    from public.blocked_ips b
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_blocked_ips() to authenticated;

create function public.admin_activity(max_rows integer default 200) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('activity.view');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id::text, 'at', a.at, 'actor', a.actor, 'action', a.action,
      'target', a.target, 'targetId', a.target_id, 'details', a.details
    ) order by a.at desc, a.id desc)
    from (select * from public.audit_log order by at desc, id desc limit least(greatest(max_rows, 1), 1000)) a
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_activity(integer) to authenticated;

-- ── Writing: one function per console action ────────────────────────────────────────────────
create function public.customer_label(customer uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(p.username::text, customer::text) from public.profiles p where p.id = customer;
$$;
revoke execute on function public.customer_label(uuid) from public, anon, authenticated;

/** Suspends an account (signs it out everywhere) or lets it back in. */
create function public.admin_set_status(customer uuid, next public.account_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('customers.manage');
  if customer = auth.uid() then
    raise exception 'linkyo:notYourself' using errcode = 'P0001';
  end if;
  update public.profiles set status = next where id = customer;
  if not found then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if next = 'suspended' then
    delete from auth.sessions where user_id = customer;
  end if;
  perform public.audit(
    case when next = 'suspended' then 'customer.suspend' else 'customer.unsuspend' end,
    customer, public.customer_label(customer)
  );
end;
$$;
grant execute on function public.admin_set_status(uuid, public.account_status) to authenticated;

/** The verified badge; the page shows it right away (sites_guard copies it into the page). */
create function public.admin_set_verified(customer uuid, value boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('creators.verify');
  update public.profiles set verified = value where id = customer;
  if not found then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  update public.sites set updated_at = now() where profile_id = customer;
  perform public.audit(case when value then 'customer.verify' else 'customer.unverify' end,
    customer, public.customer_label(customer));
end;
$$;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

/**
 * Changes a subscription by hand (support cases; Stripe will write the same table). `action` is
 * what the console did, for the activity log: plan, trial, cancel or resume.
 */
create function public.admin_set_subscription(
  customer uuid,
  action text,
  plan public.plan,
  status public.subscription_status default null,
  started_at timestamptz default null,
  trial_ends_at timestamptz default null,
  canceled_at timestamptz default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('billing.manage');
  if action not in ('plan', 'trial', 'cancel', 'resume') then
    raise exception 'linkyo:invalidAction' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = customer) then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  insert into public.subscriptions as s (profile_id, plan, status, started_at, trial_ends_at, canceled_at)
  values (
    customer, admin_set_subscription.plan,
    case when admin_set_subscription.plan = 'free' then null else admin_set_subscription.status end,
    admin_set_subscription.started_at, admin_set_subscription.trial_ends_at, admin_set_subscription.canceled_at
  )
  on conflict (profile_id) do update set
    plan = excluded.plan, status = excluded.status, started_at = excluded.started_at,
    trial_ends_at = excluded.trial_ends_at, canceled_at = excluded.canceled_at;
  perform public.audit('customer.' || action, customer, public.customer_label(customer),
    jsonb_build_object('plan', admin_set_subscription.plan, 'status', admin_set_subscription.status));
end;
$$;
grant execute on function public.admin_set_subscription(uuid, text, public.plan, public.subscription_status, timestamptz, timestamptz, timestamptz)
  to authenticated;

create function public.admin_refund_invoice(invoice text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  customer uuid;
begin
  perform public.require_permission('billing.manage');
  update public.invoices set status = 'refunded' where id = invoice and status = 'paid'
    returning profile_id into customer;
  if customer is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  perform public.audit('customer.refund', customer, public.customer_label(customer),
    jsonb_build_object('invoice', invoice));
end;
$$;
grant execute on function public.admin_refund_invoice(text) to authenticated;

create function public.admin_add_note(customer uuid, body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  note public.customer_notes;
begin
  perform public.require_permission('customers.manage');
  insert into public.customer_notes (customer_id, author_id, author, body)
  values (customer, auth.uid(), coalesce((select email from auth.users where id = auth.uid()), ''), trim(body))
  returning * into note;
  perform public.audit('customer.note', customer, public.customer_label(customer));
  return jsonb_build_object('id', note.id, 'at', note.at, 'author', note.author, 'text', note.body);
end;
$$;
grant execute on function public.admin_add_note(uuid, text) to authenticated;

create function public.admin_block_ip(address inet, why text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('security.manage');
  insert into public.blocked_ips (ip, reason, blocked_by) values (address, left(coalesce(why, ''), 200), auth.uid())
  on conflict (ip) do update set reason = excluded.reason, blocked_by = excluded.blocked_by, created_at = now();
  perform public.audit('ip.block', null, host(address), jsonb_build_object('reason', why));
end;
$$;
grant execute on function public.admin_block_ip(inet, text) to authenticated;

create function public.admin_unblock_ip(address inet) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('security.manage');
  delete from public.blocked_ips where ip = address;
  perform public.audit('ip.unblock', null, host(address));
end;
$$;
grant execute on function public.admin_unblock_ip(inet) to authenticated;

/** Signs one device out: ends the auth sessions its sign-ins opened. */
create function public.admin_sign_out_device(customer uuid, device text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  ended integer;
begin
  perform public.require_permission('security.manage');
  delete from auth.sessions
  where user_id = customer
    and id in (
      select s.session_id from public.sign_ins s
      where s.profile_id = customer and s.device_id = admin_sign_out_device.device
    );
  get diagnostics ended = row_count;
  perform public.audit('customer.signout', customer, public.customer_label(customer),
    jsonb_build_object('device', admin_sign_out_device.device, 'sessions', ended));
  return ended;
end;
$$;
grant execute on function public.admin_sign_out_device(uuid, text) to authenticated;

/** Deletes a customer and everything they own. Owners only; never yourself or a team member. */
create function public.admin_delete_customer(customer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  label text := public.customer_label(customer);
begin
  perform public.require_permission('customers.delete');
  if customer = auth.uid() or exists (select 1 from public.team_members where user_id = customer) then
    raise exception 'linkyo:notYourself' using errcode = 'P0001';
  end if;
  delete from auth.users where id = customer;
  if not found then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  perform public.audit('customer.delete', customer, coalesce(label, ''));
end;
$$;
grant execute on function public.admin_delete_customer(uuid) to authenticated;

-- ── The team itself ─────────────────────────────────────────────────────────────────────────
create function public.admin_team() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.my_team_role() is null then
    raise exception 'linkyo:forbidden' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.user_id, 'email', u.email, 'role', m.role, 'addedAt', m.added_at,
      'name', coalesce(nullif(s.page #>> '{profile,displayName}', ''), split_part(u.email, '@', 1))
    ) order by m.added_at)
    from public.team_members m
    join auth.users u on u.id = m.user_id
    left join public.sites s on s.profile_id = m.user_id
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_team() to authenticated;

/** Adds someone who already has an account to the team (they sign up first). */
create function public.admin_add_member(member_email text, member_role public.team_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  member uuid;
begin
  perform public.require_permission('team.manage');
  select id into member from auth.users where lower(email) = lower(trim(member_email));
  if member is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  insert into public.team_members (user_id, role, added_by) values (member, member_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role;
  perform public.audit('member.add', member, lower(trim(member_email)), jsonb_build_object('role', member_role));
end;
$$;
grant execute on function public.admin_add_member(text, public.team_role) to authenticated;

create function public.admin_set_role(member uuid, member_role public.team_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('team.manage');
  if member_role <> 'owner'
     and (select role from public.team_members where user_id = member) = 'owner'
     and (select count(*) from public.team_members where role = 'owner') = 1 then
    raise exception 'linkyo:lastOwner' using errcode = 'P0001';
  end if;
  update public.team_members set role = member_role where user_id = member;
  if not found then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  perform public.audit('member.role', member, coalesce((select email from auth.users where id = member), ''),
    jsonb_build_object('role', member_role));
end;
$$;
grant execute on function public.admin_set_role(uuid, public.team_role) to authenticated;

create function public.admin_remove_member(member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('team.manage');
  if (select role from public.team_members where user_id = member) = 'owner'
     and (select count(*) from public.team_members where role = 'owner') = 1 then
    raise exception 'linkyo:lastOwner' using errcode = 'P0001';
  end if;
  delete from public.team_members where user_id = member;
  perform public.audit('member.remove', member, coalesce((select email from auth.users where id = member), ''));
end;
$$;
grant execute on function public.admin_remove_member(uuid) to authenticated;

/**
 * Makes the first owner. Run once, by hand, in the SQL editor (or with the secret key):
 *   select public.make_owner('founder@example.com');
 * Not callable from the browser, so nobody can promote themselves.
 */
create function public.make_owner(owner_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  member uuid;
begin
  select id into member from auth.users where lower(email) = lower(trim(owner_email));
  if member is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  insert into public.team_members (user_id, role) values (member, 'owner')
  on conflict (user_id) do update set role = 'owner';
  insert into public.audit_log (actor_id, actor, action, target_id, target)
  values (null, 'system', 'team.setup', member, lower(trim(owner_email)));
end;
$$;
revoke execute on function public.make_owner(text) from public, anon, authenticated;
grant execute on function public.make_owner(text) to service_role;

-- Functions are executable by PUBLIC by default in Postgres; anon gets none of the team ones.
revoke execute on function public.admin_me(), public.admin_customers(), public.admin_blocked_ips(),
  public.admin_activity(integer), public.admin_set_status(uuid, public.account_status),
  public.admin_set_verified(uuid, boolean),
  public.admin_set_subscription(uuid, text, public.plan, public.subscription_status, timestamptz, timestamptz, timestamptz),
  public.admin_refund_invoice(text), public.admin_add_note(uuid, text), public.admin_block_ip(inet, text),
  public.admin_unblock_ip(inet), public.admin_sign_out_device(uuid, text), public.admin_delete_customer(uuid),
  public.admin_team(), public.admin_add_member(text, public.team_role), public.admin_set_role(uuid, public.team_role),
  public.admin_remove_member(uuid), public.my_team_role(), public.has_permission(text)
  from public, anon;
