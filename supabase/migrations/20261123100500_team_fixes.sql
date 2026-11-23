-- Fixes from the review of the team console (v7, stage S4), as a new migration. Functions keep
-- their signatures, `security definer`, `search_path` and grants; new ones name theirs.
-- Tests: supabase/tests/billing.test.sql (cases 19–23) and media.test.sql (cases 6, 8).
--
-- 1. A team refund is recorded with its member: admin_refund_order() (audit, timeline, the lock
--    while a withdrawal waits).
-- 2. Withdrawals: an accepted one stays open until its refund is on record; one contract is
--    accepted once; "handled" and a rejection free the order only when nothing else waits.
-- 3. Cancellations: the team can carry out an ordinary one; a decided one stays decided.
-- 4. Storage: the team's pictures for a proposal go into the customer's folder; a customer reads
--    only the story pictures of proposals that were handed over.

-- ── 1. The team's refund ────────────────────────────────────────────────────────────────────
alter table public.order_events drop constraint kind_known;
alter table public.order_events add constraint kind_known check (kind in (
  'paid', 'confirmation_sent', 'briefed', 'assigned', 'proposal_saved', 'proposal_delivered', 'revision_requested',
  'proposal_applied', 'refunded', 'withdrawal_received', 'withdrawal_accepted', 'withdrawal_rejected', 'completed',
  'note', 'refund_requested'));

/**
 * The team decides to refund an order (the voluntary money-back or any full refund). Called as the
 * team member before the route asks Stripe: checks `billing.manage`, writes who decided it into the
 * activity log and the order's timeline, and answers what to refund. Refused (linkyo:locked)
 * - while a withdrawal waits: that refund is decided under "withdrawals and cancellations", or it
 *   would be booked as the once-per-account money-back;
 * - once the order is withdrawn, or refunded under a kind the team chose. An order Stripe's report
 *   marked 'goodwill' stays open, so a refund whose record failed can be sent again.
 */
create function public.admin_refund_order(target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_order public.orders;
begin
  perform public.require_permission('billing.manage');
  select * into found_order from public.orders o where o.id = target for update;
  if found_order.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_order.withdrawal_pending or found_order.status = 'withdrawn'
     or (found_order.status = 'refunded' and found_order.refund_kind is distinct from 'goodwill') then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  if found_order.stripe_payment_intent is not null then
    -- One timeline entry per member, however often the request is sent again.
    if not exists (
      select 1 from public.order_events e
      where e.order_id = found_order.id and e.kind = 'refund_requested' and e.actor = auth.uid()
    ) then
      perform public.order_event(found_order.id, 'refund_requested', jsonb_build_object('amount', found_order.amount_cents));
    end if;
    perform public.audit('order.refund', found_order.profile_id, found_order.number,
      jsonb_build_object('order', found_order.id, 'amountCents', found_order.amount_cents));
  end if;
  return jsonb_build_object(
    'paymentIntent', found_order.stripe_payment_intent,
    'amountCents', found_order.amount_cents,
    'voluntaryUsed', found_order.profile_id is not null and exists (
      select 1 from public.orders x
      where x.profile_id = found_order.profile_id and x.id <> found_order.id and x.refund_kind = 'voluntary'
    )
  );
end;
$$;
revoke execute on function public.admin_refund_order(uuid) from public, anon;
grant execute on function public.admin_refund_order(uuid) to authenticated;

-- ── 2. Withdrawals ──────────────────────────────────────────────────────────────────────────
/**
 * The team decides a withdrawal. 'rejected' needs a note; 'accepted' waits for the refund, or ends
 * the order at once when nothing is refunded. Returns what the route needs for Stripe and the e-mail.
 *
 * The request is finished (`handled_at`) only when nothing is left to do: at once for a rejection
 * and for an acceptance without a refund; for an acceptance with a refund when the refund is on
 * record (record_refund, settle_withdrawal). Until then it stays in the open list with its deadline,
 * and the route can finish the same decision again.
 *
 * One contract is withdrawn once: accepting is refused (linkyo:locked) when the order is already
 * withdrawn or refunded, the Pro contract already reversed, or another declaration for the same
 * contract was accepted. A second declaration is then only marked as handled.
 *
 * Locks: the contract first (order or entitlement), then the declaration, as record_refund does.
 */
create or replace function public.admin_resolve_withdrawal(
  target uuid, decision text, note text default null, refund_cents integer default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_withdrawal public.withdrawals;
  found_order public.orders;
  found_entitlement public.entitlements;
  finished boolean;
begin
  perform public.require_permission('billing.manage');
  if decision is null or decision not in ('accepted', 'rejected')
     or (decision = 'rejected' and nullif(trim(note), '') is null)
     or refund_cents < 0 then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  select * into found_withdrawal from public.withdrawals w where w.id = target;
  if found_withdrawal.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  select * into found_order from public.orders o where o.id = found_withdrawal.order_id for update;
  select * into found_entitlement from public.entitlements e where e.id = found_withdrawal.entitlement_id for update;
  select * into found_withdrawal from public.withdrawals w where w.id = target for update;
  if found_withdrawal.decision is not null or found_withdrawal.handled_at is not null then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  if decision = 'accepted' then
    if found_order.id is not null and (
         found_order.status in ('refunded', 'withdrawn')
         or exists (select 1 from public.withdrawals x
                    where x.order_id = found_order.id and x.id <> target and x.decision = 'accepted')
       ) then
      raise exception 'linkyo:locked' using errcode = 'P0001';
    end if;
    if found_order.id is null and found_entitlement.id is not null and (
         found_entitlement.status = 'refunded'
         or exists (select 1 from public.withdrawals x
                    where x.entitlement_id = found_entitlement.id and x.id <> target and x.decision = 'accepted')
       ) then
      raise exception 'linkyo:locked' using errcode = 'P0001';
    end if;
    if found_order.id is not null and refund_cents > found_order.amount_cents then
      raise exception 'linkyo:invalid' using errcode = 'P0001';
    end if;
  end if;
  finished := decision = 'rejected'
    or (found_order.id is not null and refund_cents = 0)
    or (found_order.id is null and found_entitlement.id is null);
  update public.withdrawals w set
    decision = admin_resolve_withdrawal.decision,
    refund_cents = admin_resolve_withdrawal.refund_cents,
    note = coalesce(nullif(trim(admin_resolve_withdrawal.note), ''), w.note),
    handled_at = case when finished then now() end,
    handled_by = auth.uid()
  where w.id = target;
  if found_order.id is not null then
    if decision = 'rejected' then
      -- Work resumes, unless another declaration for this order still waits.
      update public.orders o set withdrawal_pending = o.status not in ('refunded', 'withdrawn') and exists (
        select 1 from public.withdrawals x
        where x.order_id = o.id and x.id <> target and x.handled_at is null
      )
      where o.id = found_order.id;
      perform public.order_event(found_order.id, 'withdrawal_rejected', jsonb_build_object('withdrawal', target));
    else
      perform public.order_event(found_order.id, 'withdrawal_accepted',
        jsonb_build_object('withdrawal', target, 'refundCents', refund_cents));
      if refund_cents = 0 then
        update public.orders o set status = 'withdrawn', withdrawn_at = now(), withdrawal_pending = false
        where o.id = found_order.id;
      end if;
    end if;
  end if;
  perform public.audit('withdrawal.' || decision, found_withdrawal.profile_id,
    coalesce(found_order.number, found_withdrawal.contract), jsonb_build_object('withdrawal', target, 'refundCents', refund_cents));
  return jsonb_build_object(
    'paymentIntent', coalesce(found_order.stripe_payment_intent, (
      select i.payment_intent from public.invoices i
      where found_entitlement.stripe_subscription_id is not null
        and i.subscription = found_entitlement.stripe_subscription_id and i.status = 'paid'
      order by i.at desc limit 1)),
    'subscription', found_entitlement.stripe_subscription_id,
    'accountEmail', (select u.email from auth.users u where u.id = found_withdrawal.profile_id),
    'locale', coalesce(found_order.locale, (select p.locale from public.profiles p where p.id = found_withdrawal.profile_id))
  );
end;
$$;

/**
 * An accepted withdrawal is finished: the route calls this once Stripe and the bookkeeping are done
 * (also for Pro without a paid invoice, where no refund is recorded). Idempotent. Server only.
 */
create function public.settle_withdrawal(target uuid) returns void
language sql security definer set search_path = '' as $$
  update public.withdrawals w set handled_at = coalesce(w.handled_at, now())
  where w.id = target and w.decision = 'accepted';
$$;
revoke execute on function public.settle_withdrawal(uuid) from public, anon, authenticated;
grant execute on function public.settle_withdrawal(uuid) to service_role;

/**
 * Records a refund Stripe made (idempotent). 'ok' or 'notFound'. The rules are those of the review
 * fixes before this migration (which kind it is, partial amounts, a kind the team chose replacing
 * Stripe's 'goodwill'); new here: a refund recorded as a withdrawal finishes the accepted
 * withdrawal of that contract (`handled_at`), whoever reports it first, Stripe or the console.
 */
create or replace function public.record_refund(payment_intent text, kind text default 'voluntary', amount integer default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  found_order public.orders;
  found_invoice public.invoices;
  effective text := kind;
begin
  if kind is null or kind not in ('voluntary', 'withdrawal', 'goodwill') then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  select * into found_order from public.orders o where o.stripe_payment_intent = record_refund.payment_intent for update;
  if found_order.id is not null then
    if effective = 'goodwill' and (
         found_order.status = 'withdrawn'
         or exists (select 1 from public.withdrawals w where w.order_id = found_order.id and w.decision = 'accepted')
       ) then
      effective := 'withdrawal';
    end if;
    if found_order.refunded_at is null then
      if effective = 'withdrawal' or amount is null or amount >= found_order.amount_cents then
        update public.orders o set
          refunded_at = now(),
          refund_kind = effective,
          status = case when effective = 'withdrawal' then 'withdrawn' else 'refunded' end::public.order_status,
          withdrawn_at = case when effective = 'withdrawal' then coalesce(o.withdrawn_at, now()) else o.withdrawn_at end,
          withdrawal_pending = false
        where o.id = found_order.id;
        perform public.order_event(found_order.id, 'refunded', jsonb_build_object('amount', amount, 'kind', effective));
      elsif not exists (
        select 1 from public.order_events e
        where e.order_id = found_order.id and e.kind = 'refunded'
          and e.details ->> 'partial' = 'true' and e.details ->> 'amount' = amount::text
      ) then
        perform public.order_event(found_order.id, 'refunded',
          jsonb_build_object('amount', amount, 'kind', effective, 'partial', true));
      end if;
    elsif found_order.refund_kind = 'goodwill' and effective in ('withdrawal', 'voluntary') then
      update public.orders o set
        refund_kind = effective,
        status = case when effective = 'withdrawal' then 'withdrawn' else o.status end::public.order_status,
        withdrawn_at = case when effective = 'withdrawal' then coalesce(o.withdrawn_at, now()) else o.withdrawn_at end,
        withdrawal_pending = false
      where o.id = found_order.id;
      -- One refund, one timeline entry: it now names the kind the team chose.
      update public.order_events e set details = e.details || jsonb_build_object('kind', effective)
      where e.order_id = found_order.id and e.kind = 'refunded' and e.details ->> 'partial' is null;
    end if;
    if effective = 'withdrawal' then
      update public.withdrawals w set handled_at = coalesce(w.handled_at, now())
      where w.order_id = found_order.id and w.decision = 'accepted';
    end if;
    return 'ok';
  end if;
  select * into found_invoice from public.invoices i where i.payment_intent = record_refund.payment_intent for update;
  if found_invoice.id is null then
    return 'notFound';
  end if;
  if effective = 'goodwill' and found_invoice.subscription is not null and exists (
       select 1 from public.withdrawals w
       join public.entitlements e on e.id = w.entitlement_id
       where e.stripe_subscription_id = found_invoice.subscription and w.decision = 'accepted'
     ) then
    effective := 'withdrawal';
  end if;
  if amount is null or amount >= found_invoice.amount_cents then
    update public.invoices i set status = 'refunded' where i.id = found_invoice.id;
  end if;
  if effective = 'withdrawal' and found_invoice.subscription is not null
     and exists (select 1 from public.entitlements e where e.stripe_subscription_id = found_invoice.subscription) then
    perform public.update_pro_subscription(found_invoice.subscription, 'refunded');
    update public.withdrawals w set handled_at = coalesce(w.handled_at, now())
    from public.entitlements e
    where e.stripe_subscription_id = found_invoice.subscription and w.entitlement_id = e.id and w.decision = 'accepted';
  end if;
  return 'ok';
end;
$$;

/**
 * Marks a request as handled without a decision: unmatched or informational ones, a suspect one the
 * team checked, a second declaration for a contract that already ended. Refused (linkyo:locked) for
 * an accepted withdrawal whose refund is still open: that one is finished, not filed. When it was
 * the last declaration waiting for an order, work on the order resumes (the timeline notes it).
 */
create or replace function public.admin_mark_contract_handled(kind text, target uuid, note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  account uuid;
  found_withdrawal public.withdrawals;
  found_order public.orders;
begin
  perform public.require_permission('billing.manage');
  if kind = 'withdrawal' then
    select * into found_withdrawal from public.withdrawals w where w.id = target;
    if found_withdrawal.id is null then
      raise exception 'linkyo:notFound' using errcode = 'P0001';
    end if;
    select * into found_order from public.orders o where o.id = found_withdrawal.order_id for update;
    select * into found_withdrawal from public.withdrawals w where w.id = target for update;
    if found_withdrawal.decision = 'accepted' and found_withdrawal.handled_at is null then
      raise exception 'linkyo:locked' using errcode = 'P0001';
    end if;
    update public.withdrawals w set handled_at = now(), handled_by = auth.uid(),
      note = coalesce(nullif(trim(admin_mark_contract_handled.note), ''), w.note)
    where w.id = target;
    account := found_withdrawal.profile_id;
    if found_order.id is not null and found_order.withdrawal_pending and found_withdrawal.decision is null
       and not exists (
         select 1 from public.withdrawals x
         where x.order_id = found_order.id and x.id <> target and x.handled_at is null
       ) then
      update public.orders o set withdrawal_pending = false where o.id = found_order.id;
      perform public.order_event(found_order.id, 'note', jsonb_build_object('withdrawal', target, 'handled', true));
    end if;
  elsif kind = 'cancellation' then
    update public.cancellations c set handled_at = now(), handled_by = auth.uid(),
      note = coalesce(nullif(trim(admin_mark_contract_handled.note), ''), c.note)
    where c.id = target returning c.profile_id into account;
    if not found then
      raise exception 'linkyo:notFound' using errcode = 'P0001';
    end if;
  else
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  perform public.audit(kind || '.handled', account, kind, jsonb_build_object(kind, target));
end;
$$;

-- Accepted withdrawals whose refund never went through were filed as handled: open them again.
update public.withdrawals w set handled_at = null
where w.decision = 'accepted' and w.handled_at is not null
  and exists (
    select 1 from public.orders o
    where o.id = w.order_id and o.withdrawal_pending and o.status not in ('refunded', 'withdrawn')
  );

-- ── 3. Cancellations ────────────────────────────────────────────────────────────────────────
/**
 * May a cancellation go from one decision to the next? An undecided one can be scheduled, ended or
 * rejected; a scheduled one can be resumed (or scheduled again, for another date); the same
 * decision again is a retry. Everything else contradicts a decision that was already taken.
 */
create function public.cancellation_step_allowed(current text, next text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when current is null then next in ('scheduled', 'ended', 'rejected')
    when current = 'scheduled' then next in ('scheduled', 'resumed')
    else false
  end;
$$;
revoke execute on function public.cancellation_step_allowed(text, text) from public, anon, authenticated;

/**
 * The team decides a cancellation: scheduled (an ordinary one that was held or that Stripe did not
 * take when it arrived), ended, rejected or resumed. All but 'scheduled' need a note (for resumed:
 * the account holder's request from the account's e-mail). The route then calls Stripe and
 * confirm_cancellation. A decided cancellation stays decided (linkyo:locked): a second member's
 * stale list cannot end what the first one rejected, and nothing is done or mailed twice.
 */
create or replace function public.admin_resolve_cancellation(target uuid, decision text, note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_cancellation public.cancellations;
begin
  perform public.require_permission('billing.manage');
  if decision is null or decision not in ('scheduled', 'ended', 'rejected', 'resumed')
     or (decision <> 'scheduled' and nullif(trim(note), '') is null) then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  select * into found_cancellation from public.cancellations c where c.id = target for update;
  if found_cancellation.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if not public.cancellation_step_allowed(found_cancellation.decision, decision)
     or (found_cancellation.decision is null and found_cancellation.handled_at is not null)
     or (decision = 'scheduled' and (found_cancellation.kind <> 'ordinary' or found_cancellation.decision is not null)) then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  update public.cancellations c set
    note = coalesce(nullif(trim(admin_resolve_cancellation.note), ''), c.note), handled_by = auth.uid()
  where c.id = target;
  perform public.audit('cancellation.' || decision, found_cancellation.profile_id, found_cancellation.contract,
    jsonb_build_object('cancellation', target, 'note', nullif(trim(note), '')));
  return jsonb_build_object(
    'subscription', (select e.stripe_subscription_id from public.entitlements e where e.id = found_cancellation.entitlement_id),
    'accountEmail', (select u.email from auth.users u where u.id = found_cancellation.profile_id)
  );
end;
$$;

/**
 * What happened to a cancellation (after the route told Stripe), mirrored into the entitlement.
 * Refuses a step that contradicts the decision on record (linkyo:locked); the same decision again
 * changes nothing but the date.
 */
create or replace function public.confirm_cancellation(target uuid, decision text, effective timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  found_cancellation public.cancellations;
  found_entitlement public.entitlements;
begin
  if decision is null or decision not in ('scheduled', 'ended', 'rejected', 'resumed') then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  select * into found_cancellation from public.cancellations c where c.id = target for update;
  if found_cancellation.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_cancellation.decision is distinct from confirm_cancellation.decision
     and not public.cancellation_step_allowed(found_cancellation.decision, confirm_cancellation.decision) then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  update public.cancellations c set
    decision = confirm_cancellation.decision,
    effective_at = case when confirm_cancellation.decision = 'rejected' then null else effective end,
    handled_at = case when confirm_cancellation.decision in ('ended', 'rejected', 'resumed') then coalesce(c.handled_at, now())
                      else c.handled_at end
  where c.id = target;
  select * into found_entitlement from public.entitlements e where e.id = found_cancellation.entitlement_id for update;
  if found_entitlement.id is null or found_entitlement.status = 'refunded' then
    return;
  end if;
  if decision = 'scheduled' then
    if effective is null or (found_entitlement.current_period_end is not null
                             and effective <= found_entitlement.current_period_end) then
      update public.entitlements e set cancel_at_period_end = true, cancel_at = null where e.id = found_entitlement.id;
    else
      update public.entitlements e set cancel_at_period_end = false, cancel_at = effective where e.id = found_entitlement.id;
    end if;
  elsif decision = 'resumed' then
    update public.entitlements e set cancel_at_period_end = false, cancel_at = null where e.id = found_entitlement.id;
  elsif decision = 'ended' then
    update public.entitlements e set status = 'canceled', cancel_at_period_end = false, cancel_at = null
    where e.id = found_entitlement.id;
    perform public.mirror_pro_subscription(found_entitlement.profile_id, 'canceled', found_entitlement.current_period_end);
  end if;
end;
$$;

-- ── 4. Storage ──────────────────────────────────────────────────────────────────────────────
/**
 * May the caller put a page picture into this account's media folder? Team members who build pages,
 * for a customer with an order that is still open: the pictures of a proposal belong to the
 * customer (they are purged with that account, and stay when the team member leaves).
 */
create function public.team_may_upload_for(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_permission('pages.edit') and exists (
    select 1 from public.orders o
    where o.profile_id::text = folder and o.status not in ('refunded', 'withdrawn')
  );
$$;
revoke execute on function public.team_may_upload_for(text) from public, anon;
grant execute on function public.team_may_upload_for(text) to authenticated;

create policy "media insert team for a customer's order" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media' and public.team_may_upload_for((storage.foldername(name))[1])
  );

/** Is this story picture part of a proposal that was handed to the caller? */
create function public.story_handed_to_me(path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.site_proposals p
    where p.profile_id = auth.uid() and p.status in ('delivered', 'applied', 'superseded')
      and path = any (p.story_paths)
  );
$$;
revoke execute on function public.story_handed_to_me(text) from public, anon;
grant execute on function public.story_handed_to_me(text) to authenticated;

-- A customer reads the story pictures of the proposals they received, not everything under their
-- folder: a draft's pictures, and one the team uploaded by mistake and took out, stay private.
drop policy "deliverables select own or team" on storage.objects;
create policy "deliverables select handed over or team" on storage.objects
  for select to authenticated using (
    bucket_id = 'deliverables'
    and (public.has_permission('pages.edit') or public.story_handed_to_me(name))
  );
