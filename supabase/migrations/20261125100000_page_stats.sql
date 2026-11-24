-- Cookie-free page statistics (Stage 3 WP3.1, D-02 and A-08; draft ADR "cookie-free analytics").
-- Tests: supabase/tests/page_stats.test.sql. Additive only: new tables and functions; nothing that
-- exists changes. The app records only while the server switch LINKYO_ANALYTICS is "on"
-- (apps/web/src/lib/flags.ts); production leaves it off until the founder applies this migration and
-- the lawyer approves the privacy wording.
--
-- What is kept: per creator page and Berlin day, how often the page was opened, by how many different
-- visitors, and how often its blocks were tapped; split by block, referrer group, country and device
-- class. Never an IP address, a browser string, a cookie or anything a visitor's device keeps.
--
-- Different visitors: the app server hashes (page, network address, browser string) with today's salt
-- (HMAC-SHA-256) and hands over only the hash. The salt is random, lives in its own service-only table
-- (never next to the counts), and is deleted together with every visitor hash as soon as its day is
-- over (page_stats_purge, hourly). After that a day's numbers cannot be traced to anyone, not even by us.
--
-- Rollback (one line): select cron.unschedule('linkyo-purge-page-stats'); drop function
-- page_stats_record, page_stats_bump, page_stats_salt, page_stats_purge, my_page_stats, admin_page_stats;
-- drop table page_stats, page_stats_visitors, page_stats_salts.

-- ── The counts: one row per page, day, dimension and key ────────────────────────────────────
-- dimension 'page' (key ''): views, visitors and clicks of the whole page;
-- 'block' (key = the block's id): taps on it; 'referrer' (a group such as 'instagram' or 'direct'),
-- 'country' (ISO 3166 alpha-2) and 'device' ('mobile', 'tablet', 'desktop'): views.
create table public.page_stats (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  dimension text not null constraint page_stats_dimension check (dimension in ('page', 'block', 'referrer', 'country', 'device')),
  key text not null default '' constraint page_stats_key check (char_length(key) <= 80),
  views integer not null default 0 constraint page_stats_views check (views >= 0),
  visitors integer not null default 0 constraint page_stats_visitors_count check (visitors >= 0),
  clicks integer not null default 0 constraint page_stats_clicks check (clicks >= 0),
  primary key (profile_id, day, dimension, key)
);
comment on table public.page_stats is 'Daily counts per creator page, without cookies, IP addresses or browser strings (ADR draft cookie-free analytics).';

alter table public.page_stats enable row level security;
create policy "owners read their page stats" on public.page_stats
  for select to authenticated using (profile_id = (select auth.uid()));
revoke all on public.page_stats from anon;
revoke insert, update, delete, truncate on public.page_stats from authenticated;
-- The console's totals (admin_page_stats) read the 'page' rows of every page by day; the primary key
-- leads with the page, so without this they would scan the whole table on every console load. Every
-- count bumps the 'page' row too, so those rows alone also give the first counted day.
create index page_stats_page_day on public.page_stats (day) where dimension = 'page';

-- ── Visitor hashes of the running day (service only; deleted once the day is over) ──────────
create table public.page_stats_visitors (
  day date not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  visitor text not null constraint page_stats_visitor_hash check (visitor ~ '^[0-9a-f]{64}$'),
  views integer not null default 0,
  clicks integer not null default 0,
  primary key (day, profile_id, visitor)
);
alter table public.page_stats_visitors enable row level security;
-- No policies: only the functions below touch it.
revoke all on public.page_stats_visitors from authenticated, anon;

-- ── The daily salt (service only; deleted once its day is over) ─────────────────────────────
create table public.page_stats_salts (
  day date primary key,
  salt text not null constraint page_stats_salt_hex check (salt ~ '^[0-9a-f]{64}$')
);
alter table public.page_stats_salts enable row level security;
-- No policies: only page_stats_salt() hands it to the app server.
revoke all on public.page_stats_salts from authenticated, anon;

/**
 * Today's salt (Berlin day) for the app server's visitor hash, made on first use: { day, salt }.
 * Service only: the browser never sees it.
 */
create function public.page_stats_salt() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  today date := public.berlin_today();
  current_salt text;
begin
  insert into public.page_stats_salts (day, salt)
    values (today, encode(extensions.gen_random_bytes(32), 'hex'))
    on conflict (day) do nothing;
  select salt into current_salt from public.page_stats_salts where day = today;
  return jsonb_build_object('day', today, 'salt', current_salt);
end;
$$;
revoke execute on function public.page_stats_salt() from public, anon, authenticated;
grant execute on function public.page_stats_salt() to service_role;

/** Adds to one count row (internal: called by page_stats_record only). */
create function public.page_stats_bump(
  page uuid, on_day date, dim text, dim_key text, add_views integer, add_visitors integer, add_clicks integer
) returns void
language sql security definer set search_path = '' as $$
  insert into public.page_stats as s (profile_id, day, dimension, key, views, visitors, clicks)
  values (page, on_day, dim, dim_key, add_views, add_visitors, add_clicks)
  on conflict (profile_id, day, dimension, key) do update
    set views = s.views + excluded.views, visitors = s.visitors + excluded.visitors, clicks = s.clicks + excluded.clicks;
$$;
revoke execute on function public.page_stats_bump(uuid, date, text, text, integer, integer, integer) from public, anon, authenticated, service_role;

/**
 * One view of a public page or one tap on one of its blocks, as the app server saw it (service only).
 * Answers what happened: 'counted'; 'unknown' (no public page of that name: hidden, suspended, not
 * onboarded or unconfirmed pages are never counted); 'unknownBlock' (not a block visitors see now);
 * 'capped' (this visitor already opened or tapped it very often today: counted no further); 'invalid'.
 * Keys outside their lists are dropped (referrer 'other', no country or device row), never stored.
 */
create function public.page_stats_record(
  handle text,
  kind text,
  visitor text,
  block text default null,
  referrer text default null,
  country text default null,
  device text default null
) returns text
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  today date := public.berlin_today();
  page uuid;
  visible jsonb;
  seen_views integer;
  seen_clicks integer;
  ref_key text := case when referrer in ('instagram', 'tiktok', 'youtube', 'facebook', 'x', 'linkedin', 'search', 'qr', 'direct', 'other')
                       then referrer when referrer is null then null else 'other' end;
begin
  if kind not in ('view', 'click') or visitor is null or visitor !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;
  select p.id into page from public.profiles p where p.username = lower(trim(coalesce(handle, '')))::extensions.citext;
  visible := case when page is null then null else public.public_page(handle) end;
  if visible is null then
    return 'unknown';
  end if;
  if kind = 'click' and (
    block is null or char_length(block) > 80
    or not exists (select 1 from jsonb_array_elements(visible #> '{page,blocks}') b where b ->> 'id' = block)
  ) then
    return 'unknownBlock';
  end if;

  insert into public.page_stats_visitors as v (day, profile_id, visitor, views, clicks)
    values (today, page, visitor, (kind = 'view')::integer, (kind = 'click')::integer)
    on conflict (day, profile_id, visitor) do update
      set views = least(v.views + excluded.views, 100000), clicks = least(v.clicks + excluded.clicks, 100000)
    returning v.views, v.clicks into seen_views, seen_clicks;
  -- A person who reloads all day long, or a script that sends the same visit again, counts once in
  -- a while, not without end: at most 30 views and 60 taps a day per visitor and page.
  if (kind = 'view' and seen_views > 30) or (kind = 'click' and seen_clicks > 60) then
    return 'capped';
  end if;

  if kind = 'view' then
    -- A visitor counts once a day, on their first view.
    perform public.page_stats_bump(page, today, 'page', '', 1, (seen_views = 1)::integer, 0);
    if ref_key is not null then
      perform public.page_stats_bump(page, today, 'referrer', ref_key, 1, 0, 0);
    end if;
    if country ~ '^[A-Z]{2}$' then
      perform public.page_stats_bump(page, today, 'country', country, 1, 0, 0);
    end if;
    if device in ('mobile', 'tablet', 'desktop') then
      perform public.page_stats_bump(page, today, 'device', device, 1, 0, 0);
    end if;
  else
    perform public.page_stats_bump(page, today, 'page', '', 0, 0, 1);
    perform public.page_stats_bump(page, today, 'block', block, 0, 0, 1);
  end if;
  return 'counted';
end;
$$;
revoke execute on function public.page_stats_record(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.page_stats_record(text, text, text, text, text, text, text) to service_role;

/** Forgets every visitor hash and salt of days that are over (Berlin). The counts stay. */
create function public.page_stats_purge() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  removed integer;
begin
  delete from public.page_stats_visitors where day < public.berlin_today();
  get diagnostics removed = row_count;
  delete from public.page_stats_salts where day < public.berlin_today();
  return removed;
end;
$$;
revoke execute on function public.page_stats_purge() from public, anon, authenticated;
grant execute on function public.page_stats_purge() to service_role;

select cron.schedule('linkyo-purge-page-stats', '5 * * * *', 'select public.page_stats_purge()');

/**
 * The signed-in owner's numbers for the Berlin days from_day … to_day (at most a year):
 * { from, to, since, days: [{ day, views, visitors, clicks }] (days with counts only, oldest first),
 *   previous: { views, visitors, clicks } (the same number of days just before), blocks: [{ key,
 *   clicks }], referrers, countries, devices: [{ key, views }] (largest first) }. `since` is the first
 * day anything was counted for the page (null: nothing yet), so the app never shows days before it as
 * zeros. Runs as the caller: row-level security keeps it to their own page.
 */
create function public.my_page_stats(from_day date, to_day date) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  me uuid := auth.uid();
  span integer := to_day - from_day + 1;
begin
  if me is null then
    raise exception 'linkyo:forbidden' using errcode = '42501';
  end if;
  if from_day is null or to_day is null or span < 1 or span > 366 then
    raise exception 'linkyo:invalid' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'from', from_day,
    'to', to_day,
    'since', (select min(s.day) from public.page_stats s where s.profile_id = me and s.dimension = 'page'),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', s.day, 'views', s.views, 'visitors', s.visitors, 'clicks', s.clicks) order by s.day)
      from public.page_stats s
      where s.profile_id = me and s.dimension = 'page' and s.day between from_day and to_day
    ), '[]'::jsonb),
    'previous', (
      select jsonb_build_object('views', coalesce(sum(s.views), 0), 'visitors', coalesce(sum(s.visitors), 0), 'clicks', coalesce(sum(s.clicks), 0))
      from public.page_stats s
      where s.profile_id = me and s.dimension = 'page' and s.day between from_day - span and from_day - 1
    ),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('key', t.key, 'clicks', t.clicks) order by t.clicks desc, t.key)
      from (
        select s.key, sum(s.clicks)::integer as clicks from public.page_stats s
        where s.profile_id = me and s.dimension = 'block' and s.day between from_day and to_day
        group by s.key
      ) t
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object('key', t.key, 'views', t.views) order by t.views desc, t.key)
      from (
        select s.key, sum(s.views)::integer as views from public.page_stats s
        where s.profile_id = me and s.dimension = 'referrer' and s.day between from_day and to_day
        group by s.key
      ) t
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('key', t.key, 'views', t.views) order by t.views desc, t.key)
      from (
        select s.key, sum(s.views)::integer as views from public.page_stats s
        where s.profile_id = me and s.dimension = 'country' and s.day between from_day and to_day
        group by s.key
      ) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('key', t.key, 'views', t.views) order by t.views desc, t.key)
      from (
        select s.key, sum(s.views)::integer as views from public.page_stats s
        where s.profile_id = me and s.dimension = 'device' and s.day between from_day and to_day
        group by s.key
      ) t
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.my_page_stats(date, date) from public, anon;
grant execute on function public.my_page_stats(date, date) to authenticated;

/**
 * Totals for the team console (`analytics.view`): the last `days` Berlin days including today (1–366):
 * { from, to, since, days: [{ day, views, visitors, clicks }] (all pages summed, days with counts only),
 *   pages: [{ id, views, clicks }] (per account, accounts with counts only) }. No visitor hash, no
 * referrer, country or device per page: totals only. `since` is the first day anything was counted
 * anywhere (null: nothing yet, so the console keeps saying "not measured").
 */
create function public.admin_page_stats(days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  to_day date := public.berlin_today();
  from_day date;
begin
  perform public.require_permission('analytics.view');
  if days is null or days < 1 or days > 366 then
    raise exception 'linkyo:invalid' using errcode = '22023';
  end if;
  from_day := to_day - days + 1;
  return jsonb_build_object(
    'from', from_day,
    'to', to_day,
    'since', (select min(s.day) from public.page_stats s where s.dimension = 'page'),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', t.day, 'views', t.views, 'visitors', t.visitors, 'clicks', t.clicks) order by t.day)
      from (
        select s.day, sum(s.views)::integer as views, sum(s.visitors)::integer as visitors, sum(s.clicks)::integer as clicks
        from public.page_stats s
        where s.dimension = 'page' and s.day between from_day and to_day
        group by s.day
      ) t
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.profile_id, 'views', t.views, 'clicks', t.clicks) order by t.views desc, t.profile_id)
      from (
        select s.profile_id, sum(s.views)::integer as views, sum(s.clicks)::integer as clicks
        from public.page_stats s
        where s.dimension = 'page' and s.day between from_day and to_day
        group by s.profile_id
      ) t
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function public.admin_page_stats(integer) from public, anon;
grant execute on function public.admin_page_stats(integer) to authenticated;
