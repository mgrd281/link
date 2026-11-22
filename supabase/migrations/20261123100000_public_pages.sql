-- Public pages without demo mode (v7): every first-level route is a reserved name, and visitors only
-- ever receive the blocks that are switched on and inside their schedule.
-- Tests: supabase/tests/public_pages.test.sql.

-- ── Reserved names ──────────────────────────────────────────────────────────────────────────
-- Every first-level route under [locale] (admin, app, design, directions, forgot, login, signup,
-- templates and v7's checkout, service, kuendigen, widerruf, widerrufsbelehrung, impressum,
-- datenschutz, agb), files at the root and words that could mislead. Mirrors RESERVED_USERNAMES in
-- @linkyo/blocks; apps/web/src/features/account/reserved.test.ts reads every insert below and compares.
insert into public.reserved_usernames (username) values
  ('account'), ('agb'), ('ai'), ('build'), ('checkout'), ('dashboard'), ('datenschutz'), ('kontakt'),
  ('kuendigen'), ('manifest'), ('media'), ('orders'), ('pro'), ('robots'), ('reset-password'), ('service'),
  ('services'), ('sitemap'), ('studio'), ('team'), ('templates'), ('widerruf'), ('widerrufsbelehrung')
on conflict do nothing;

-- ── Which blocks visitors see ───────────────────────────────────────────────────────────────
/**
 * Is this block switched on and inside its schedule at `at`? Mirrors isBlockActive() in
 * @linkyo/blocks. Anything that does not parse (a schedule that is not a date, `visible` that is
 * not a boolean) hides the block: a broken block never leaks. Stable, not immutable: reading a
 * date from text depends on the session's time zone when the text carries no offset.
 */
create function public.block_is_public(block jsonb, at timestamptz) returns boolean
language plpgsql stable set search_path = '' as $$
declare
  starts timestamptz;
  ends timestamptz;
begin
  if jsonb_typeof(block) <> 'object' then
    return false;
  end if;
  if not coalesce((block ->> 'visible')::boolean, true) then
    return false;
  end if;
  starts := (block #>> '{schedule,from}')::timestamptz;
  ends := (block #>> '{schedule,until}')::timestamptz;
  return (starts is null or starts <= at) and (ends is null or ends > at);
exception when others then
  return false;
end;
$$;
revoke execute on function public.block_is_public(jsonb, timestamptz) from public, anon, authenticated;

/**
 * What visitors may see of a page: active accounts with a confirmed email that finished the
 * welcome flow (unchanged), and of their page only the blocks that are public right now, in their
 * order. Same shape as before: {page, theme, legal, updatedAt}. Newsletter blocks are dropped by
 * the route, not here.
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
    'theme', s.theme, 'legal', s.legal, 'updatedAt', s.updated_at
  )
  from public.profiles p
  join public.sites s on s.profile_id = p.id
  join auth.users u on u.id = p.id
  where p.username = lower(trim(handle))::extensions.citext
    and p.status = 'active' and s.onboarded and u.email_confirmed_at is not null;
$$;
grant execute on function public.public_page(text) to anon, authenticated, service_role;
