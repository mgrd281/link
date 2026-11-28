-- Notice and action (Stage 4, WP4.1: A-04, A-17; docs/DECISIONS/0092-notice-and-action.md). Visitors
-- report a page or one of its blocks through the public form at /melden (DSA Art. 16); the team decides
-- in the console (hide one block, take the page offline, suspend the account, or dismiss) with a written
-- reason and a ground, which is the statement of reasons the creator gets (Art. 17). Additive: two new
-- tables, one new permission, new functions; public_page() and admin_set_status() are replaced.
-- Tests: supabase/tests/reports.test.sql (and access.test.sql's role counts).
--
-- Who may do what:
-- - Reports are written only by `submit_report()`, which only the server may call (the public form's
--   route, behind its rate limit). Nobody reads or writes the tables directly but the moderation team
--   (`reports.manage`: owners and admins), who read through functions too.
-- - Every decision writes the activity log; the reason itself stays in moderation_decisions (the log is
--   open to editors and viewers, the reason may quote the report).
-- - A suspension now always has a reason: admin_set_status() only lets accounts back in.
--
-- Rollback (in this order; nothing else depends on these objects):
--   select cron.unschedule('linkyo-purge-reports');
--   -- public_page() and admin_set_status() as in 20261123100400_review_fixes.sql and 20261119100200_team.sql;
--   drop function public.moderation_digest(), public.moderation_purge(), public.my_moderation(),
--     public.admin_moderation_counts(integer), public.admin_lift_moderation(uuid, text),
--     public.admin_moderate(uuid, text, text, text, text, uuid), public.admin_moderation_target(uuid),
--     public.admin_reports(text, integer), public.submit_report(text, text, text, boolean, text, text, text, text),
--     public.reports_accepting(), public.block_label(jsonb);
--   drop table public.moderation_decisions, public.reports;
--   delete from public.role_permissions where permission = 'reports.manage';

-- ── Who handles reports ─────────────────────────────────────────────────────────────────────
-- Mirrors ROLE_PERMISSIONS in apps/web/src/features/admin/types.ts (customers.test.ts compares them).
insert into public.role_permissions (role, permission) values
  ('owner', 'reports.manage'), ('admin', 'reports.manage')
on conflict do nothing;

-- ── Reports ─────────────────────────────────────────────────────────────────────────────────
-- Categories, lengths and the 180 days mirror apps/web/src/features/moderation/types.ts
-- (types.test.ts reads this file and compares).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  -- The page as the reporter named it (its address), and the account that had it then. Null: no
  -- such page; set null when the account is deleted (the report stays, for the yearly count).
  page text not null constraint page_format check (page ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  profile_id uuid references public.profiles (id) on delete set null,
  url text constraint url_format check (url is null or (char_length(url) <= 500 and url ~ '^https?://')),
  category text not null constraint category_known check (category in (
    'hate', 'violence', 'minors', 'sexual', 'fraud', 'rights', 'privacy', 'impersonation', 'other'
  )),
  -- Why the reporter thinks it is illegal or against the terms. Null only once purged.
  explanation text constraint explanation_length check (explanation is null or char_length(explanation) between 20 and 4000),
  reporter_name text constraint reporter_name_length check (reporter_name is null or char_length(reporter_name) between 2 and 120),
  reporter_email text constraint reporter_email_format check (
    reporter_email is null or (char_length(reporter_email) <= 254 and reporter_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
  ),
  locale text not null default 'de' constraint locale_known check (locale in ('de', 'en', 'ar')),
  -- The reporter confirmed that the notice is accurate and complete in good faith (Art. 16(2)(d)).
  good_faith boolean not null constraint good_faith_given check (good_faith),
  status text not null default 'open' constraint status_known check (status in ('open', 'decided')),
  decided_at timestamptz,
  -- 180 days after the decision the reporter's name, address, words and link are removed.
  purged_at timestamptz,
  constraint decided_has_time check ((status = 'decided') = (decided_at is not null)),
  constraint words_until_purged check (purged_at is not null or explanation is not null)
);
create index reports_open on public.reports (received_at) where status = 'open';
create index reports_profile on public.reports (profile_id);
create index reports_decided on public.reports (decided_at) where status = 'decided';
alter table public.reports enable row level security;
create policy "moderation reads reports" on public.reports
  for select to authenticated using (public.has_permission('reports.manage'));
revoke all on public.reports from anon;
revoke insert, update, delete on public.reports from authenticated;

-- ── Decisions (the statement of reasons, and what is in force) ──────────────────────────────
create table public.moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  decided_at timestamptz not null default now(),
  report_id uuid references public.reports (id) on delete set null,
  -- The account it restricts (null for a dismissal of a report about no account, and once deleted).
  profile_id uuid references public.profiles (id) on delete set null,
  -- The address at the time (the log and the yearly count keep it readable after a rename).
  username text not null default '',
  action text not null constraint action_known check (action in ('hide_block', 'unpublish', 'suspend', 'dismiss')),
  block_id text constraint block_id_short check (block_id is null or char_length(block_id) <= 120),
  block_label text,
  -- Art. 17(3)(d)/(e): the content is illegal, or it breaks the terms (AGB). None for a dismissal.
  ground text constraint ground_known check (ground is null or ground in ('illegal', 'terms')),
  -- The facts and circumstances the decision rests on, as the creator reads them.
  reason text not null constraint reason_length check (char_length(reason) between 10 and 2000),
  decided_by uuid references auth.users (id) on delete set null,
  lifted_at timestamptz,
  lifted_by uuid references auth.users (id) on delete set null,
  lift_reason text constraint lift_reason_length check (lift_reason is null or char_length(lift_reason) <= 2000),
  constraint block_named check ((action = 'hide_block') = (block_id is not null)),
  constraint ground_for_restrictions check ((action = 'dismiss') = (ground is null)),
  constraint dismissal_not_lifted check (action <> 'dismiss' or lifted_at is null)
);
-- One restriction of a kind in force per account (and per block).
create unique index moderation_in_force on public.moderation_decisions (profile_id, action, coalesce(block_id, ''))
  where lifted_at is null and action <> 'dismiss';
create index moderation_report on public.moderation_decisions (report_id);
create index moderation_decided on public.moderation_decisions (decided_at);
alter table public.moderation_decisions enable row level security;
create policy "moderation reads decisions" on public.moderation_decisions
  for select to authenticated using (public.has_permission('reports.manage'));
revoke all on public.moderation_decisions from anon;
revoke insert, update, delete on public.moderation_decisions from authenticated;

-- ── Helpers ─────────────────────────────────────────────────────────────────────────────────
/** A block's name for people: its title, else the start of its text, else its type. */
create function public.block_label(block jsonb) returns text
language sql immutable set search_path = '' as $$
  select coalesce(
    nullif(btrim(block ->> 'title'), ''),
    nullif(left(btrim(block ->> 'text'), 60), ''),
    nullif(block ->> 'type', ''),
    'block'
  );
$$;
revoke execute on function public.block_label(jsonb) from public, anon, authenticated;

/** The form asks this first: true once this migration is in (a database without it has no function). */
create function public.reports_accepting() returns boolean
language sql stable set search_path = '' as $$
  select true;
$$;
grant execute on function public.reports_accepting() to anon, authenticated, service_role;

-- ── What visitors may see ───────────────────────────────────────────────────────────────────
/**
 * As in 20261123100400_review_fixes.sql, and now also without what the team restricted: a page taken
 * offline (unpublish) is not found, and a hidden block is left out like a switched-off one. Project
 * pages, the documents and the link preview read this too, so a hidden project block takes its page
 * with it.
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
        and not exists (
          select 1 from public.moderation_decisions d
          where d.profile_id = s.profile_id and d.action = 'hide_block' and d.lifted_at is null
            and d.block_id = e.block ->> 'id'
        )
    ), '[]'::jsonb)),
    'theme', s.theme,
    'legal', case when public.legal_is_complete(s.legal) then s.legal else '{}'::jsonb end,
    'updatedAt', s.updated_at
  )
  from public.profiles p
  join public.sites s on s.profile_id = p.id
  join auth.users u on u.id = p.id
  where p.username = lower(trim(handle))::extensions.citext
    and p.status = 'active' and s.onboarded and u.email_confirmed_at is not null
    and not exists (
      select 1 from public.moderation_decisions d
      where d.profile_id = p.id and d.action = 'unpublish' and d.lifted_at is null
    );
$$;
grant execute on function public.public_page(text) to anon, authenticated, service_role;

-- ── Receiving a report (the server only) ────────────────────────────────────────────────────
/**
 * Stores one report from the public form and answers {id, receivedAt, duplicate}. Called by our server
 * route only (service role), after its per-address limit: the publishable key cannot reach it, so the
 * limit cannot be gone around. Name and e-mail are required except for reports about the abuse of
 * minors, which may be anonymous (Art. 16(2)(c)). The same address reporting the same page for the
 * same reason again within a day gets the open report back (`duplicate`), not a second one.
 * Refusals: 'linkyo:invalid' with the field in the hint.
 */
create function public.submit_report(
  page text,
  category text,
  explanation text,
  good_faith boolean,
  url text default null,
  reporter_name text default null,
  reporter_email text default null,
  locale text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  handle text := lower(btrim(coalesce(submit_report.page, '')));
  words text := btrim(coalesce(submit_report.explanation, ''));
  who text := nullif(btrim(coalesce(submit_report.reporter_name, '')), '');
  mail text := nullif(lower(btrim(coalesce(submit_report.reporter_email, ''))), '');
  address text := nullif(btrim(coalesce(submit_report.url, '')), '');
  lang text := case when submit_report.locale in ('de', 'en', 'ar') then submit_report.locale else 'de' end;
  account uuid;
  earlier record;
  made record;
begin
  if handle !~ '^[a-z0-9][a-z0-9-]{0,59}$' then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'page';
  end if;
  if coalesce(submit_report.category, '') not in ('hate', 'violence', 'minors', 'sexual', 'fraud', 'rights', 'privacy', 'impersonation', 'other') then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'category';
  end if;
  if char_length(words) not between 20 and 4000 then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'explanation';
  end if;
  if address is not null and (char_length(address) > 500 or address !~ '^https?://') then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'url';
  end if;
  if (who is null and submit_report.category <> 'minors') or char_length(coalesce(who, 'ok')) not between 2 and 120 then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'name';
  end if;
  if (mail is null and submit_report.category <> 'minors')
     or (mail is not null and (char_length(mail) > 254 or mail !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')) then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'email';
  end if;
  if submit_report.good_faith is not true then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'goodFaith';
  end if;

  if mail is not null then
    select r.id, r.received_at into earlier from public.reports r
    where r.status = 'open' and r.page = handle and r.category = submit_report.category
      and r.reporter_email = mail and r.received_at > now() - interval '1 day'
    order by r.received_at desc limit 1;
    if earlier.id is not null then
      return jsonb_build_object('id', earlier.id, 'receivedAt', earlier.received_at, 'duplicate', true);
    end if;
  end if;

  select p.id into account from public.profiles p where p.username = handle::extensions.citext;
  insert into public.reports (page, profile_id, url, category, explanation, reporter_name, reporter_email, locale, good_faith)
  values (handle, account, address, submit_report.category, words, who, mail, lang, true)
  returning id, received_at into made;
  return jsonb_build_object('id', made.id, 'receivedAt', made.received_at, 'duplicate', false);
end;
$$;
revoke execute on function public.submit_report(text, text, text, boolean, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_report(text, text, text, boolean, text, text, text, text) to service_role;

-- ── The team's reads ────────────────────────────────────────────────────────────────────────
/**
 * The queue: 'open' reports oldest first (the next one due on top), or 'decided' ones newest first,
 * each with the reported account as it is now and the decision taken on it.
 */
create function public.admin_reports(state text default 'open', max_rows integer default 200) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_permission('reports.manage');
  if coalesce(state, '') not in ('open', 'decided') then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'state';
  end if;
  return coalesce((
    select jsonb_agg(item order by ord)
    from (
      select
        row_number() over (order by
          case when admin_reports.state = 'open' then r.received_at end asc,
          case when admin_reports.state = 'decided' then r.decided_at end desc, r.id) as ord,
        jsonb_build_object(
          'id', r.id, 'receivedAt', r.received_at, 'page', r.page, 'url', r.url, 'category', r.category,
          'explanation', r.explanation, 'reporterName', r.reporter_name, 'reporterEmail', r.reporter_email,
          'locale', r.locale, 'state', r.status, 'decidedAt', r.decided_at, 'purged', r.purged_at is not null,
          'account', case when p.id is null then null else jsonb_build_object(
            'id', p.id, 'username', p.username::text, 'status', p.status::text,
            'offline', exists (select 1 from public.moderation_decisions o where o.profile_id = p.id and o.action = 'unpublish' and o.lifted_at is null)
          ) end,
          'decision', (
            select jsonb_build_object(
              'id', d.id, 'action', d.action, 'ground', d.ground, 'reason', d.reason, 'blockLabel', d.block_label,
              'at', d.decided_at, 'by', coalesce((select u.email from auth.users u where u.id = d.decided_by), ''),
              'liftedAt', d.lifted_at
            )
            from public.moderation_decisions d where d.report_id = r.id order by d.decided_at desc limit 1
          )
        ) as item
      from public.reports r
      left join public.profiles p on p.id = r.profile_id
      where r.status = admin_reports.state
      order by
        case when admin_reports.state = 'open' then r.received_at end asc,
        case when admin_reports.state = 'decided' then r.decided_at end desc, r.id
      limit least(greatest(coalesce(max_rows, 200), 1), 500)
    ) listed
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.admin_reports(text, integer) to authenticated;

/**
 * What the team can restrict on one account: its address and status, its page's blocks (as stored,
 * with the owner's own switch and whether the team hid it) and every restriction in force.
 */
create function public.admin_moderation_target(customer uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  answer jsonb;
begin
  perform public.require_permission('reports.manage');
  select jsonb_build_object(
    'id', p.id, 'username', p.username::text, 'status', p.status::text, 'locale', p.locale,
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.block ->> 'id', 'type', coalesce(e.block ->> 'type', ''), 'label', public.block_label(e.block),
        'visible', coalesce(e.block ->> 'visible', 'true') <> 'false',
        'hidden', exists (
          select 1 from public.moderation_decisions d
          where d.profile_id = p.id and d.action = 'hide_block' and d.lifted_at is null and d.block_id = e.block ->> 'id'
        )
      ) order by e.position)
      from public.sites s,
        jsonb_array_elements(case when jsonb_typeof(s.page -> 'blocks') = 'array' then s.page -> 'blocks' else '[]'::jsonb end)
          with ordinality as e (block, position)
      where s.profile_id = p.id and jsonb_typeof(e.block) = 'object' and coalesce(e.block ->> 'id', '') <> ''
    ), '[]'::jsonb),
    'inForce', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'action', d.action, 'blockId', d.block_id, 'blockLabel', d.block_label, 'ground', d.ground,
        'reason', d.reason, 'at', d.decided_at, 'report', d.report_id
      ) order by d.decided_at desc)
      from public.moderation_decisions d
      where d.profile_id = p.id and d.lifted_at is null and d.action <> 'dismiss'
    ), '[]'::jsonb)
  ) into answer
  from public.profiles p where p.id = customer;
  if answer is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  return answer;
end;
$$;
grant execute on function public.admin_moderation_target(uuid) to authenticated;

-- ── The team's decisions ────────────────────────────────────────────────────────────────────
/**
 * One decision: hide one block, take the page offline, suspend the account (signs it out everywhere),
 * or dismiss a report. Every restriction needs a reason (10 to 2000 characters, what the creator reads)
 * and a ground ('illegal' or 'terms'); a dismissal needs its report and a reason for the reporter. With
 * a report, the report is decided by it (it must be open and about this account). Writes the activity
 * log (without the reason) and answers what the server needs for the e-mails and the page cache:
 * {decision, customer, username, locale, blockLabel, decidedAt, report: {id, email, name, locale,
 * receivedAt, page, category} | null}. The team never restricts its own account.
 */
create function public.admin_moderate(
  customer uuid,
  decision text,
  why text,
  legal_ground text default null,
  target_block text default null,
  for_report uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text := btrim(coalesce(why, ''));
  filed public.reports%rowtype;
  account public.profiles%rowtype;
  label text;
  made uuid;
  stamp timestamptz := now();
  subject uuid;
  name_then text;
begin
  perform public.require_permission('reports.manage');
  if coalesce(decision, '') not in ('hide_block', 'unpublish', 'suspend', 'dismiss') then
    raise exception 'linkyo:invalidAction' using errcode = 'P0001';
  end if;
  if decision = 'suspend' then
    perform public.require_permission('customers.manage');
  end if;
  if char_length(clean) not between 10 and 2000 then
    raise exception 'linkyo:reasonRequired' using errcode = 'P0001';
  end if;
  if decision <> 'dismiss' and coalesce(legal_ground, '') not in ('illegal', 'terms') then
    raise exception 'linkyo:groundRequired' using errcode = 'P0001';
  end if;

  if for_report is not null then
    select * into filed from public.reports r where r.id = for_report for update;
    if filed.id is null then
      raise exception 'linkyo:notFound' using errcode = 'P0001';
    end if;
    if filed.status <> 'open' then
      raise exception 'linkyo:alreadyDecided' using errcode = 'P0001';
    end if;
    if decision <> 'dismiss' and filed.profile_id is not null and filed.profile_id is distinct from customer then
      raise exception 'linkyo:mismatch' using errcode = 'P0001';
    end if;
  elsif decision = 'dismiss' then
    raise exception 'linkyo:reportRequired' using errcode = 'P0001';
  end if;

  if decision <> 'dismiss' then
    select * into account from public.profiles p where p.id = customer for update;
    if account.id is null then
      raise exception 'linkyo:notFound' using errcode = 'P0001';
    end if;
    if customer = me then
      raise exception 'linkyo:notYourself' using errcode = 'P0001';
    end if;
  end if;

  if decision = 'hide_block' then
    select public.block_label(e.block) into label
    from public.sites s,
      jsonb_array_elements(case when jsonb_typeof(s.page -> 'blocks') = 'array' then s.page -> 'blocks' else '[]'::jsonb end) e (block)
    where s.profile_id = customer and jsonb_typeof(e.block) = 'object' and e.block ->> 'id' = target_block
    limit 1;
    if label is null then
      raise exception 'linkyo:blockNotFound' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.moderation_decisions d where d.profile_id = customer and d.action = 'hide_block' and d.lifted_at is null and d.block_id = target_block) then
      raise exception 'linkyo:alreadyDone' using errcode = 'P0001';
    end if;
  elsif decision = 'unpublish' then
    if exists (select 1 from public.moderation_decisions d where d.profile_id = customer and d.action = 'unpublish' and d.lifted_at is null) then
      raise exception 'linkyo:alreadyDone' using errcode = 'P0001';
    end if;
  elsif decision = 'suspend' then
    if account.status = 'suspended' then
      raise exception 'linkyo:alreadyDone' using errcode = 'P0001';
    end if;
  end if;

  subject := case when decision = 'dismiss' then filed.profile_id else customer end;
  name_then := coalesce(public.customer_label(subject), filed.page, '');
  insert into public.moderation_decisions (decided_at, report_id, profile_id, username, action, block_id, block_label, ground, reason, decided_by)
  values (stamp, for_report, subject, name_then, decision, case when decision = 'hide_block' then target_block end,
    label, case when decision <> 'dismiss' then legal_ground end, clean, me)
  returning id into made;

  if decision = 'suspend' then
    update public.profiles set status = 'suspended' where id = customer;
    delete from auth.sessions where user_id = customer;
  end if;
  if for_report is not null then
    update public.reports set status = 'decided', decided_at = stamp where id = for_report;
  end if;

  perform public.audit(
    case decision when 'hide_block' then 'moderation.hide' when 'unpublish' then 'moderation.unpublish'
      when 'suspend' then 'customer.suspend' else 'report.dismiss' end,
    subject, name_then,
    jsonb_strip_nulls(jsonb_build_object('decision', made, 'report', for_report, 'ground', legal_ground, 'block', label))
  );

  return jsonb_build_object(
    'decision', made, 'customer', subject, 'username', name_then,
    'locale', coalesce(account.locale, 'de'), 'blockLabel', label, 'decidedAt', stamp,
    'report', case when filed.id is null then null else jsonb_build_object(
      'id', filed.id, 'email', filed.reporter_email, 'name', filed.reporter_name, 'locale', filed.locale,
      'receivedAt', filed.received_at, 'page', filed.page, 'category', filed.category
    ) end
  );
end;
$$;
grant execute on function public.admin_moderate(uuid, text, text, text, text, uuid) to authenticated;

/**
 * Lifts a restriction (after a complaint, or a mistake): the block shows again, the page is back, or the
 * account may sign in again. A reason is required (10 to 2000 characters); the activity log says it
 * happened. Answers {customer, username, action}.
 */
create function public.admin_lift_moderation(decision uuid, why text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_decision public.moderation_decisions%rowtype;
  clean text := btrim(coalesce(why, ''));
begin
  perform public.require_permission('reports.manage');
  if char_length(clean) not between 10 and 2000 then
    raise exception 'linkyo:reasonRequired' using errcode = 'P0001';
  end if;
  select * into found_decision from public.moderation_decisions d where d.id = decision for update;
  if found_decision.id is null or found_decision.profile_id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  if found_decision.action = 'dismiss' then
    raise exception 'linkyo:invalidAction' using errcode = 'P0001';
  end if;
  if found_decision.lifted_at is not null then
    raise exception 'linkyo:alreadyDone' using errcode = 'P0001';
  end if;
  if found_decision.action = 'suspend' then
    perform public.require_permission('customers.manage');
    update public.profiles set status = 'active' where id = found_decision.profile_id;
  end if;
  update public.moderation_decisions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = clean where id = decision;
  perform public.audit(
    case when found_decision.action = 'suspend' then 'customer.unsuspend' else 'moderation.lift' end,
    found_decision.profile_id, public.customer_label(found_decision.profile_id),
    jsonb_strip_nulls(jsonb_build_object('decision', decision, 'action', found_decision.action, 'block', found_decision.block_label))
  );
  return jsonb_build_object('customer', found_decision.profile_id, 'username', public.customer_label(found_decision.profile_id), 'action', found_decision.action);
end;
$$;
grant execute on function public.admin_lift_moderation(uuid, text) to authenticated;

/**
 * Suspends an account (signs it out everywhere) or lets it back in. From this migration on a
 * suspension needs a reason and a ground, so it goes through admin_moderate(…, 'suspend', …) (the
 * statement of reasons, Art. 17 DSA); here 'suspended' is refused. Letting an account back in also
 * lifts the suspension in force, so the record matches the account.
 */
create or replace function public.admin_set_status(customer uuid, next public.account_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_permission('customers.manage');
  if customer = auth.uid() then
    raise exception 'linkyo:notYourself' using errcode = 'P0001';
  end if;
  if next = 'suspended' then
    raise exception 'linkyo:reasonRequired' using errcode = 'P0001';
  end if;
  update public.profiles set status = next where id = customer;
  if not found then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  update public.moderation_decisions set lifted_at = now(), lifted_by = auth.uid(), lift_reason = 'unsuspended'
  where profile_id = customer and action = 'suspend' and lifted_at is null;
  perform public.audit('customer.unsuspend', customer, public.customer_label(customer));
end;
$$;
grant execute on function public.admin_set_status(uuid, public.account_status) to authenticated;

-- ── Counts for the year (the transparency figures) ──────────────────────────────────────────
/**
 * Reports received by category, decisions by action and ground, the median hours from a report to its
 * decision, and what is open now, for one calendar year (Europe/Berlin; default: this year).
 */
create function public.admin_moderation_counts(year integer default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  y integer := coalesce(admin_moderation_counts.year, date_part('year', now() at time zone 'Europe/Berlin')::integer);
  starts timestamptz;
  ends timestamptz;
begin
  perform public.require_permission('reports.manage');
  if y < 2000 or y > 2100 then
    raise exception 'linkyo:invalid' using errcode = 'P0001', hint = 'year';
  end if;
  starts := make_timestamptz(y, 1, 1, 0, 0, 0, 'Europe/Berlin');
  ends := make_timestamptz(y + 1, 1, 1, 0, 0, 0, 'Europe/Berlin');
  return jsonb_build_object(
    'year', y,
    'received', (select count(*)::int from public.reports r where r.received_at >= starts and r.received_at < ends),
    'byCategory', coalesce((
      select jsonb_object_agg(c.category, c.n) from (
        select r.category, count(*)::int as n from public.reports r
        where r.received_at >= starts and r.received_at < ends group by r.category
      ) c
    ), '{}'::jsonb),
    'byAction', coalesce((
      select jsonb_object_agg(a.action, a.n) from (
        select d.action, count(*)::int as n from public.moderation_decisions d
        where d.decided_at >= starts and d.decided_at < ends group by d.action
      ) a
    ), '{}'::jsonb),
    'byGround', coalesce((
      select jsonb_object_agg(g.ground, g.n) from (
        select d.ground, count(*)::int as n from public.moderation_decisions d
        where d.decided_at >= starts and d.decided_at < ends and d.ground is not null group by d.ground
      ) g
    ), '{}'::jsonb),
    'fromReports', (select count(*)::int from public.moderation_decisions d where d.decided_at >= starts and d.decided_at < ends and d.report_id is not null),
    'lifted', (select count(*)::int from public.moderation_decisions d where d.lifted_at >= starts and d.lifted_at < ends),
    'medianHours', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from r.decided_at - r.received_at)) / 3600)::numeric, 1)
      from public.reports r where r.status = 'decided' and r.decided_at >= starts and r.decided_at < ends
    ),
    'openNow', (select count(*)::int from public.reports r where r.status = 'open')
  );
end;
$$;
grant execute on function public.admin_moderation_counts(integer) to authenticated;

-- ── The creator's own view ──────────────────────────────────────────────────────────────────
/** The restrictions in force on the caller's own account, with the team's reason (for the dashboard). */
create function public.my_moderation() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'action', d.action, 'blockId', d.block_id, 'blockLabel', d.block_label, 'ground', d.ground,
    'reason', d.reason, 'decidedAt', d.decided_at
  ) order by d.decided_at desc), '[]'::jsonb)
  from public.moderation_decisions d
  where d.profile_id = auth.uid() and d.lifted_at is null and d.action <> 'dismiss';
$$;
revoke execute on function public.my_moderation() from public, anon;
grant execute on function public.my_moderation() to authenticated;

-- ── The server's jobs ───────────────────────────────────────────────────────────────────────
/**
 * The team digest's data (service role only): the open reports (id, category, receivedAt) and the
 * addresses of the team members who handle them (reports.manage).
 */
create function public.moderation_digest() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'open', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'category', r.category, 'receivedAt', r.received_at) order by r.received_at)
      from public.reports r where r.status = 'open'
    ), '[]'::jsonb),
    'recipients', coalesce((
      select jsonb_agg(distinct u.email)
      from public.team_members m
      join public.role_permissions rp on rp.role = m.role and rp.permission = 'reports.manage'
      join auth.users u on u.id = m.user_id
      where u.email is not null
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.moderation_digest() from public, anon, authenticated;
grant execute on function public.moderation_digest() to service_role;

/** 180 days after the decision: the reporter's name, address, words and link go (the count stays). */
create function public.moderation_purge() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  purged integer;
begin
  update public.reports
  set reporter_name = null, reporter_email = null, explanation = null, url = null, purged_at = now()
  where status = 'decided' and decided_at < now() - interval '180 days' and purged_at is null;
  get diagnostics purged = row_count;
  return purged;
end;
$$;
revoke execute on function public.moderation_purge() from public, anon, authenticated;
grant execute on function public.moderation_purge() to service_role;

select cron.schedule('linkyo-purge-reports', '53 3 * * *', 'select public.moderation_purge()');
