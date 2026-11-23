-- Fixes from the v7 review, as a new migration (the eight before it are applied and never edited).
-- Each function keeps its signature, `security definer`, `search_path` and grants; only its body
-- changes. Tests: supabase/tests/public_pages.test.sql (cases 5–6) and billing.test.sql (cases 9, 11, 18).
--
-- 1. public_page() hands out the legal notice only when it is complete (the route already hid an
--    unfinished one, but the function is callable with the public key).
-- 2. has_pro(): Pro the team set by hand counts again once a Stripe subscription has ended.
-- 3. record_refund(): only a withdrawal reverses a contract; a partial refund leaves the order or
--    the invoice alone; a refund Stripe reported first no longer hides the kind the team chose.

-- ── 1. The legal notice on public pages ─────────────────────────────────────────────────────
/**
 * Is this legal notice complete: a name of two characters or more, an address and a valid e-mail?
 * Mirrors missingLegalFields() in apps/web/src/features/app/legal.ts. Anything else (also a notice
 * that only holds the sign-up e-mail the starter page was seeded with) is not shown to visitors.
 */
create function public.legal_is_complete(legal jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    jsonb_typeof(legal) = 'object'
    and char_length(regexp_replace(coalesce(legal ->> 'name', ''), '^\s+|\s+$', '', 'g')) >= 2
    and regexp_replace(coalesce(legal ->> 'address', ''), '^\s+|\s+$', '', 'g') <> ''
    and regexp_replace(coalesce(legal ->> 'email', ''), '^\s+|\s+$', '', 'g') ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$',
    false);
$$;
revoke execute on function public.legal_is_complete(jsonb) from public, anon, authenticated;

/**
 * What visitors may see of a page: active accounts with a confirmed email that finished the
 * welcome flow, of their page only the blocks that are public right now, in their order, and the
 * legal notice only once it is complete (an unfinished one is private: `{}`). Same shape as
 * before: {page, theme, legal, updatedAt}. Newsletter blocks are dropped by the route, not here.
 */
create or replace function public.public_page(handle text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'page', s.page || jsonb_build_object('blocks', coalesce((
      select jsonb_agg(e.block order by e.position)
      from jsonb_array_elements(
        case when jsonb_typeof(s.page -> 'blocks') = 'array' then s.page -> 'blocks' else '[]'::jsonb end
      ) with ordinality as e (block, position)
      where public.block_is_public(e.block, now())
    ), '[]'::jsonb)),
    'theme', s.theme,
    'legal', case when public.legal_is_complete(s.legal) then s.legal else '{}'::jsonb end,
    'updatedAt', s.updated_at
  )
  from public.profiles p
  join public.sites s on s.profile_id = p.id
  join auth.users u on u.id = p.id
  where p.username = lower(trim(handle))::extensions.citext
    and p.status = 'active' and s.onboarded and u.email_confirmed_at is not null;
$$;
grant execute on function public.public_page(text) to anon, authenticated, service_role;

-- ── 2. Who has Pro ──────────────────────────────────────────────────────────────────────────
/**
 * Does this account have Pro right now? An active (or past-due) entitlement inside its period, the
 * invite program's Pro for life, or Pro the team set by hand in public.subscriptions. While a
 * Stripe subscription is live (active or past due) its mirrored subscriptions row never grants Pro
 * on its own, so a lost customer.subscription.deleted event cannot extend Pro past the period end.
 * Once that subscription is canceled or refunded its mirror is 'free', so a Pro row can only be
 * the team's and counts.
 */
create or replace function public.has_pro(account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.entitlements e
      where e.profile_id = account and e.product = 'pro' and e.status in ('active', 'past_due')
        and (e.current_period_end is null or e.current_period_end > now())
    )
    or exists (
      select 1 from public.rewards w
      where w.profile_id = account and w.kind = 'pro_for_life' and w.revoked_at is null
    )
    or (
      exists (
        select 1 from public.subscriptions s
        where s.profile_id = account and s.plan = 'pro' and s.status in ('active', 'trialing')
      )
      and not exists (
        select 1 from public.entitlements e
        where e.profile_id = account and e.source = 'stripe' and e.status in ('active', 'past_due')
      )
    );
$$;
revoke execute on function public.has_pro(uuid) from public, anon, authenticated;
grant execute on function public.has_pro(uuid) to service_role;

-- ── 3. Refunds ──────────────────────────────────────────────────────────────────────────────
/**
 * Records a refund Stripe made (idempotent). 'ok' or 'notFound'.
 *
 * Which kind it is: the one the caller names, except that a refund reported without one (the
 * webhook's 'goodwill') on a contract whose withdrawal the team accepted is that withdrawal's
 * refund. The team's decision is stored before Stripe is called, so the kind no longer depends on
 * whether the webhook or the console's own call arrives first.
 *
 * A service order
 * - a withdrawal ends it, whatever the amount (the team may keep a share, § 357a BGB): 'withdrawn';
 * - any other refund of the whole amount (`amount` null or at least the order's): 'refunded';
 * - a smaller one is only noted in the timeline (`partial`); the order goes on, with its briefing
 *   and revisions. Stripe reports the sum refunded so far, so several partial refunds that add up
 *   to the whole amount end the order;
 * - a refund first recorded as 'goodwill' takes the kind of a later 'withdrawal' or 'voluntary'
 *   call (the console's, when the webhook was faster), so a withdrawal ends as 'withdrawn' and the
 *   once-per-account money-back is counted;
 * - a refunded or withdrawn order never keeps `withdrawal_pending`.
 *
 * A Pro invoice
 * - is 'refunded' when the whole amount went back;
 * - only a withdrawal reverses the contract (entitlement 'refunded', final; the console ends the
 *   Stripe subscription first). A goodwill refund of a month, whole or partial, leaves Pro as it is.
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
  end if;
  return 'ok';
end;
$$;
revoke execute on function public.record_refund(text, text, integer) from public, anon, authenticated;
grant execute on function public.record_refund(text, text, integer) to service_role;
