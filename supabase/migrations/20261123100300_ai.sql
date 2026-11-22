-- The AI page builder (v7 phase 1): settings with the kill switch, the run log, the daily budget
-- and content-free usage counters. Our server reserves a run before it calls Claude and settles it
-- afterwards; customers only read their own runs (a few columns) and ask to stop them.
-- The defaults are mirrored by apps/web/src/features/ai/limits.ts (limits.test.ts compares).
-- Retention: drafts 7 days, the run log 30 days, budget days 90 days; usage counters stay (quota).
-- "Today" and "this month" are Europe/Berlin. Tests: supabase/tests/ai.test.sql.

create type public.ai_run_status as enum ('running', 'succeeded', 'stopped', 'failed', 'refused');
create type public.ai_route as enum ('welcome', 'dashboard', 'team');

-- ── Settings (one row; functions and our server only) ───────────────────────────────────────
create table public.ai_settings (
  id boolean primary key default true constraint one_row check (id),
  -- The kill switch: the team (security.manage) or a spend-limit answer from Anthropic turns it off.
  enabled boolean not null default true,
  daily_budget_micros bigint not null default 10000000 constraint budget_positive check (daily_budget_micros >= 0),
  free_drafts integer not null default 1 constraint free_drafts_positive check (free_drafts >= 0),
  pro_drafts_per_month integer not null default 5 constraint pro_drafts_positive check (pro_drafts_per_month >= 0),
  ip_runs_per_day integer not null default 5 constraint ip_runs_positive check (ip_runs_per_day >= 0),
  account_concurrency integer not null default 1 constraint account_concurrency_positive check (account_concurrency >= 0),
  global_concurrency integer not null default 10 constraint global_concurrency_positive check (global_concurrency >= 0),
  uncounted_failures_per_day integer not null default 3 constraint failures_positive check (uncounted_failures_per_day >= 0),
  updated_at timestamptz not null default now()
);
insert into public.ai_settings default values;
alter table public.ai_settings enable row level security;
revoke all on public.ai_settings from authenticated, anon;
create trigger ai_settings_touch before update on public.ai_settings
  for each row execute function public.touch_updated_at();

-- ── Runs ────────────────────────────────────────────────────────────────────────────────────
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  -- Whose run it is. For a team run (route 'team') that is the team member, never the customer.
  profile_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  route public.ai_route not null,
  -- Daily-salted HMAC of the caller's address (never the address).
  ip_hash text,
  status public.ai_run_status not null default 'running',
  -- Counted toward the account's drafts (a delivered draft, or a stop after the first block).
  counted boolean not null default false,
  reserved_micros bigint not null constraint reserved_positive check (reserved_micros >= 0),
  cost_micros bigint,
  model text,
  served_by text,
  effort text,
  stop_reason text,
  error_code text,
  prompt_version text not null,
  schema_version text not null,
  input_tokens integer,
  cache_read_tokens integer,
  cache_write_tokens integer,
  output_tokens integer,
  calls smallint not null default 0,
  sources smallint,
  blocks smallint,
  dropped smallint,
  fixed smallint,
  ms_sources integer,
  ms_model integer,
  ms_total integer,
  -- Content-free: [{key, state, count, ms}].
  progress jsonb not null default '[]'::jsonb,
  -- The draft {page, theme, kind, notes}; cleared after 7 days.
  result jsonb,
  stop_requested_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index ai_runs_profile on public.ai_runs (profile_id, created_at desc);
create index ai_runs_ip on public.ai_runs (ip_hash, created_at desc);
create index ai_runs_running on public.ai_runs (created_at) where status = 'running';
alter table public.ai_runs enable row level security;
-- A team run belongs to the team member, so a customer never sees a team run or its draft.
create policy "owners read their runs" on public.ai_runs
  for select to authenticated using (profile_id = (select auth.uid()));
revoke all on public.ai_runs from authenticated, anon;
-- Never the address hash, the actor, money or tokens.
grant select (id, route, status, counted, error_code, blocks, dropped, fixed, ms_total, progress, result, created_at,
  finished_at, applied_at) on public.ai_runs to authenticated;

-- What each Berlin day spent (reservations until a run settles, then the real cost).
create table public.ai_budget_days (
  day date primary key,
  spent_micros bigint not null default 0,
  runs integer not null default 0
);
alter table public.ai_budget_days enable row level security;
revoke all on public.ai_budget_days from authenticated, anon;

-- Counted drafts per account and Berlin month. Content-free, kept after the run log is deleted (quota).
create table public.ai_usage (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  month date not null constraint first_of_month check (extract(day from month) = 1),
  counted integer not null default 0,
  primary key (profile_id, month)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from authenticated, anon;

-- ── Helpers (internal) ──────────────────────────────────────────────────────────────────────
create function public.berlin_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;

create function public.berlin_month() returns date
language sql stable set search_path = '' as $$
  select date_trunc('month', now() at time zone 'Europe/Berlin')::date;
$$;

/** The account's plan for AI drafts, its allowance and what it used (free: for life; Pro: this month). */
create function public.ai_allowance(account uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  settings public.ai_settings;
  pro boolean := public.has_pro(account);
  used integer;
begin
  select * into settings from public.ai_settings where id;
  if pro then
    used := coalesce((select u.counted from public.ai_usage u where u.profile_id = account and u.month = public.berlin_month()), 0);
  else
    used := coalesce((select sum(u.counted)::integer from public.ai_usage u where u.profile_id = account), 0);
  end if;
  return jsonb_build_object(
    'plan', case when pro then 'pro' else 'free' end,
    'allowance', case when pro then settings.pro_drafts_per_month else settings.free_drafts end,
    'used', used);
end;
$$;

-- ── Server ──────────────────────────────────────────────────────────────────────────────────
/**
 * Called exactly once per run, by the pipeline, before anything is fetched or sent to Claude. All
 * checks and the reservation happen in one transaction (the budget row is locked first, so two runs
 * never pass the same check at once). Refusals: disabled, budget, busy, quota, ip, failures.
 * For a team run `account` is the team member (= actor) and `target_order` the order.
 */
create function public.ai_reserve_run(
  account uuid, ip_hash text, route public.ai_route, worst_micros bigint, prompt_version text, schema_version text,
  actor uuid default null, target_order uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  settings public.ai_settings;
  today date := public.berlin_today();
  since timestamptz := public.berlin_midnight(public.berlin_today());
  budget public.ai_budget_days;
  allowance jsonb;
  plan text := 'team';
  limit_drafts integer;
  used integer;
  made uuid;
begin
  if route = 'team' then
    if actor is null or target_order is null or actor <> account then
      raise exception 'linkyo:invalid' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.orders o
      where o.id = target_order and (o.withdrawal_pending or o.status in ('refunded', 'withdrawn'))
    ) then
      raise exception 'linkyo:locked' using errcode = 'P0001';
    end if;
  end if;
  if worst_micros is null or worst_micros < 0 then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;

  select * into settings from public.ai_settings where id;
  if not coalesce(settings.enabled, false) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  if not public.is_active(account) then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  insert into public.ai_budget_days (day) values (today) on conflict (day) do nothing;
  select * into budget from public.ai_budget_days b where b.day = today for update;
  if budget.spent_micros + worst_micros > settings.daily_budget_micros then
    return jsonb_build_object('ok', false, 'reason', 'budget');
  end if;

  if (select count(*) from public.ai_runs r where r.profile_id = account and r.status = 'running')
       >= settings.account_concurrency
     or (select count(*) from public.ai_runs r where r.status = 'running') >= settings.global_concurrency then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  if route <> 'team' then
    allowance := public.ai_allowance(account);
    plan := allowance ->> 'plan';
    limit_drafts := (allowance ->> 'allowance')::integer;
    used := (allowance ->> 'used')::integer;
    if used >= limit_drafts then
      return jsonb_build_object('ok', false, 'reason', 'quota');
    end if;
    if ai_reserve_run.ip_hash is not null and (
      select count(*) from public.ai_runs r
      where r.ip_hash = ai_reserve_run.ip_hash and r.created_at >= since
    ) >= settings.ip_runs_per_day then
      return jsonb_build_object('ok', false, 'reason', 'ip');
    end if;
    if (
      select count(*) from public.ai_runs r
      where r.profile_id = account and r.created_at >= since and not r.counted
        and r.status in ('failed', 'refused', 'stopped')
    ) >= settings.uncounted_failures_per_day then
      return jsonb_build_object('ok', false, 'reason', 'failures');
    end if;
  end if;

  insert into public.ai_runs as r (
    profile_id, actor_id, order_id, route, ip_hash, reserved_micros, prompt_version, schema_version
  ) values (
    account, case when ai_reserve_run.route = 'team' then actor end,
    case when ai_reserve_run.route = 'team' then target_order end,
    ai_reserve_run.route, ai_reserve_run.ip_hash, worst_micros, ai_reserve_run.prompt_version,
    ai_reserve_run.schema_version
  )
  returning r.id into made;
  update public.ai_budget_days b set spent_micros = b.spent_micros + worst_micros, runs = b.runs + 1
  where b.day = today;

  return jsonb_build_object(
    'ok', true, 'id', made, 'plan', plan,
    'allowance', limit_drafts, 'used', used,
    'left', case when limit_drafts is null then null else greatest(limit_drafts - used, 0) end);
end;
$$;

/** Content-free progress for a reconnecting or polling client: [{key, state, count, ms}]. */
create function public.ai_record_progress(run uuid, progress jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(progress) is distinct from 'array' then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  update public.ai_runs r set progress = ai_record_progress.progress where r.id = run and r.status = 'running';
end;
$$;

create function public.ai_stop_requested(run uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select r.stop_requested_at is not null from public.ai_runs r where r.id = run), false);
$$;

/**
 * Ends a run once (later calls do nothing). Releases the reservation for the real cost and counts
 * the draft. `details` uses the column names: model, served_by, effort, stop_reason, error_code,
 * calls, sources, blocks, dropped, fixed, ms_sources, ms_model, ms_total, input_tokens,
 * cache_read_tokens, cache_write_tokens, output_tokens.
 */
create function public.ai_settle_run(
  run uuid, next_status public.ai_run_status, is_counted boolean, cost bigint, details jsonb, draft jsonb default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  found_run public.ai_runs;
  d jsonb := coalesce(details, '{}'::jsonb);
begin
  if next_status is null or next_status = 'running' then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  select * into found_run from public.ai_runs r where r.id = run for update;
  if found_run.id is null or found_run.status <> 'running' then
    return;
  end if;
  update public.ai_runs r set
    status = next_status,
    counted = coalesce(is_counted, false),
    cost_micros = coalesce(cost, 0),
    model = d ->> 'model',
    served_by = d ->> 'served_by',
    effort = d ->> 'effort',
    stop_reason = d ->> 'stop_reason',
    error_code = d ->> 'error_code',
    calls = coalesce((d ->> 'calls')::smallint, 0),
    sources = (d ->> 'sources')::smallint,
    blocks = (d ->> 'blocks')::smallint,
    dropped = (d ->> 'dropped')::smallint,
    fixed = (d ->> 'fixed')::smallint,
    ms_sources = (d ->> 'ms_sources')::integer,
    ms_model = (d ->> 'ms_model')::integer,
    ms_total = (d ->> 'ms_total')::integer,
    input_tokens = (d ->> 'input_tokens')::integer,
    cache_read_tokens = (d ->> 'cache_read_tokens')::integer,
    cache_write_tokens = (d ->> 'cache_write_tokens')::integer,
    output_tokens = (d ->> 'output_tokens')::integer,
    result = draft,
    finished_at = now()
  where r.id = run;
  update public.ai_budget_days b
  set spent_micros = greatest(0, b.spent_micros - found_run.reserved_micros + coalesce(cost, 0))
  where b.day = (found_run.created_at at time zone 'Europe/Berlin')::date;
  if coalesce(is_counted, false) and found_run.route <> 'team' then
    insert into public.ai_usage as u (profile_id, month, counted) values (found_run.profile_id, public.berlin_month(), 1)
    on conflict (profile_id, month) do update set counted = u.counted + 1;
  end if;
end;
$$;

/** Anthropic answered that the workspace spend limit is reached: switch the AI off until the team turns it on. */
create function public.ai_disable(reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.ai_settings s set enabled = false where s.id and s.enabled;
  if found then
    perform public.audit('ai.disabled', null, 'ai', jsonb_build_object('reason', left(coalesce(reason, ''), 200)));
  end if;
end;
$$;

/**
 * Every 5 minutes: runs stuck in 'running' for 10 minutes fail ('stale') and give their
 * reservation back; drafts are cleared after 7 days, runs deleted after 30 days, budget days after
 * 90. Usage counters stay. Returns the number of runs changed or deleted.
 */
create function public.ai_cleanup() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  stale integer;
  cleared integer;
  deleted integer;
begin
  with gone as (
    update public.ai_runs r set status = 'failed', error_code = 'stale', finished_at = now(), cost_micros = 0
    where r.status = 'running' and r.created_at < now() - interval '10 minutes'
    returning r.reserved_micros, (r.created_at at time zone 'Europe/Berlin')::date as day
  ), released as (
    update public.ai_budget_days b
    set spent_micros = greatest(0, b.spent_micros - g.reserved)
    from (select gone.day, sum(gone.reserved_micros) as reserved from gone group by gone.day) g
    where b.day = g.day
    returning 1
  )
  select count(*) into stale from gone;

  update public.ai_runs r set result = null where r.result is not null and r.created_at < now() - interval '7 days';
  get diagnostics cleared = row_count;
  delete from public.ai_runs r where r.created_at < now() - interval '30 days';
  get diagnostics deleted = row_count;
  delete from public.ai_budget_days b where b.day < public.berlin_today() - 90;
  return stale + cleared + deleted;
end;
$$;

select cron.schedule('linkyo-ai-cleanup', '*/5 * * * *', 'select public.ai_cleanup()');

-- ── Owner ───────────────────────────────────────────────────────────────────────────────────
/** The caller's drafts: {enabled, plan, allowance, used, left, period, resetsAt}. */
create function public.my_ai_quota() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  allowance jsonb;
  pro boolean;
begin
  if me is null then
    return null;
  end if;
  allowance := public.ai_allowance(me);
  pro := allowance ->> 'plan' = 'pro';
  return jsonb_build_object(
    'enabled', coalesce((select s.enabled from public.ai_settings s where s.id), false),
    'plan', allowance ->> 'plan',
    'allowance', (allowance ->> 'allowance')::integer,
    'used', (allowance ->> 'used')::integer,
    'left', greatest((allowance ->> 'allowance')::integer - (allowance ->> 'used')::integer, 0),
    'period', case when pro then 'month' else 'life' end,
    'resetsAt', case when pro then public.berlin_midnight((public.berlin_month() + interval '1 month')::date) end);
end;
$$;

/** The owner asks the run to stop (the pipeline checks every 2 s). 'ok', 'finished' or 'notFound'. */
create function public.ai_request_stop(run uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  found_run public.ai_runs;
begin
  select * into found_run from public.ai_runs r where r.id = run and r.profile_id = auth.uid() for update;
  if found_run.id is null then
    return 'notFound';
  end if;
  if found_run.status <> 'running' then
    return 'finished';
  end if;
  update public.ai_runs r set stop_requested_at = coalesce(r.stop_requested_at, now()) where r.id = run;
  return 'ok';
end;
$$;

/** The owner used the draft. */
create function public.ai_mark_applied(run uuid) returns void
language sql security definer set search_path = '' as $$
  update public.ai_runs r set applied_at = now() where r.id = run and r.profile_id = auth.uid();
$$;

-- ── Team ────────────────────────────────────────────────────────────────────────────────────
create function public.admin_set_ai_enabled(enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('security.manage');
  if admin_set_ai_enabled.enabled is null then
    raise exception 'linkyo:invalid' using errcode = 'P0001';
  end if;
  update public.ai_settings s set enabled = admin_set_ai_enabled.enabled where s.id;
  perform public.audit('ai.enabled', null, 'ai', jsonb_build_object('enabled', admin_set_ai_enabled.enabled));
end;
$$;

create function public.admin_ai_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('security.view');
  return jsonb_build_object(
    'enabled', coalesce((select s.enabled from public.ai_settings s where s.id), false),
    'today', coalesce((
      select jsonb_build_object('spentMicros', b.spent_micros, 'runs', b.runs)
      from public.ai_budget_days b where b.day = public.berlin_today()
    ), jsonb_build_object('spentMicros', 0, 'runs', 0)),
    'running', (select count(*)::integer from public.ai_runs r where r.status = 'running'));
end;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.berlin_today(), public.berlin_month(), public.ai_allowance(uuid), public.ai_cleanup()
  from public, anon, authenticated;

revoke execute on function
  public.ai_reserve_run(uuid, text, public.ai_route, bigint, text, text, uuid, uuid),
  public.ai_record_progress(uuid, jsonb), public.ai_stop_requested(uuid),
  public.ai_settle_run(uuid, public.ai_run_status, boolean, bigint, jsonb, jsonb), public.ai_disable(text)
  from public, anon, authenticated;
grant execute on function
  public.ai_reserve_run(uuid, text, public.ai_route, bigint, text, text, uuid, uuid),
  public.ai_record_progress(uuid, jsonb), public.ai_stop_requested(uuid),
  public.ai_settle_run(uuid, public.ai_run_status, boolean, bigint, jsonb, jsonb), public.ai_disable(text)
  to service_role;

revoke execute on function public.my_ai_quota(), public.ai_request_stop(uuid), public.ai_mark_applied(uuid),
  public.admin_set_ai_enabled(boolean), public.admin_ai_status()
  from public, anon;
grant execute on function public.my_ai_quota(), public.ai_request_stop(uuid), public.ai_mark_applied(uuid),
  public.admin_set_ai_enabled(boolean), public.admin_ai_status()
  to authenticated;
