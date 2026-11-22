-- Selling (v7 phase 1, Stripe test mode): Pro as an entitlement, the paid page service (orders,
-- proposals, revisions, money-back), the statutory withdrawal and cancellation forms, and the
-- Stripe event log. Tests: supabase/tests/billing.test.sql.
--
-- Who writes what
-- - Our server (service role) writes everything Stripe or a public form causes: the functions in
--   "Server" below; they are not callable from the browser.
-- - Customers read their own rows and call the "Owner" functions; they never write tables.
-- - The team works through one admin_* function per action (permission first, audit after).
-- - Money never moves automatically: refunds and contract ends are team actions (the route then
--   calls Stripe and records the result).
-- "Today" and "this month" are Europe/Berlin.

-- ── Types ───────────────────────────────────────────────────────────────────────────────────
create type public.entitlement_status as enum ('active', 'past_due', 'canceled', 'refunded');
create type public.order_package as enum ('start', 'premium');
create type public.order_status as enum ('paid', 'awaiting_briefing', 'queued', 'in_progress', 'delivered',
  'revision_requested', 'completed', 'refunded', 'withdrawn');
create type public.proposal_status as enum ('draft', 'delivered', 'applied', 'superseded');

-- ── Pro ─────────────────────────────────────────────────────────────────────────────────────
-- One row per Stripe subscription (source 'stripe') or per Pro the team gives (source 'team').
-- public.subscriptions keeps mirroring Pro for the console and revenue (upsert_pro_subscription).
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  product text not null constraint product_known check (product = 'pro'),
  source text not null constraint source_known check (source in ('stripe', 'team')),
  status public.entitlement_status not null default 'active',
  starts_at timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- A scheduled end later than the current period end (a cancellation for a later date).
  cancel_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entitlements_profile on public.entitlements (profile_id, created_at desc);
alter table public.entitlements enable row level security;
create policy "owners read their entitlements" on public.entitlements
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "billing team reads entitlements" on public.entitlements
  for select to authenticated using (public.has_permission('billing.view'));
revoke insert, update, delete on public.entitlements from authenticated, anon;
create trigger entitlements_touch before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- ── The page service ────────────────────────────────────────────────────────────────────────
create table public.service_settings (
  id boolean primary key default true constraint one_row check (id),
  -- How many orders may fall due on one day (the delivery promise moves on when a day is full).
  daily_capacity integer not null default 4 constraint capacity_range check (daily_capacity between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.service_settings default values;
alter table public.service_settings enable row level security;
-- No policies: functions only.
revoke all on public.service_settings from authenticated, anon;
create trigger service_settings_touch before update on public.service_settings
  for each row execute function public.touch_updated_at();

create sequence public.order_number_seq maxvalue 999999 no cycle;
revoke all on sequence public.order_number_seq from authenticated, anon;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- LNK-<year>-<6 digits>: what the customer quotes (withdrawal form, e-mails, support).
  number text not null unique default (
    'LNK-' || to_char(now() at time zone 'Europe/Berlin', 'YYYY') || '-'
    || lpad(nextval('public.order_number_seq')::text, 6, '0')
  ),
  -- Kept when the account is deleted (invoice-relevant fields stay 10 years, § 147 AO).
  profile_id uuid references public.profiles (id) on delete set null,
  customer_email text not null constraint customer_email_short check (char_length(customer_email) <= 254),
  customer_name text constraint customer_name_short check (char_length(customer_name) <= 200),
  package public.order_package not null,
  status public.order_status not null default 'paid',
  locale text not null constraint locale_known check (locale in ('de', 'en', 'ar')),
  amount_cents integer not null constraint amount_positive check (amount_cents > 0),
  currency text not null default 'EUR' constraint currency_eur check (currency = 'EUR'),
  vat_mode text not null constraint vat_mode_known check (vat_mode in ('standard19', 'kleinunternehmer')),
  early_start boolean not null,
  -- The exact consent text the customer agreed to (only with an early start).
  early_start_text text,
  ordered_at timestamptz not null default now(),
  start_after timestamptz not null,
  promised_due_at timestamptz not null,
  briefing jsonb constraint briefing_is_object check (briefing is null or jsonb_typeof(briefing) = 'object'),
  briefed_at timestamptz,
  due_at timestamptz,
  assignee uuid references auth.users (id) on delete set null,
  revisions_allowed smallint not null constraint revisions_allowed_range check (revisions_allowed between 0 and 5),
  revisions_used smallint not null default 0 constraint revisions_used_positive check (revisions_used >= 0),
  revision_due_at timestamptz,
  confirmation_sent_at timestamptz,
  -- The first delivery; later rounds keep it (revision and money-back periods count from it).
  delivered_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz,
  refund_kind text constraint refund_kind_known check (refund_kind in ('voluntary', 'withdrawal', 'goodwill')),
  -- A matched withdrawal the team has not resolved yet: all work on the order stops.
  withdrawal_pending boolean not null default false,
  withdrawn_at timestamptz,
  stripe_session_id text not null unique,
  stripe_payment_intent text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_due on public.orders (status, due_at);
create index orders_profile on public.orders (profile_id, ordered_at desc);
alter table public.orders enable row level security;
create policy "owners read their orders" on public.orders
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "team reads orders" on public.orders
  for select to authenticated using (public.has_permission('customers.view'));
revoke insert, update, delete on public.orders from authenticated, anon;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid references auth.users (id) on delete set null,
  kind text not null constraint kind_known check (kind in (
    'paid', 'confirmation_sent', 'briefed', 'assigned', 'proposal_saved', 'proposal_delivered', 'revision_requested',
    'proposal_applied', 'refunded', 'withdrawal_received', 'withdrawal_accepted', 'withdrawal_rejected', 'completed',
    'note')),
  details jsonb not null default '{}'::jsonb
);
create index order_events_order on public.order_events (order_id, at desc);
alter table public.order_events enable row level security;
create policy "team reads order events" on public.order_events
  for select to authenticated using (public.has_permission('customers.view'));
revoke insert, update, delete on public.order_events from authenticated, anon;

-- What the team proposes; the customer's page (public.sites) is never touched here. Only the
-- customer's own "Use this proposal" changes the page, in the editor (one undoable step).
create table public.site_proposals (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  -- 0 = the first delivery, then one per revision.
  round smallint not null default 0 constraint round_positive check (round >= 0),
  status public.proposal_status not null default 'draft',
  page jsonb not null,
  theme jsonb not null,
  kind text constraint kind_short check (char_length(kind) <= 40),
  message text constraint message_short check (char_length(message) <= 2000),
  -- The customer's revision request for this delivery.
  request text constraint request_short check (char_length(request) <= 2000),
  -- Premium marketing kit: {bioInstagram, bioTiktok, postingPlan: [{week, idea}] x 4}.
  extras jsonb constraint extras_object check (
    extras is null or (jsonb_typeof(extras) = 'object' and pg_column_size(extras) < 20000)),
  -- Story pictures in the deliverables bucket (<customer>/<order>/…).
  story_paths text[] not null default '{}' constraint story_paths_count check (cardinality(story_paths) <= 3),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  applied_at timestamptz,
  constraint one_per_round unique (order_id, round),
  constraint documents_are_objects check (jsonb_typeof(page) = 'object' and jsonb_typeof(theme) = 'object'),
  constraint proposal_size check (pg_column_size(page) + pg_column_size(theme) < 1000000)
);
alter table public.site_proposals enable row level security;
create policy "owners read delivered proposals" on public.site_proposals
  for select to authenticated using (
    profile_id = (select auth.uid()) and status in ('delivered', 'applied', 'superseded'));
create policy "team reads proposals" on public.site_proposals
  for select to authenticated using (public.has_permission('customers.view'));
revoke insert, update, delete on public.site_proposals from authenticated, anon;
create trigger site_proposals_touch before update on public.site_proposals
  for each row execute function public.touch_updated_at();

-- ── Checkout and Stripe (server only) ───────────────────────────────────────────────────────
-- Written when a checkout session opens; the dates are fixed at consent (record_checkout_consent).
create table public.checkout_intents (
  session_id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  product text not null constraint product_known check (product in ('service-start', 'service-premium', 'pro-monthly')),
  locale text not null constraint locale_known check (locale in ('de', 'en', 'ar')),
  early_start boolean not null default false,
  early_start_text text,
  start_after timestamptz,
  promised_due_at timestamptz,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.checkout_intents enable row level security;
revoke all on public.checkout_intents from authenticated, anon;

-- Webhook deliveries. An event is a duplicate only once processed_at is set (after its handler
-- succeeded), so a failed handler is retried by Stripe's redelivery.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from authenticated, anon;

-- Since Stripe API 2025-03-31.basil an invoice no longer carries its subscription or payment
-- intent at the top level; we keep both ourselves.
alter table public.invoices
  add column subscription text,
  add column payment_intent text constraint invoices_payment_intent_unique unique;

-- ── Withdrawal and cancellation (public forms; the team reads them) ─────────────────────────
-- A declaration is always stored with the server's time, whatever else happens.
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  name text not null constraint name_length check (char_length(name) between 1 and 120),
  email text not null constraint email_short check (char_length(email) <= 254),
  contract text not null constraint contract_length check (char_length(contract) between 1 and 80),
  profile_id uuid references public.profiles (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  entitlement_id uuid references public.entitlements (id) on delete set null,
  matched boolean not null default false,
  -- Many declarations from one address or to one mailbox: the receipt is held until the team checks.
  suspect boolean not null default false,
  receipt_sent_at timestamptz,
  decision text constraint decision_known check (decision in ('accepted', 'rejected')),
  refund_cents integer constraint refund_positive check (refund_cents >= 0),
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  note text constraint note_short check (char_length(note) <= 2000)
);
create index withdrawals_received on public.withdrawals (received_at desc);
alter table public.withdrawals enable row level security;
create policy "billing team reads withdrawals" on public.withdrawals
  for select to authenticated using (public.has_permission('billing.view'));
revoke insert, update, delete on public.withdrawals from authenticated, anon;

create table public.cancellations (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  kind text not null constraint kind_known check (kind in ('ordinary', 'extraordinary')),
  -- Only an extraordinary cancellation gives a reason (an ordinary one needs none, § 312k BGB).
  reason text constraint reason_short check (char_length(reason) <= 2000),
  name text not null constraint name_length check (char_length(name) between 1 and 120),
  account_email text not null constraint account_email_short check (char_length(account_email) <= 254),
  contract text not null constraint contract_known check (contract = 'pro-monthly'),
  -- null = the next possible date.
  wanted_date date,
  confirmation_email text not null constraint confirmation_email_short check (char_length(confirmation_email) <= 254),
  profile_id uuid references public.profiles (id) on delete set null,
  entitlement_id uuid references public.entitlements (id) on delete set null,
  matched boolean not null default false,
  suspect boolean not null default false,
  decision text constraint decision_known check (decision in ('scheduled', 'ended', 'rejected', 'resumed')),
  effective_at timestamptz,
  receipt_sent_at timestamptz,
  handled_at timestamptz,
  handled_by uuid references auth.users (id) on delete set null,
  note text constraint note_short check (char_length(note) <= 2000),
  constraint reason_only_extraordinary check (kind = 'extraordinary' or reason is null)
);
create index cancellations_received on public.cancellations (received_at desc);
alter table public.cancellations enable row level security;
create policy "billing team reads cancellations" on public.cancellations
  for select to authenticated using (public.has_permission('billing.view'));
revoke insert, update, delete on public.cancellations from authenticated, anon;

-- One row per form submission, kept one day (purge_form_limits): how often an address sent a form.
create table public.form_limits (
  ip_hash text not null,
  form text not null constraint form_known check (form in ('withdrawal', 'cancellation')),
  at timestamptz not null default now()
);
create index form_limits_lookup on public.form_limits (ip_hash, form, at);
alter table public.form_limits enable row level security;
revoke all on public.form_limits from authenticated, anon;

-- ── Helpers (internal) ──────────────────────────────────────────────────────────────────────
/** Midnight in Berlin on that day, as a point in time. */
create function public.berlin_midnight(day date) returns timestamptz
language sql immutable set search_path = '' as $$
  select day::timestamp at time zone 'Europe/Berlin';
$$;

/** Was this page (or its profile text) made with the AI? Mirrors hasAiContent() in @linkyo/blocks. */
create function public.page_has_ai(page jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(page -> 'blocks') = 'array' then page -> 'blocks' else '[]'::jsonb end
      ) b
      where b ->> 'origin' in ('ai', 'ai-edited')
    )
    or case when jsonb_typeof(page #> '{profile,aiFields}') = 'array'
      then jsonb_array_length(page #> '{profile,aiFields}') > 0 else false end;
$$;

/** Is the Premium marketing kit complete: both bios, the 4-week plan and 3 story pictures? */
create function public.proposal_kit_complete(extras jsonb, story_paths text[]) returns boolean
language plpgsql immutable set search_path = '' as $$
begin
  if extras is null or jsonb_typeof(extras) <> 'object' or coalesce(cardinality(story_paths), 0) <> 3 then
    return false;
  end if;
  if char_length(trim(coalesce(extras ->> 'bioInstagram', ''))) not between 1 and 150
     or char_length(trim(coalesce(extras ->> 'bioTiktok', ''))) not between 1 and 80
     or coalesce(jsonb_typeof(extras -> 'postingPlan'), '') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(extras -> 'postingPlan') <> 4 then
    return false;
  end if;
  -- Weeks 1 to 4, each once, each with an idea.
  return (
    select count(distinct w ->> 'week') = 4 and bool_and(
      w ->> 'week' in ('1', '2', '3', '4') and char_length(trim(coalesce(w ->> 'idea', ''))) between 1 and 280)
    from jsonb_array_elements(extras -> 'postingPlan') w
  );
end;
$$;

/** The money-back promise: once per account, within 14 days of the first delivery, never twice. */
create function public.voluntary_refund_available(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select o.status not in ('refunded', 'withdrawn')
      and not o.withdrawal_pending
      and o.delivered_at is not null and now() <= o.delivered_at + interval '14 days'
      and not exists (
        select 1 from public.orders x
        where x.profile_id = o.profile_id and x.refund_kind = 'voluntary'
      )
    from public.orders o where o.id = target
  ), false);
$$;

create function public.order_event(target uuid, kind text, details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.order_events (order_id, actor, kind, details)
  values (target, auth.uid(), kind, coalesce(details, '{}'::jsonb));
$$;

/**
 * Mirrors a Pro entitlement into public.subscriptions (the console and revenue read that table):
 * active/past_due → plan 'pro' with the same status; canceled/refunded → plan 'free'.
 */
create function public.mirror_pro_subscription(account uuid, next public.entitlement_status, period_end timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if next in ('active', 'past_due') then
    insert into public.subscriptions as s (profile_id, plan, status, started_at, renews_at)
    values (account, 'pro', next::text::public.subscription_status, now(), period_end)
    on conflict (profile_id) do update set
      plan = 'pro', status = excluded.status, started_at = coalesce(s.started_at, now()),
      renews_at = excluded.renews_at, canceled_at = null;
  else
    insert into public.subscriptions as s (profile_id, plan, status, canceled_at)
    values (account, 'free', null, now())
    on conflict (profile_id) do update set plan = 'free', status = null, canceled_at = now();
  end if;
end;
$$;

/** Suspect when an address sent more than 10 forms in an hour or a mailbox got 3 receipts in a day. */
create function public.form_suspect(form text, ip_hash text, recipient text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (
      select count(*) from public.form_limits l
      where l.ip_hash = form_suspect.ip_hash and l.form = form_suspect.form and l.at > now() - interval '1 hour'
    ) > 10
    or case form_suspect.form
      when 'withdrawal' then (
        select count(*) from public.withdrawals w
        where lower(w.email) = lower(trim(recipient)) and w.receipt_sent_at > now() - interval '24 hours')
      else (
        select count(*) from public.cancellations c
        where lower(c.confirmation_email) = lower(trim(recipient)) and c.receipt_sent_at > now() - interval '24 hours')
    end >= 3;
$$;

-- ── Server: Pro, checkout and Stripe ────────────────────────────────────────────────────────
/**
 * Does this account have Pro right now? An active (or past-due) entitlement inside its period, the
 * invite program's Pro for life, or Pro the team set by hand in public.subscriptions. A Stripe
 * customer's mirrored subscriptions row never grants Pro on its own, so a lost
 * customer.subscription.deleted event cannot extend Pro past the period end.
 */
create function public.has_pro(account uuid) returns boolean
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
      and not exists (select 1 from public.entitlements e where e.profile_id = account and e.source = 'stripe')
    );
$$;

create function public.record_checkout_intent(session text, account uuid, product text, locale text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.checkout_intents as i (session_id, profile_id, product, locale)
  values (session, account, record_checkout_intent.product, record_checkout_intent.locale)
  on conflict (session_id) do update set
    profile_id = excluded.profile_id, product = excluded.product, locale = excluded.locale;
end;
$$;

/**
 * The customer's consent on the checkout page fixes the dates the order will promise. Callable
 * again until the order exists (the last call wins). 'ok' or 'notFound'.
 */
create function public.record_checkout_consent(
  session text, account uuid, early boolean, consent_text text, start_after timestamptz, promised_due timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.orders o where o.stripe_session_id = session) then
    return 'notFound';
  end if;
  update public.checkout_intents i set
    early_start = coalesce(early, false),
    early_start_text = case when early then consent_text end,
    start_after = record_checkout_consent.start_after,
    promised_due_at = promised_due,
    consent_at = now()
  where i.session_id = session and i.profile_id = account and i.product in ('service-start', 'service-premium');
  return case when found then 'ok' else 'notFound' end;
end;
$$;

/**
 * The paid order, built from the checkout intent (idempotent by session). Without a consent nothing
 * is created: the webhook answers 500 and Stripe retries.
 */
create function public.record_service_order(
  session text, payment_intent text, amount integer, email text, name text default null, vat text default 'standard19'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  intent public.checkout_intents;
  existing public.orders;
  made public.orders;
begin
  select * into existing from public.orders o where o.stripe_session_id = session;
  if existing.id is not null then
    return jsonb_build_object('id', existing.id, 'number', existing.number, 'created', false);
  end if;
  select * into intent from public.checkout_intents i
  where i.session_id = session and i.product in ('service-start', 'service-premium');
  if intent.session_id is null then
    return jsonb_build_object('error', 'notFound');
  end if;
  if intent.consent_at is null then
    return jsonb_build_object('error', 'noConsent');
  end if;
  insert into public.orders as o (
    profile_id, customer_email, customer_name, package, locale, amount_cents, vat_mode, early_start,
    early_start_text, start_after, promised_due_at, revisions_allowed, stripe_session_id, stripe_payment_intent
  ) values (
    intent.profile_id, trim(email), nullif(left(trim(name), 200), ''),
    case intent.product when 'service-premium' then 'premium' else 'start' end::public.order_package,
    intent.locale, amount, coalesce(vat, 'standard19'), intent.early_start,
    case when intent.early_start then intent.early_start_text end, intent.start_after, intent.promised_due_at,
    case intent.product when 'service-premium' then 3 else 1 end,
    session, record_service_order.payment_intent
  )
  on conflict (stripe_session_id) do nothing
  returning * into made;
  if made.id is null then
    -- Another delivery of the same event created it a moment ago.
    select * into existing from public.orders o where o.stripe_session_id = session;
    return jsonb_build_object('id', existing.id, 'number', existing.number, 'created', false);
  end if;
  perform public.order_event(made.id, 'paid', jsonb_build_object('amount', amount));
  return jsonb_build_object('id', made.id, 'number', made.number, 'created', true);
end;
$$;

/** The order confirmation went out: the order joins the queue (or waits for its briefing). */
create function public.mark_confirmation_sent(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders o set
    confirmation_sent_at = now(),
    status = case
      when o.status not in ('paid', 'awaiting_briefing') then o.status
      when o.briefing is not null then 'queued'
      else 'awaiting_briefing' end::public.order_status
  where o.id = target and o.confirmation_sent_at is null;
  if found then
    perform public.order_event(target, 'confirmation_sent');
  end if;
end;
$$;

/**
 * The customer's briefing (the route checked the account and decided the due date: on time keeps
 * the promised date). 'ok', 'notFound' (not the owner) or 'locked' (work started or withdrawal).
 */
create function public.set_order_briefing(target uuid, account uuid, briefing jsonb, due timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare
  found_order public.orders;
begin
  select * into found_order from public.orders o where o.id = target and o.profile_id = account for update;
  if found_order.id is null then
    return 'notFound';
  end if;
  if found_order.status not in ('paid', 'awaiting_briefing') or found_order.withdrawal_pending then
    return 'locked';
  end if;
  update public.orders o set
    briefing = set_order_briefing.briefing,
    briefed_at = now(),
    due_at = due,
    status = case when o.confirmation_sent_at is not null then 'queued' else o.status end::public.order_status
  where o.id = target;
  perform public.order_event(target, 'briefed', jsonb_build_object('dueAt', due));
  return 'ok';
end;
$$;

/** Orders falling due on each Berlin day (the briefed due date, else the promised one). */
create function public.service_load(from_day date, days integer, exclude uuid default null)
returns table (day date, booked integer)
language sql stable security definer set search_path = '' as $$
  select d.day, count(o.id)::integer
  from (
    select (from_day + n)::date as day from generate_series(0, least(greatest(days, 0), 366) - 1) n
  ) d
  left join public.orders o
    on (coalesce(o.due_at, o.promised_due_at) at time zone 'Europe/Berlin')::date = d.day
    and o.status not in ('refunded', 'withdrawn')
    and not o.withdrawal_pending
    and o.id is distinct from exclude
  group by d.day
  order by d.day;
$$;

create function public.service_capacity() returns integer
language sql stable security definer set search_path = '' as $$
  select daily_capacity from public.service_settings where id;
$$;

/**
 * Every customer.subscription.* event calls this with the subscription's current state, so the
 * order of events does not matter. 'refunded' is final. Returns the entitlement id.
 */
create function public.upsert_pro_subscription(
  account uuid, customer text, subscription text, next public.entitlement_status, period_end timestamptz,
  cancel_at_end boolean, cancel_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  found_entitlement public.entitlements;
begin
  select * into found_entitlement from public.entitlements e where e.stripe_subscription_id = subscription for update;
  if found_entitlement.id is null then
    insert into public.entitlements as e (
      profile_id, product, source, status, current_period_end, cancel_at_period_end, cancel_at,
      stripe_customer_id, stripe_subscription_id
    ) values (
      account, 'pro', 'stripe', next, period_end, coalesce(cancel_at_end, false), upsert_pro_subscription.cancel_at,
      customer, subscription
    )
    on conflict (stripe_subscription_id) do nothing
    returning * into found_entitlement;
    if found_entitlement.id is null then
      -- A parallel delivery inserted it: apply this state to that row.
      return public.upsert_pro_subscription(account, customer, subscription, next, period_end, cancel_at_end,
        upsert_pro_subscription.cancel_at);
    end if;
  elsif found_entitlement.status = 'refunded' then
    return found_entitlement.id;
  else
    update public.entitlements e set
      status = next,
      current_period_end = period_end,
      cancel_at_period_end = coalesce(cancel_at_end, false),
      cancel_at = upsert_pro_subscription.cancel_at,
      stripe_customer_id = coalesce(customer, e.stripe_customer_id)
    where e.id = found_entitlement.id;
  end if;
  perform public.mirror_pro_subscription(found_entitlement.profile_id, next, period_end);
  return found_entitlement.id;
end;
$$;

/** A status-only change the team caused (refunded, canceled). 'refunded' is final. */
create function public.update_pro_subscription(subscription text, next public.entitlement_status) returns void
language plpgsql security definer set search_path = '' as $$
declare
  found_entitlement public.entitlements;
begin
  select * into found_entitlement from public.entitlements e where e.stripe_subscription_id = subscription for update;
  if found_entitlement.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_entitlement.status = 'refunded' then
    return;
  end if;
  update public.entitlements e set status = next where e.id = found_entitlement.id;
  perform public.mirror_pro_subscription(found_entitlement.profile_id, next, found_entitlement.current_period_end);
end;
$$;

/** true only the first time (gates the one Pro welcome e-mail). */
create function public.mark_pro_confirmation_sent(subscription text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  update public.entitlements e set confirmation_sent_at = now()
  where e.stripe_subscription_id = subscription and e.confirmation_sent_at is null;
  return found;
end;
$$;

/** An invoice of a Pro subscription. The account comes from the subscription's metadata. */
create function public.record_invoice(
  id text, account uuid, subscription text, amount integer, state text, payment_intent text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.invoices as i (id, profile_id, amount_cents, status, subscription, payment_intent)
  values (record_invoice.id, account, amount, state, record_invoice.subscription, record_invoice.payment_intent)
  on conflict on constraint invoices_pkey do update set
    amount_cents = excluded.amount_cents,
    -- A refund is final; a late "paid" or "failed" event does not undo it.
    status = case when i.status = 'refunded' then 'refunded' else excluded.status end,
    subscription = coalesce(i.subscription, excluded.subscription),
    payment_intent = coalesce(i.payment_intent, excluded.payment_intent);
end;
$$;

/**
 * Records a refund Stripe made (idempotent): a service order becomes 'refunded' (or 'withdrawn'
 * for a withdrawal); a Pro invoice becomes 'refunded' with its entitlement. 'ok' or 'notFound'.
 */
create function public.record_refund(payment_intent text, kind text default 'voluntary', amount integer default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  found_order public.orders;
  found_invoice public.invoices;
begin
  if kind is null or kind not in ('voluntary', 'withdrawal', 'goodwill') then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  select * into found_order from public.orders o where o.stripe_payment_intent = record_refund.payment_intent for update;
  if found_order.id is not null then
    if found_order.refunded_at is null then
      update public.orders o set
        refunded_at = now(),
        refund_kind = kind,
        status = case when kind = 'withdrawal' then 'withdrawn' else 'refunded' end::public.order_status,
        withdrawn_at = case when kind = 'withdrawal' then now() else o.withdrawn_at end,
        withdrawal_pending = case when kind = 'withdrawal' then false else o.withdrawal_pending end
      where o.id = found_order.id;
      perform public.order_event(found_order.id, 'refunded', jsonb_build_object('amount', amount, 'kind', kind));
    end if;
    return 'ok';
  end if;
  update public.invoices i set status = 'refunded' where i.payment_intent = record_refund.payment_intent
  returning * into found_invoice;
  if found_invoice.id is null then
    return 'notFound';
  end if;
  if found_invoice.subscription is not null
     and exists (select 1 from public.entitlements e where e.stripe_subscription_id = found_invoice.subscription) then
    perform public.update_pro_subscription(found_invoice.subscription, 'refunded');
  end if;
  return 'ok';
end;
$$;

-- ── Server: the public forms ────────────────────────────────────────────────────────────────
/**
 * A withdrawal declaration (§ 356 BGB). Always stored with the server's time. Matches a service
 * order by its number and the order's e-mail, or Pro by the account's e-mail. The route never
 * passes `matched` or `accountEmail` to the browser.
 */
create function public.record_withdrawal(name text, email text, contract text, ip_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  clean_email text := lower(trim(email));
  clean_contract text := trim(contract);
  is_suspect boolean;
  found_order public.orders;
  found_entitlement uuid;
  account uuid;
  account_email text;
  made public.withdrawals;
begin
  insert into public.form_limits (ip_hash, form) values (record_withdrawal.ip_hash, 'withdrawal');
  is_suspect := public.form_suspect('withdrawal', record_withdrawal.ip_hash, clean_email);
  if clean_contract ~* '^LNK-\d{4}-\d{6}$' then
    select * into found_order from public.orders o
    where o.number = upper(clean_contract) and lower(o.customer_email) = clean_email
      and o.status not in ('refunded', 'withdrawn')
    for update;
    if found_order.id is not null then
      account := found_order.profile_id;
      account_email := coalesce((select u.email from auth.users u where u.id = account), found_order.customer_email);
    end if;
  elsif lower(clean_contract) in ('pro', 'linkyo pro') then
    select e.id, e.profile_id, u.email into found_entitlement, account, account_email
    from public.entitlements e
    join auth.users u on u.id = e.profile_id
    where e.source = 'stripe' and e.status in ('active', 'past_due') and lower(u.email) = clean_email
    order by e.created_at desc
    limit 1;
  end if;
  insert into public.withdrawals as w (name, email, contract, profile_id, order_id, entitlement_id, matched, suspect)
  values (trim(name), trim(email), clean_contract, account, found_order.id, found_entitlement,
    found_order.id is not null or found_entitlement is not null, is_suspect)
  returning * into made;
  if found_order.id is not null then
    update public.orders o set withdrawal_pending = true where o.id = found_order.id;
    perform public.order_event(found_order.id, 'withdrawal_received', jsonb_build_object('withdrawal', made.id));
  end if;
  return jsonb_build_object('id', made.id, 'receivedAt', made.received_at, 'matched', made.matched,
    'suspect', made.suspect, 'accountEmail', case when made.matched then account_email end);
end;
$$;

/**
 * A cancellation of Pro (§ 312k BGB). Always stored. Matches the account by its e-mail with an
 * active Stripe Pro. Server only: the answer carries the subscription. `reason` (extraordinary only)
 * and `wanted` (null = the next possible date) are optional, so they come last.
 */
create function public.record_cancellation(
  kind text, name text, account_email text, contract text, confirmation_email text, ip_hash text,
  reason text default null, wanted date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  is_suspect boolean;
  found_entitlement public.entitlements;
  found_email text;
  made public.cancellations;
begin
  insert into public.form_limits (ip_hash, form) values (record_cancellation.ip_hash, 'cancellation');
  is_suspect := public.form_suspect('cancellation', record_cancellation.ip_hash, record_cancellation.confirmation_email);
  select e.* into found_entitlement
  from public.entitlements e
  join auth.users u on u.id = e.profile_id
  where e.source = 'stripe' and e.status in ('active', 'past_due')
    and lower(u.email) = lower(trim(record_cancellation.account_email))
  order by e.created_at desc
  limit 1;
  if found_entitlement.id is not null then
    found_email := (select u.email from auth.users u where u.id = found_entitlement.profile_id);
  end if;
  insert into public.cancellations as c (
    kind, reason, name, account_email, contract, wanted_date, confirmation_email, profile_id, entitlement_id,
    matched, suspect
  ) values (
    record_cancellation.kind, nullif(trim(record_cancellation.reason), ''), trim(record_cancellation.name),
    trim(record_cancellation.account_email), record_cancellation.contract, wanted,
    trim(record_cancellation.confirmation_email), found_entitlement.profile_id, found_entitlement.id,
    found_entitlement.id is not null, is_suspect
  )
  returning * into made;
  return jsonb_build_object(
    'id', made.id, 'receivedAt', made.received_at, 'matched', made.matched, 'suspect', made.suspect,
    'subscription', found_entitlement.stripe_subscription_id, 'entitlementId', found_entitlement.id,
    'periodEnd', found_entitlement.current_period_end, 'accountEmail', found_email);
end;
$$;

/** What happened to a cancellation (after the route told Stripe), mirrored into the entitlement. */
create function public.confirm_cancellation(target uuid, decision text, effective timestamptz default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  found_cancellation public.cancellations;
  found_entitlement public.entitlements;
begin
  if decision is null or decision not in ('scheduled', 'ended', 'rejected', 'resumed') then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  update public.cancellations c set
    decision = confirm_cancellation.decision,
    effective_at = case when confirm_cancellation.decision = 'rejected' then null else effective end,
    handled_at = case when confirm_cancellation.decision in ('ended', 'rejected', 'resumed') then now() else c.handled_at end
  where c.id = target
  returning * into found_cancellation;
  if found_cancellation.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
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

create function public.mark_receipt_sent(kind text, target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if kind = 'withdrawal' then
    update public.withdrawals w set receipt_sent_at = coalesce(w.receipt_sent_at, now()) where w.id = target;
  elsif kind = 'cancellation' then
    update public.cancellations c set receipt_sent_at = coalesce(c.receipt_sent_at, now()) where c.id = target;
  else
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
end;
$$;

/**
 * The customer asks for changes to a delivered proposal (the route checked the account and set the
 * due date). 'ok', 'notFound', 'locked', 'noneLeft' or 'expired'.
 */
create function public.record_revision(proposal uuid, account uuid, message text, due timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare
  found_proposal public.site_proposals;
  found_order public.orders;
begin
  select * into found_proposal from public.site_proposals p
  where p.id = proposal and p.profile_id = account and p.status in ('delivered', 'applied');
  if found_proposal.id is null then
    return 'notFound';
  end if;
  select * into found_order from public.orders o where o.id = found_proposal.order_id for update;
  if found_order.withdrawal_pending or found_order.status in ('refunded', 'withdrawn') then
    return 'locked';
  end if;
  if found_order.revisions_used >= found_order.revisions_allowed then
    return 'noneLeft';
  end if;
  if found_order.delivered_at is null or now() > found_order.delivered_at + interval '14 days' then
    return 'expired';
  end if;
  if found_order.status <> 'delivered' then
    -- A revision is already being worked on.
    return 'locked';
  end if;
  update public.orders o set
    revisions_used = o.revisions_used + 1,
    status = 'revision_requested',
    revision_due_at = due
  where o.id = found_order.id;
  update public.site_proposals p set request = trim(record_revision.message) where p.id = found_proposal.id;
  perform public.order_event(found_order.id, 'revision_requested',
    jsonb_build_object('proposal', found_proposal.id, 'round', found_proposal.round, 'dueAt', due));
  return 'ok';
end;
$$;

-- ── Jobs ────────────────────────────────────────────────────────────────────────────────────
create function public.purge_form_limits() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.form_limits where at < now() - interval '1 day';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

/**
 * Daily: completes delivered orders after the 14-day revision period, forgets briefings 30 days
 * after an order ends (photos through public.storage_purge and the Storage API), and deletes
 * withdrawal and cancellation records after 3 years. Order rows and their invoice-relevant fields
 * stay (10 years, § 147 AO).
 */
create function public.service_maintenance() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  completed integer;
  forgotten integer;
  withdrawals_deleted integer;
  cancellations_deleted integer;
begin
  with done as (
    update public.orders o set status = 'completed', completed_at = now()
    where o.status = 'delivered' and not o.withdrawal_pending and o.delivered_at + interval '14 days' < now()
    returning o.id
  ), logged as (
    insert into public.order_events (order_id, kind) select id, 'completed' from done returning 1
  )
  select count(*) into completed from logged;

  with ended as (
    select o.id, o.profile_id from public.orders o
    where o.briefing is not null and coalesce(o.completed_at, o.refunded_at, o.withdrawn_at) + interval '30 days' < now()
    for update
  ), queued as (
    insert into public.storage_purge (bucket, prefix)
    select 'briefing', e.profile_id::text || '/' || e.id::text || '/' from ended e where e.profile_id is not null
  ), cleared as (
    update public.orders o set briefing = null from ended e where o.id = e.id returning 1
  )
  select count(*) into forgotten from cleared;

  delete from public.withdrawals where received_at < now() - interval '3 years';
  get diagnostics withdrawals_deleted = row_count;
  delete from public.cancellations where received_at < now() - interval '3 years';
  get diagnostics cancellations_deleted = row_count;

  return jsonb_build_object('completed', completed, 'briefingsCleared', forgotten,
    'withdrawalsDeleted', withdrawals_deleted, 'cancellationsDeleted', cancellations_deleted);
end;
$$;

select cron.schedule('linkyo-purge-form-limits', '37 3 * * *', 'select public.purge_form_limits()');
select cron.schedule('linkyo-service-maintenance', '47 3 * * *', 'select public.service_maintenance()');

-- A deleted account leaves no briefing text behind (the order row stays, without the person).
create function public.forget_service_data() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.orders o set briefing = null where o.profile_id = old.id and o.briefing is not null;
  return old;
end;
$$;
create trigger profiles_forget_service_data before delete on public.profiles
  for each row execute function public.forget_service_data();

-- ── Owner: the customer's orders and proposals ──────────────────────────────────────────────
create function public.my_orders() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'number', o.number, 'package', o.package, 'status', o.status, 'orderedAt', o.ordered_at,
    'promisedDueAt', o.promised_due_at, 'dueAt', o.due_at, 'briefed', o.briefed_at is not null,
    'revisionsAllowed', o.revisions_allowed, 'revisionsUsed', o.revisions_used, 'deliveredAt', o.delivered_at
  ) order by o.ordered_at desc, o.number desc), '[]'::jsonb)
  from public.orders o
  where o.profile_id = auth.uid();
$$;

/** One order of the caller with its briefing and delivered proposals; null when not theirs. */
create function public.my_order(target uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'package', o.package, 'status', o.status, 'locale', o.locale,
    'amountCents', o.amount_cents, 'currency', o.currency, 'vatMode', o.vat_mode, 'earlyStart', o.early_start,
    'orderedAt', o.ordered_at, 'startAfter', o.start_after, 'promisedDueAt', o.promised_due_at, 'dueAt', o.due_at,
    'briefed', o.briefed_at is not null, 'briefedAt', o.briefed_at, 'briefing', o.briefing,
    'revisionsAllowed', o.revisions_allowed, 'revisionsUsed', o.revisions_used, 'revisionDueAt', o.revision_due_at,
    'deliveredAt', o.delivered_at, 'reviseUntil', o.delivered_at + interval '14 days',
    'completedAt', o.completed_at, 'refundedAt', o.refunded_at, 'refundKind', o.refund_kind,
    'withdrawalPending', o.withdrawal_pending,
    'voluntaryRefundAvailable', public.voluntary_refund_available(o.id),
    'proposals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'round', p.round, 'status', p.status, 'deliveredAt', p.delivered_at, 'message', p.message,
        'aiAssisted', public.page_has_ai(p.page), 'extras', p.extras, 'storyPaths', to_jsonb(p.story_paths)
      ) order by p.round desc)
      from public.site_proposals p
      where p.order_id = o.id and p.status in ('delivered', 'applied', 'superseded')
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = target and o.profile_id = auth.uid();
$$;

/** Delivered proposals the caller has not used yet (the Home card). */
create function public.my_proposals() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'orderId', o.id, 'number', o.number, 'package', o.package, 'round', p.round,
    'deliveredAt', p.delivered_at, 'aiAssisted', public.page_has_ai(p.page),
    'voluntaryRefundAvailable', public.voluntary_refund_available(o.id)
  ) order by p.delivered_at desc), '[]'::jsonb)
  from public.site_proposals p
  join public.orders o on o.id = p.order_id
  where p.profile_id = auth.uid() and p.status = 'delivered';
$$;

/** The customer used the proposal (the editor already replaced the page, as one undoable step). */
create function public.mark_proposal_applied(proposal uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  found_proposal public.site_proposals;
begin
  update public.site_proposals p set status = 'applied', applied_at = now()
  where p.id = proposal and p.profile_id = auth.uid() and p.profile_id is not null
    and p.status in ('delivered', 'applied')
  returning * into found_proposal;
  if found_proposal.id is null then
    return 'notFound';
  end if;
  perform public.order_event(found_proposal.order_id, 'proposal_applied',
    jsonb_build_object('proposal', found_proposal.id, 'round', found_proposal.round));
  return 'ok';
end;
$$;

-- ── Team: orders ────────────────────────────────────────────────────────────────────────────
/** The queue. Only orders whose confirmation went out; withdrawals waiting for a decision first. */
create function public.admin_orders(scope text default 'open') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('customers.view');
  if scope is null or scope not in ('open', 'mine', 'delivered', 'all') then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'number', o.number, 'package', o.package, 'status', o.status,
      'withdrawalPending', o.withdrawal_pending,
      'customer', jsonb_build_object('id', o.profile_id, 'username', p.username::text,
        'email', coalesce(u.email, o.customer_email)),
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

/** One order for the team: briefing, timeline, proposals and the customer's current page. */
create function public.admin_order(target uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  perform public.require_permission('customers.view');
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'package', o.package, 'status', o.status, 'locale', o.locale,
    'amountCents', o.amount_cents, 'vatMode', o.vat_mode, 'earlyStart', o.early_start,
    'withdrawalPending', o.withdrawal_pending,
    'customer', jsonb_build_object('id', o.profile_id, 'username', p.username::text,
      'email', coalesce(u.email, o.customer_email), 'name', o.customer_name),
    'orderedAt', o.ordered_at, 'startAfter', o.start_after, 'promisedDueAt', o.promised_due_at, 'dueAt', o.due_at,
    'briefedAt', o.briefed_at, 'briefing', o.briefing, 'confirmationSentAt', o.confirmation_sent_at,
    'assignee', case when o.assignee is null then null else jsonb_build_object('id', o.assignee, 'label', a.email) end,
    'revisionsAllowed', o.revisions_allowed, 'revisionsUsed', o.revisions_used,
    'revisionsLeft', greatest(o.revisions_allowed - o.revisions_used, 0), 'revisionDueAt', o.revision_due_at,
    'deliveredAt', o.delivered_at, 'completedAt', o.completed_at, 'refundedAt', o.refunded_at,
    'refundKind', o.refund_kind, 'withdrawnAt', o.withdrawn_at,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'at', e.at, 'kind', e.kind, 'details', e.details,
        'actor', (select x.email from auth.users x where x.id = e.actor)) order by e.at desc, e.id desc)
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

create function public.admin_assign_order(target uuid, member uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  chosen uuid := coalesce(member, auth.uid());
  found_order public.orders;
begin
  perform public.require_permission('pages.edit');
  if not exists (select 1 from public.team_members m where m.user_id = chosen) then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  update public.orders o set
    assignee = chosen,
    status = case when o.status = 'queued' then 'in_progress' else o.status end::public.order_status
  where o.id = target
  returning * into found_order;
  if found_order.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  perform public.order_event(target, 'assigned', jsonb_build_object('assignee', chosen));
  perform public.audit('order.assign', found_order.profile_id, found_order.number,
    jsonb_build_object('order', target, 'assignee', chosen));
end;
$$;

/**
 * Saves the draft of the current round (round = revisions used). A new round starts from the latest
 * delivered proposal's kit. Refused (linkyo:locked) once that round was delivered, and while the
 * order is refunded, withdrawn or has a withdrawal waiting. Never writes public.sites.
 */
create function public.admin_save_proposal(
  target uuid, page jsonb, theme jsonb, kind text default null, message text default null, extras jsonb default null,
  stories text[] default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  found_order public.orders;
  current_round smallint;
  existing public.site_proposals;
  latest public.site_proposals;
  folder text;
  saved uuid;
begin
  perform public.require_permission('pages.edit');
  select * into found_order from public.orders o where o.id = target for update;
  if found_order.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_order.withdrawal_pending or found_order.status in ('refunded', 'withdrawn') then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  if stories is not null then
    folder := coalesce(found_order.profile_id::text, '') || '/' || found_order.id::text || '/';
    if exists (
      select 1 from unnest(stories) s(path)
      where s.path is null or left(s.path, char_length(folder)) <> folder or s.path ~ '(^|/)\.\.(/|$)'
        or char_length(s.path) <= char_length(folder)
    ) then
      raise exception 'linkyo:invalid' using errcode = 'P0001';
    end if;
  end if;
  current_round := found_order.revisions_used;
  select * into existing from public.site_proposals p where p.order_id = target and p.round = current_round;
  if existing.id is not null and existing.status <> 'draft' then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  if existing.id is null then
    select * into latest from public.site_proposals p
    where p.order_id = target and p.status in ('delivered', 'applied', 'superseded')
    order by p.round desc limit 1;
    insert into public.site_proposals as p (
      order_id, profile_id, round, page, theme, kind, message, extras, story_paths, created_by
    ) values (
      target, found_order.profile_id, current_round, admin_save_proposal.page, admin_save_proposal.theme,
      admin_save_proposal.kind, nullif(trim(admin_save_proposal.message), ''),
      coalesce(admin_save_proposal.extras, latest.extras), coalesce(stories, latest.story_paths, '{}'), auth.uid()
    )
    returning p.id into saved;
    perform public.order_event(target, 'proposal_saved', jsonb_build_object('proposal', saved, 'round', current_round));
    perform public.audit('order.proposal', found_order.profile_id, found_order.number,
      jsonb_build_object('order', target, 'round', current_round));
  else
    update public.site_proposals p set
      page = admin_save_proposal.page,
      theme = admin_save_proposal.theme,
      kind = coalesce(admin_save_proposal.kind, p.kind),
      message = case when admin_save_proposal.message is null then p.message
                     else nullif(trim(admin_save_proposal.message), '') end,
      extras = coalesce(admin_save_proposal.extras, p.extras),
      story_paths = coalesce(stories, p.story_paths)
    where p.id = existing.id;
    saved := existing.id;
  end if;
  return saved;
end;
$$;

/**
 * Hands the draft to the customer: earlier deliveries of the order are superseded and the order is
 * 'delivered' (its first delivery date stays). Premium needs the complete kit (linkyo:incomplete).
 */
create function public.admin_deliver_proposal(proposal uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_proposal public.site_proposals;
  found_order public.orders;
  first_delivery timestamptz;
begin
  perform public.require_permission('pages.edit');
  select * into found_proposal from public.site_proposals p where p.id = proposal for update;
  if found_proposal.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  select * into found_order from public.orders o where o.id = found_proposal.order_id for update;
  if found_order.withdrawal_pending or found_order.status in ('refunded', 'withdrawn')
     or found_proposal.status <> 'draft' then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  if found_order.package = 'premium'
     and not public.proposal_kit_complete(found_proposal.extras, found_proposal.story_paths) then
    raise exception 'linkyo:incomplete' using errcode = 'P0001';
  end if;
  update public.site_proposals p set status = 'superseded'
  where p.order_id = found_order.id and p.status = 'delivered' and p.id <> found_proposal.id;
  update public.site_proposals p set status = 'delivered', delivered_at = now() where p.id = found_proposal.id;
  first_delivery := coalesce(found_order.delivered_at, now());
  update public.orders o set status = 'delivered', delivered_at = first_delivery, revision_due_at = null
  where o.id = found_order.id;
  perform public.order_event(found_order.id, 'proposal_delivered',
    jsonb_build_object('proposal', found_proposal.id, 'round', found_proposal.round));
  perform public.audit('order.deliver', found_order.profile_id, found_order.number,
    jsonb_build_object('order', found_order.id, 'round', found_proposal.round));
  return jsonb_build_object(
    'customerEmail', coalesce((select u.email from auth.users u where u.id = found_order.profile_id),
      found_order.customer_email),
    'locale', found_order.locale,
    'number', found_order.number,
    'package', found_order.package,
    'round', found_proposal.round,
    'revisionsLeft', greatest(found_order.revisions_allowed - found_order.revisions_used, 0),
    'reviseUntil', first_delivery + interval '14 days',
    'aiAssisted', public.page_has_ai(found_proposal.page),
    'hasKit', found_order.package = 'premium'
  );
end;
$$;

create function public.admin_order_refund_target(target uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  found_order public.orders;
begin
  perform public.require_permission('billing.manage');
  select * into found_order from public.orders o where o.id = target;
  if found_order.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
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

-- ── Team: withdrawals and cancellations ─────────────────────────────────────────────────────
create function public.admin_contract_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('billing.view');
  return coalesce((
    select jsonb_agg(item.body order by item.handled, item.open_since, item.received_at desc)
    from (
      select w.handled_at is not null as handled,
        case when w.handled_at is null then w.received_at end as open_since,
        w.received_at,
        jsonb_build_object(
          'kind', 'withdrawal', 'id', w.id, 'receivedAt', w.received_at, 'name', w.name, 'email', w.email,
          'contract', w.contract, 'matched', w.matched, 'suspect', w.suspect, 'receiptSentAt', w.receipt_sent_at,
          'decision', w.decision, 'refundCents', w.refund_cents, 'handledAt', w.handled_at,
          'handledBy', (select x.email from auth.users x where x.id = w.handled_by), 'note', w.note,
          'refundDueAt', w.received_at + interval '14 days',
          'account', case when w.profile_id is null then null else jsonb_build_object(
            'id', w.profile_id, 'username', (select p.username::text from public.profiles p where p.id = w.profile_id),
            'email', (select u.email from auth.users u where u.id = w.profile_id)) end,
          'order', (select jsonb_build_object('id', o.id, 'number', o.number, 'package', o.package,
              'status', o.status, 'amountCents', o.amount_cents, 'earlyStart', o.early_start,
              'withdrawalPending', o.withdrawal_pending, 'deliveredAt', o.delivered_at)
            from public.orders o where o.id = w.order_id),
          'entitlement', (select jsonb_build_object('id', e.id, 'subscription', e.stripe_subscription_id,
              'status', e.status, 'currentPeriodEnd', e.current_period_end)
            from public.entitlements e where e.id = w.entitlement_id),
          'invoice', (select jsonb_build_object('id', i.id, 'paymentIntent', i.payment_intent, 'amountCents', i.amount_cents)
            from public.entitlements e
            join public.invoices i on i.subscription = e.stripe_subscription_id and i.status = 'paid'
            where e.id = w.entitlement_id
            order by i.at desc limit 1)
        ) as body
      from public.withdrawals w
      union all
      select c.handled_at is not null,
        case when c.handled_at is null then c.received_at end,
        c.received_at,
        jsonb_build_object(
          'kind', 'cancellation', 'id', c.id, 'receivedAt', c.received_at, 'cancellationKind', c.kind,
          'reason', c.reason, 'name', c.name, 'accountEmail', c.account_email, 'confirmationEmail', c.confirmation_email,
          'contract', c.contract, 'wantedDate', c.wanted_date, 'matched', c.matched, 'suspect', c.suspect,
          'decision', c.decision, 'effectiveAt', c.effective_at, 'receiptSentAt', c.receipt_sent_at,
          'handledAt', c.handled_at, 'handledBy', (select x.email from auth.users x where x.id = c.handled_by),
          'note', c.note,
          'account', case when c.profile_id is null then null else jsonb_build_object(
            'id', c.profile_id, 'username', (select p.username::text from public.profiles p where p.id = c.profile_id),
            'email', (select u.email from auth.users u where u.id = c.profile_id)) end,
          'entitlement', (select jsonb_build_object('id', e.id, 'subscription', e.stripe_subscription_id,
              'status', e.status, 'currentPeriodEnd', e.current_period_end,
              'cancelAtPeriodEnd', e.cancel_at_period_end, 'cancelAt', e.cancel_at)
            from public.entitlements e where e.id = c.entitlement_id),
          'invoice', (select jsonb_build_object('id', i.id, 'paymentIntent', i.payment_intent, 'amountCents', i.amount_cents)
            from public.entitlements e
            join public.invoices i on i.subscription = e.stripe_subscription_id and i.status = 'paid'
            where e.id = c.entitlement_id
            order by i.at desc limit 1)
        )
      from public.cancellations c
    ) item
  ), '[]'::jsonb);
end;
$$;

/**
 * The team decides a withdrawal. 'rejected' needs a note (work on the order resumes); 'accepted'
 * waits for the refund (record_refund 'withdrawal'), or ends the order at once without one.
 * Returns what the route needs for Stripe and the e-mail.
 */
create function public.admin_resolve_withdrawal(
  target uuid, decision text, note text default null, refund_cents integer default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_withdrawal public.withdrawals;
  found_order public.orders;
  found_entitlement public.entitlements;
begin
  perform public.require_permission('billing.manage');
  if decision is null or decision not in ('accepted', 'rejected')
     or (decision = 'rejected' and nullif(trim(note), '') is null)
     or refund_cents < 0 then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  select * into found_withdrawal from public.withdrawals w where w.id = target for update;
  if found_withdrawal.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_withdrawal.decision is not null then
    raise exception 'linkyo:locked' using errcode = 'P0001';
  end if;
  update public.withdrawals w set
    decision = admin_resolve_withdrawal.decision,
    refund_cents = admin_resolve_withdrawal.refund_cents,
    note = coalesce(nullif(trim(admin_resolve_withdrawal.note), ''), w.note),
    handled_at = now(),
    handled_by = auth.uid()
  where w.id = target;
  select * into found_order from public.orders o where o.id = found_withdrawal.order_id for update;
  if found_order.id is not null then
    if decision = 'rejected' then
      update public.orders o set withdrawal_pending = false where o.id = found_order.id;
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
  select * into found_entitlement from public.entitlements e where e.id = found_withdrawal.entitlement_id;
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
 * The team decides a cancellation: ended, rejected or resumed, each with a note (for resumed: the
 * account holder's request from the account's e-mail). The route then calls Stripe and
 * confirm_cancellation.
 */
create function public.admin_resolve_cancellation(target uuid, decision text, note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_cancellation public.cancellations;
begin
  perform public.require_permission('billing.manage');
  if decision is null or decision not in ('ended', 'rejected', 'resumed') or nullif(trim(note), '') is null then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  update public.cancellations c set note = trim(admin_resolve_cancellation.note), handled_by = auth.uid()
  where c.id = target
  returning * into found_cancellation;
  if found_cancellation.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  perform public.audit('cancellation.' || decision, found_cancellation.profile_id, found_cancellation.contract,
    jsonb_build_object('cancellation', target, 'note', trim(note)));
  return jsonb_build_object(
    'subscription', (select e.stripe_subscription_id from public.entitlements e where e.id = found_cancellation.entitlement_id),
    'accountEmail', (select u.email from auth.users u where u.id = found_cancellation.profile_id)
  );
end;
$$;

/** Unmatched or informational requests: marked as handled, with an optional note. */
create function public.admin_mark_contract_handled(kind text, target uuid, note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  account uuid;
begin
  perform public.require_permission('billing.manage');
  if kind = 'withdrawal' then
    update public.withdrawals w set handled_at = now(), handled_by = auth.uid(),
      note = coalesce(nullif(trim(admin_mark_contract_handled.note), ''), w.note)
    where w.id = target returning w.profile_id into account;
  elsif kind = 'cancellation' then
    update public.cancellations c set handled_at = now(), handled_by = auth.uid(),
      note = coalesce(nullif(trim(admin_mark_contract_handled.note), ''), c.note)
    where c.id = target returning c.profile_id into account;
  else
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  if not found then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  perform public.audit(kind || '.handled', account, kind, jsonb_build_object(kind, target));
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────────
-- Functions are executable by PUBLIC (and, in Supabase, by anon and authenticated) by default.
-- Internal helpers: their owner only (definer functions and jobs call them).
revoke execute on function public.berlin_midnight(date), public.page_has_ai(jsonb),
  public.proposal_kit_complete(jsonb, text[]), public.voluntary_refund_available(uuid),
  public.order_event(uuid, text, jsonb), public.mirror_pro_subscription(uuid, public.entitlement_status, timestamptz),
  public.form_suspect(text, text, text), public.purge_form_limits(), public.service_maintenance(),
  public.forget_service_data()
  from public, anon, authenticated;

-- Server only (service role).
revoke execute on function public.has_pro(uuid), public.record_checkout_intent(text, uuid, text, text),
  public.record_checkout_consent(text, uuid, boolean, text, timestamptz, timestamptz),
  public.record_service_order(text, text, integer, text, text, text), public.mark_confirmation_sent(uuid),
  public.set_order_briefing(uuid, uuid, jsonb, timestamptz), public.service_load(date, integer, uuid),
  public.service_capacity(),
  public.upsert_pro_subscription(uuid, text, text, public.entitlement_status, timestamptz, boolean, timestamptz),
  public.update_pro_subscription(text, public.entitlement_status), public.mark_pro_confirmation_sent(text),
  public.record_invoice(text, uuid, text, integer, text, text), public.record_refund(text, text, integer),
  public.record_withdrawal(text, text, text, text),
  public.record_cancellation(text, text, text, text, text, text, text, date),
  public.confirm_cancellation(uuid, text, timestamptz), public.mark_receipt_sent(text, uuid),
  public.record_revision(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.has_pro(uuid), public.record_checkout_intent(text, uuid, text, text),
  public.record_checkout_consent(text, uuid, boolean, text, timestamptz, timestamptz),
  public.record_service_order(text, text, integer, text, text, text), public.mark_confirmation_sent(uuid),
  public.set_order_briefing(uuid, uuid, jsonb, timestamptz), public.service_load(date, integer, uuid),
  public.service_capacity(),
  public.upsert_pro_subscription(uuid, text, text, public.entitlement_status, timestamptz, boolean, timestamptz),
  public.update_pro_subscription(text, public.entitlement_status), public.mark_pro_confirmation_sent(text),
  public.record_invoice(text, uuid, text, integer, text, text), public.record_refund(text, text, integer),
  public.record_withdrawal(text, text, text, text),
  public.record_cancellation(text, text, text, text, text, text, text, date),
  public.confirm_cancellation(uuid, text, timestamptz), public.mark_receipt_sent(text, uuid),
  public.record_revision(uuid, uuid, text, timestamptz)
  to service_role;

-- Customers and the team (each function checks the caller).
revoke execute on function public.my_orders(), public.my_order(uuid), public.my_proposals(),
  public.mark_proposal_applied(uuid), public.admin_orders(text), public.admin_order(uuid),
  public.admin_assign_order(uuid, uuid),
  public.admin_save_proposal(uuid, jsonb, jsonb, text, text, jsonb, text[]), public.admin_deliver_proposal(uuid),
  public.admin_order_refund_target(uuid), public.admin_contract_requests(),
  public.admin_resolve_withdrawal(uuid, text, text, integer), public.admin_resolve_cancellation(uuid, text, text),
  public.admin_mark_contract_handled(text, uuid, text)
  from public, anon;
grant execute on function public.my_orders(), public.my_order(uuid), public.my_proposals(),
  public.mark_proposal_applied(uuid), public.admin_orders(text), public.admin_order(uuid),
  public.admin_assign_order(uuid, uuid),
  public.admin_save_proposal(uuid, jsonb, jsonb, text, text, jsonb, text[]), public.admin_deliver_proposal(uuid),
  public.admin_order_refund_target(uuid), public.admin_contract_requests(),
  public.admin_resolve_withdrawal(uuid, text, text, integer), public.admin_resolve_cancellation(uuid, text, text),
  public.admin_mark_contract_handled(text, uuid, text)
  to authenticated;
