-- Team money and permissions (Stage 1 WP1.1; ADR 0073, team money through Stripe). Tests:
-- supabase/tests/admin_money.test.sql. Functions keep their signatures, `security definer`,
-- `search_path` and grants; new ones name theirs. Nothing here deletes customer data.
--
-- 1. Money moves only through Stripe. `admin_refund_invoice` (a refund that only wrote "refunded")
--    is the server's alone now. The console's refund, cancel and resume go through server routes:
--    the member's permission is checked here first (`admin_pro_refund_target`,
--    `admin_pro_subscription_target`), then the route asks Stripe and records what Stripe did with
--    `record_refund` / `upsert_pro_subscription`, as the orders refund does, and only then logs it
--    as the member (`admin_pro_money_done`, which writes only what the records show). The console's
--    "resume" leaves a customer's own cancellation (/kuendigen) alone: that one is taken back under
--    withdrawals and cancellations.
-- 2. `orders.view`: the page-service queue and its orders, for every role (editors fulfil orders).
--    The queue, one order, the order tables' policies and the invite program's team reads ask for it
--    instead of `customers.view`.
-- 3. Editors no longer see customers (least privilege): no `customers.view`, so no e-mail address in
--    the console. Orders show the customer's address only to roles that may see customers; the
--    browser cannot read `orders.customer_email` directly any more (column grants).
-- 4. `customers.export` (owners and admins): the CSV export, logged as `customer.export`.
-- 5. `admin_customers()` says where Pro comes from (Stripe or the team), whether a Stripe
--    subscription ends at its period end and whether the customer cancelled it themselves; roles with `analytics.view` but not `customers.view` get
--    the rows without name, e-mail, city and notes (the numbers on Overview and Analytics).
--
-- Rollback (one line): re-run the definitions of admin_customers (team.sql), admin_customer_referrals and
-- admin_referral_queue (referrals.sql), admin_orders and admin_order (billing.sql); alter the three policies
-- back to has_permission('customers.view'); grant select on public.orders to authenticated; grant execute
-- on admin_refund_invoice(text) to authenticated; insert ('editor','customers.view'); delete the role rows
-- for orders.view and customers.export; drop admin_pro_refund_target, admin_pro_subscription_target,
-- admin_pro_money_done and admin_customers_exported.

-- ── Roles ───────────────────────────────────────────────────────────────────────────────────
-- Mirrors ROLE_PERMISSIONS in apps/web/src/features/admin/types.ts.
insert into public.role_permissions (role, permission) values
  ('owner', 'orders.view'), ('admin', 'orders.view'), ('editor', 'orders.view'), ('viewer', 'orders.view'),
  ('owner', 'customers.export'), ('admin', 'customers.export')
on conflict (role, permission) do nothing;
delete from public.role_permissions where role = 'editor' and permission = 'customers.view';

-- ── Orders: readable with orders.view ───────────────────────────────────────────────────────
alter policy "team reads orders" on public.orders using (public.has_permission('orders.view'));
alter policy "team reads order events" on public.order_events using (public.has_permission('orders.view'));
alter policy "team reads proposals" on public.site_proposals using (public.has_permission('orders.view'));

-- The customer's address stays out of reach of the browser: rows are readable by the owner and the
-- team, every column but `customer_email` (the server and the functions below read it).
revoke select on public.orders from authenticated;
grant select (
  id, number, profile_id, customer_name, package, status, locale, amount_cents, currency, vat_mode, early_start,
  early_start_text, ordered_at, start_after, promised_due_at, briefing, briefed_at, due_at, assignee,
  revisions_allowed, revisions_used, revision_due_at, confirmation_sent_at, delivered_at, completed_at,
  refunded_at, refund_kind, withdrawal_pending, withdrawn_at, stripe_session_id, stripe_payment_intent,
  created_at, updated_at
) on public.orders to authenticated;

/** The queue. Only orders whose confirmation went out; withdrawals waiting for a decision first. */
create or replace function public.admin_orders(scope text default 'open') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  people boolean := public.has_permission('customers.view');
begin
  perform public.require_permission('orders.view');
  if scope is null or scope not in ('open', 'mine', 'delivered', 'all') then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'number', o.number, 'package', o.package, 'status', o.status,
      'withdrawalPending', o.withdrawal_pending,
      'customer', jsonb_build_object('id', o.profile_id, 'username', p.username::text,
        'email', case when people then coalesce(u.email, o.customer_email) end),
      'orderedAt', o.ordered_at, 'dueAt', o.due_at, 'promisedDueAt', o.promised_due_at,
      'revisionDueAt', o.revision_due_at,
      'assignee', case when o.assignee is null then null else jsonb_build_object('id', o.assignee, 'label', a.email) end,
      'revisionsLeft', greatest(o.revisions_allowed - o.revisions_used, 0)
    ) order by o.withdrawal_pending desc, coalesce(o.revision_due_at, o.due_at, o.promised_due_at), o.ordered_at)
    from public.orders o
    left join public.profiles p on p.id = o.profile_id
    left join auth.users u on u.id = o.profile_id
    left join auth.users a on a.id = o.assignee
    where o.confirmation_sent_at is not null
      and case scope
        when 'open' then o.status not in ('delivered', 'completed', 'refunded', 'withdrawn') or o.withdrawal_pending
        when 'mine' then o.assignee = auth.uid()
        when 'delivered' then o.status in ('delivered', 'completed')
        else true
      end
  ), '[]'::jsonb);
end;
$$;

/**
 * One order for the team: briefing, timeline, proposals and the customer's current page. The
 * customer's address (and their own address as the actor of a timeline entry) only for roles that
 * may see customers; team members' addresses stay.
 */
create or replace function public.admin_order(target uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  people boolean := public.has_permission('customers.view');
  result jsonb;
begin
  perform public.require_permission('orders.view');
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'package', o.package, 'status', o.status, 'locale', o.locale,
    'amountCents', o.amount_cents, 'vatMode', o.vat_mode, 'earlyStart', o.early_start,
    'withdrawalPending', o.withdrawal_pending,
    'customer', jsonb_build_object('id', o.profile_id, 'username', p.username::text,
      'email', case when people then coalesce(u.email, o.customer_email) end, 'name', o.customer_name),
    'orderedAt', o.ordered_at, 'startAfter', o.start_after, 'promisedDueAt', o.promised_due_at, 'dueAt', o.due_at,
    'briefedAt', o.briefed_at, 'briefing', o.briefing, 'confirmationSentAt', o.confirmation_sent_at,
    'assignee', case when o.assignee is null then null else jsonb_build_object('id', o.assignee, 'label', a.email) end,
    'revisionsAllowed', o.revisions_allowed, 'revisionsUsed', o.revisions_used,
    'revisionsLeft', greatest(o.revisions_allowed - o.revisions_used, 0), 'revisionDueAt', o.revision_due_at,
    'deliveredAt', o.delivered_at, 'completedAt', o.completed_at, 'refundedAt', o.refunded_at,
    'refundKind', o.refund_kind, 'withdrawnAt', o.withdrawn_at,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'at', e.at, 'kind', e.kind, 'details', e.details,
        'actor', (select x.email from auth.users x
                  where x.id = e.actor
                    and (people or exists (select 1 from public.team_members m where m.user_id = e.actor))))
        order by e.at desc, e.id desc)
      from public.order_events e where e.order_id = o.id
    ), '[]'::jsonb),
    'proposals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'round', r.round, 'status', r.status, 'page', r.page, 'theme', r.theme, 'kind', r.kind,
        'message', r.message, 'request', r.request, 'extras', r.extras, 'storyPaths', to_jsonb(r.story_paths),
        'aiAssisted', public.page_has_ai(r.page), 'updatedAt', r.updated_at, 'deliveredAt', r.delivered_at,
        'appliedAt', r.applied_at
      ) order by r.round desc)
      from public.site_proposals r where r.order_id = o.id
    ), '[]'::jsonb),
    'site', (select jsonb_build_object('kind', s.kind, 'page', s.page, 'theme', s.theme)
             from public.sites s where s.profile_id = o.profile_id)
  ) into result
  from public.orders o
  left join public.profiles p on p.id = o.profile_id
  left join auth.users u on u.id = o.profile_id
  left join auth.users a on a.id = o.assignee
  where o.id = target;
  if result is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  return result;
end;
$$;

-- ── The invite program's team reads: with the Referrals screen (orders.view) ────────────────
-- Neither returns an e-mail address. Every role that may see customers may also see orders.

/** One customer's invites, rewards and requests (the Invites tab). */
create or replace function public.admin_customer_referrals(customer uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('orders.view');
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
create or replace function public.admin_referral_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('orders.view');
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

-- ── Customers: where Pro comes from; the numbers without names for analytics ───────────────
create or replace function public.admin_customers() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  people boolean := public.has_permission('customers.view');
  billing boolean := public.has_permission('billing.view');
  security boolean := public.has_permission('security.view');
begin
  if not people then
    -- Overview and Analytics count customers; without customers.view nobody is named.
    perform public.require_permission('analytics.view');
  end if;
  return coalesce((
    select jsonb_agg(customer order by created desc)
    from (
      select p.created_at as created, jsonb_build_object(
        'id', p.id,
        'name', case when people then coalesce(nullif(s.page #>> '{profile,displayName}', ''), p.username::text)
                     else p.username::text end,
        'email', case when people then u.email end,
        'username', p.username::text,
        'locale', p.locale,
        'country', coalesce(latest.country, ''),
        'city', case when people then latest.city end,
        'createdAt', p.created_at,
        'lastSeenAt', coalesce(p.last_seen_at, p.created_at),
        'status', p.status,
        'verified', p.verified,
        'subscription', jsonb_build_object(
          'plan', coalesce(sub.plan, 'free'),
          'status', case when billing then sub.status end,
          -- Stripe: a running Stripe subscription; team: Pro the team set by hand (no money).
          'source', case when billing then
            case when stripe.subscription is not null then 'stripe'
                 when sub.plan = 'pro' then 'team' end end,
          'cancelAtPeriodEnd', case when billing and stripe.subscription is not null
            then stripe.cancel_at_period_end or stripe.cancel_at is not null end,
          'endsAt', case when billing and stripe.subscription is not null
            then coalesce(stripe.cancel_at, case when stripe.cancel_at_period_end then stripe.current_period_end end) end,
          -- The customer cancelled through /kuendigen (open or scheduled): the console offers no "resume".
          'cancelledByCustomer', case when billing and stripe.subscription is not null then exists (
            select 1 from public.cancellations c
            where c.entitlement_id = stripe.id
              and (c.decision = 'scheduled' or (c.decision is null and c.handled_at is null))
          ) end,
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
          -- Not measured yet (cookie-free analytics comes later): the console says so.
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
        'notes', case when people then coalesce((
          select jsonb_agg(jsonb_build_object('id', n.id, 'at', n.at, 'author', n.author, 'text', n.body)
                           order by n.at desc)
          from public.customer_notes n where n.customer_id = p.id
        ), '[]'::jsonb) else '[]'::jsonb end
      ) as customer
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.sites s on s.profile_id = p.id
      left join public.subscriptions sub on sub.profile_id = p.id
      left join lateral (
        select e.id, e.stripe_subscription_id as subscription, e.cancel_at_period_end, e.cancel_at, e.current_period_end
        from public.entitlements e
        where e.profile_id = p.id and e.source = 'stripe' and e.status in ('active', 'past_due')
        order by e.created_at desc limit 1
      ) stripe on true
      left join lateral (
        select l.country, l.city from public.sign_ins l
        where l.profile_id = p.id and l.result = 'success'
        order by l.at desc limit 1
      ) latest on true
    ) rows
  ), '[]'::jsonb);
end;
$$;

-- ── Money: the member decides, the server asks Stripe ───────────────────────────────────────
-- A refund that only wrote "refunded" told the team money went back when it did not.
revoke execute on function public.admin_refund_invoice(text) from authenticated;
grant execute on function public.admin_refund_invoice(text) to service_role;

/**
 * The team refunds a paid Pro invoice. Called as the member before the route asks Stripe: checks
 * `billing.manage` and answers what to refund (the log follows once Stripe refunded and it is on
 * record: admin_pro_money_done). Refused
 * with linkyo:notFound (not this customer's invoice) or linkyo:locked (not paid: failed or already
 * refunded; or a withdrawal of this subscription waits: that refund is decided under withdrawals
 * and cancellations). The route records it as Stripe's webhook does ('goodwill'): Pro goes on,
 * only an accepted withdrawal reverses the contract (record_refund).
 */
create function public.admin_pro_refund_target(customer uuid, invoice text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_invoice public.invoices;
begin
  perform public.require_permission('billing.manage');
  select * into found_invoice from public.invoices i
  where i.id = admin_pro_refund_target.invoice and i.profile_id = admin_pro_refund_target.customer
  for update;
  if found_invoice.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_invoice.status <> 'paid' or (found_invoice.subscription is not null and exists (
       select 1 from public.withdrawals w
       join public.entitlements e on e.id = w.entitlement_id
       where e.stripe_subscription_id = found_invoice.subscription
         and w.handled_at is null and w.decision is distinct from 'rejected'
     )) then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'paymentIntent', found_invoice.payment_intent,
    'amountCents', found_invoice.amount_cents,
    'locale', (select p.locale from public.profiles p where p.id = admin_pro_refund_target.customer)
  );
end;
$$;

/**
 * The team ends a customer's Stripe Pro at the end of the paid period ('cancel') or takes that back
 * ('resume'). Called as the member before the route asks Stripe: checks `billing.manage` and answers
 * the subscription (the log follows once Stripe did it: admin_pro_money_done). linkyo:notFound
 * without a running Stripe subscription (Pro the team gave by hand is changed with
 * admin_set_subscription; no money is involved there). linkyo:customerCancelled for 'resume' while
 * the customer's own cancellation (/kuendigen, § 312k BGB) is open or scheduled: taking that back
 * needs the customer's request and is done under withdrawals and cancellations, where the
 * cancellation is marked 'resumed'.
 */
create function public.admin_pro_subscription_target(customer uuid, action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_entitlement public.entitlements;
begin
  perform public.require_permission('billing.manage');
  if action is null or action not in ('cancel', 'resume') then
    raise exception 'linkyo:invalidAction' using errcode = 'P0001';
  end if;
  select * into found_entitlement from public.entitlements e
  where e.profile_id = admin_pro_subscription_target.customer and e.source = 'stripe'
    and e.status in ('active', 'past_due') and e.stripe_subscription_id is not null
  order by e.created_at desc
  limit 1
  for update;
  if found_entitlement.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if action = 'resume' and exists (
       select 1 from public.cancellations c
       where c.entitlement_id = found_entitlement.id
         and (c.decision = 'scheduled' or (c.decision is null and c.handled_at is null))
     ) then
    raise exception 'linkyo:customerCancelled' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'subscription', found_entitlement.stripe_subscription_id,
    'stripeCustomer', found_entitlement.stripe_customer_id,
    'periodEnd', found_entitlement.current_period_end,
    'cancelAtPeriodEnd', found_entitlement.cancel_at_period_end,
    'locale', (select p.locale from public.profiles p where p.id = admin_pro_subscription_target.customer)
  );
end;
$$;

/**
 * Logs a money action of the team once Stripe did it and it is on record (the routes call it as the
 * member after record_refund / upsert_pro_subscription). It writes only what the records show: a
 * refunded invoice of this customer ('refund', `ref` = the invoice; logged once per invoice), or a
 * Stripe Pro of this customer that now ends ('cancel') or goes on ('resume'; `ref` = the
 * subscription). Answers whether it wrote an entry. The activity log never says money moved when
 * Stripe refused, was not reached or the record is missing.
 */
create function public.admin_pro_money_done(customer uuid, action text, ref text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  found_invoice public.invoices;
  found_entitlement public.entitlements;
begin
  perform public.require_permission('billing.manage');
  if action is null or action not in ('refund', 'cancel', 'resume') or ref is null then
    raise exception 'linkyo:invalidAction' using errcode = 'P0001';
  end if;
  if action = 'refund' then
    select * into found_invoice from public.invoices i
    where i.id = admin_pro_money_done.ref and i.profile_id = admin_pro_money_done.customer;
    if found_invoice.id is null or found_invoice.status <> 'refunded' or exists (
         select 1 from public.audit_log l
         where l.action = 'customer.refund' and l.target_id = admin_pro_money_done.customer
           and l.details ->> 'invoice' = found_invoice.id
       ) then
      return false;
    end if;
    perform public.audit('customer.refund', admin_pro_money_done.customer,
      public.customer_label(admin_pro_money_done.customer),
      jsonb_build_object('invoice', found_invoice.id, 'amountCents', found_invoice.amount_cents));
    return true;
  end if;
  select * into found_entitlement from public.entitlements e
  where e.profile_id = admin_pro_money_done.customer and e.source = 'stripe'
    and e.stripe_subscription_id = admin_pro_money_done.ref;
  if found_entitlement.id is null
     or (action = 'cancel') is distinct from (found_entitlement.cancel_at_period_end or found_entitlement.cancel_at is not null) then
    return false;
  end if;
  perform public.audit('customer.' || action, admin_pro_money_done.customer,
    public.customer_label(admin_pro_money_done.customer),
    jsonb_build_object('subscription', found_entitlement.stripe_subscription_id));
  return true;
end;
$$;

/** The CSV export of the customer list: allowed with `customers.export`, logged with its row count. */
create function public.admin_customers_exported(row_count integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('customers.export');
  if row_count is null or row_count < 0 then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  perform public.audit('customer.export', null, row_count::text, jsonb_build_object('rows', row_count));
end;
$$;

revoke execute on function public.admin_pro_refund_target(uuid, text), public.admin_pro_subscription_target(uuid, text),
  public.admin_pro_money_done(uuid, text, text), public.admin_customers_exported(integer)
  from public, anon;
grant execute on function public.admin_pro_refund_target(uuid, text), public.admin_pro_subscription_target(uuid, text),
  public.admin_pro_money_done(uuid, text, text), public.admin_customers_exported(integer)
  to authenticated;
