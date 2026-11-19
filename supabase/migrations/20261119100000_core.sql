-- Linkyo core: accounts (profiles), their page (sites) and its history (ADR 0030).
-- Every table enables row-level security in this migration; tests: supabase/tests/*.test.sql.
--
-- Conventions
-- - Functions that bypass RLS are SECURITY DEFINER with an empty search_path and name every
--   object with its schema. Each one checks who is calling before it reads or writes.
-- - The browser only ever holds the publishable key; anything privileged runs in our server
--   routes with the secret key (service_role).

create extension if not exists citext with schema extensions;

-- ── Reserved usernames ──────────────────────────────────────────────────────────────────────
-- Routes, the brand and roles. Mirrors RESERVED_USERNAMES in @linkyo/blocks (a test compares them).
create table public.reserved_usernames (
  username extensions.citext primary key,
  reason text not null default 'route'
);
alter table public.reserved_usernames enable row level security;
-- No policies: only the functions below read it.

insert into public.reserved_usernames (username) values
  ('about'), ('admin'), ('api'), ('app'), ('ar'), ('auth'), ('billing'), ('blog'), ('de'), ('design'),
  ('directions'), ('en'), ('forgot'), ('help'), ('imprint'), ('impressum'), ('legal'), ('linkyo'),
  ('login'), ('logout'), ('official'), ('preview'), ('pricing'), ('privacy'), ('report'),
  ('security'), ('settings'), ('signup'), ('status'), ('support'), ('terms'), ('welcome'), ('www');

-- ── Profiles: one per account ───────────────────────────────────────────────────────────────
create type public.account_status as enum ('active', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    constraint username_format check (
      username::text = lower(username::text)
      and username::text ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
      and char_length(username::text) between 3 and 30
    ),
  locale text not null default 'de' constraint locale_known check (locale in ('de', 'en', 'ar')),
  status public.account_status not null default 'active',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);
comment on table public.profiles is 'One row per account. Email and password live in auth.users.';

alter table public.profiles enable row level security;

create policy "owners read their profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

-- Owners may change their language here; username, status and the badge change only through
-- the functions below (checked) or the team's functions (audited).
create policy "owners update their profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated, anon;
grant update (locale) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated, anon;

-- ── Helpers ─────────────────────────────────────────────────────────────────────────────────
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

/** Is this account allowed to use Linkyo right now (exists and not suspended)? */
create function public.is_active(account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = account and status = 'active');
$$;
revoke execute on function public.is_active(uuid) from public, anon;
grant execute on function public.is_active(uuid) to authenticated, service_role;

/**
 * 'ok' or why a username can't be used: 'invalidUsername', 'reservedUsername', 'usernameTaken'.
 * The caller's own current name counts as free. Usernames are public (they are page addresses).
 */
create function public.username_status(candidate text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  wanted text := lower(trim(candidate));
begin
  if wanted is null or char_length(wanted) not between 3 and 30 or wanted !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' then
    return 'invalidUsername';
  end if;
  if exists (select 1 from public.reserved_usernames where username = wanted::extensions.citext) then
    return 'reservedUsername';
  end if;
  if exists (
    select 1 from public.profiles
    where username = wanted::extensions.citext and id is distinct from auth.uid()
  ) then
    return 'usernameTaken';
  end if;
  return 'ok';
end;
$$;
grant execute on function public.username_status(text) to anon, authenticated, service_role;

/** Changes the caller's username after the same checks as sign-up. Returns 'ok' or the reason. */
create function public.change_username(candidate text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  verdict text;
begin
  if me is null or not public.is_active(me) then
    return 'unavailable';
  end if;
  verdict := public.username_status(candidate);
  if verdict <> 'ok' then
    return verdict;
  end if;
  update public.profiles set username = lower(trim(candidate)) where id = me;
  update public.sites set page = jsonb_set(page, '{profile,username}', to_jsonb(lower(trim(candidate))))
    where profile_id = me;
  return 'ok';
exception when unique_violation then
  return 'usernameTaken';
end;
$$;
revoke execute on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- ── New accounts ────────────────────────────────────────────────────────────────────────────
-- Sign-up sends { username, locale } as user metadata. An invalid, reserved or taken name makes
-- the whole sign-up fail, so there is never an account without a valid profile.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  lang text := coalesce(new.raw_user_meta_data ->> 'locale', 'de');
  verdict text;
begin
  if wanted = '' then
    -- Accounts made without a name (e.g. team members invited by the owner) get a neutral one.
    wanted := 'user-' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  if lang not in ('de', 'en', 'ar') then
    lang := 'de';
  end if;
  verdict := public.username_status(wanted);
  if verdict <> 'ok' then
    raise exception 'linkyo:%', verdict using errcode = 'P0001';
  end if;
  insert into public.profiles (id, username, locale) values (new.id, wanted, lang);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Sites: the page, its look and settings ──────────────────────────────────────────────────
-- One JSON document per account, exactly the `Site` type the app edits (blocks inside the page).
-- Splitting blocks into rows comes with realtime editing on iOS (Phase 2).
create table public.sites (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  kind text constraint kind_short check (char_length(kind) <= 40),
  onboarded boolean not null default false,
  theme jsonb not null,
  page jsonb not null,
  legal jsonb not null default '{}'::jsonb,
  prepared jsonb,
  updated_at timestamptz not null default now(),
  constraint documents_are_objects check (
    jsonb_typeof(page) = 'object' and jsonb_typeof(theme) = 'object' and jsonb_typeof(legal) = 'object'
  ),
  constraint site_size check (pg_column_size(page) + pg_column_size(theme) + pg_column_size(legal) < 1000000)
);

alter table public.sites enable row level security;

create policy "owners read their site" on public.sites
  for select to authenticated using (profile_id = (select auth.uid()));
create policy "active owners create their site" on public.sites
  for insert to authenticated with check (profile_id = (select auth.uid()) and public.is_active((select auth.uid())));
create policy "active owners edit their site" on public.sites
  for update to authenticated
  using (profile_id = (select auth.uid()) and public.is_active((select auth.uid())))
  with check (profile_id = (select auth.uid()));
revoke delete on public.sites from authenticated, anon;

-- The badge and the address on the page always come from the profile: nobody can write
-- "verified" into their own page, and the page shows the account's real username.
create function public.sites_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner public.profiles;
begin
  select * into owner from public.profiles where id = new.profile_id;
  if owner.id is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  new.page := jsonb_set(
    jsonb_set(new.page, '{profile,verified}', to_jsonb(owner.verified), true),
    '{profile,username}', to_jsonb(owner.username::text), true
  );
  new.updated_at := now();
  return new;
end;
$$;

create trigger sites_guard before insert or update on public.sites
  for each row execute function public.sites_guard();

-- ── History: earlier versions of the page (undo after mistakes, support) ────────────────────
create table public.site_versions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index site_versions_profile on public.site_versions (profile_id, created_at desc);

alter table public.site_versions enable row level security;
create policy "owners read their history" on public.site_versions
  for select to authenticated using (profile_id = (select auth.uid()));
revoke insert, update, delete on public.site_versions from authenticated, anon;

-- Autosave writes often; keep one version per ten minutes of editing, at most 30 per account.
create function public.sites_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.page is distinct from new.page or old.theme is distinct from new.theme then
    if not exists (
      select 1 from public.site_versions
      where profile_id = old.profile_id and created_at > now() - interval '10 minutes'
    ) then
      insert into public.site_versions (profile_id, snapshot)
        values (old.profile_id, jsonb_build_object('page', old.page, 'theme', old.theme, 'legal', old.legal));
      delete from public.site_versions
        where profile_id = old.profile_id
          and id not in (
            select id from public.site_versions where profile_id = old.profile_id
            order by created_at desc, id desc limit 30
          );
    end if;
  end if;
  return new;
end;
$$;

create trigger sites_history after update on public.sites
  for each row execute function public.sites_history();

-- ── Public pages ────────────────────────────────────────────────────────────────────────────
/**
 * What visitors may see of a page: active accounts with a confirmed email that finished the
 * welcome flow. (An address nobody confirmed never goes public under someone's name.)
 */
create function public.public_page(handle text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('page', s.page, 'theme', s.theme, 'legal', s.legal, 'updatedAt', s.updated_at)
  from public.profiles p
  join public.sites s on s.profile_id = p.id
  join auth.users u on u.id = p.id
  where p.username = lower(trim(handle))::extensions.citext
    and p.status = 'active' and s.onboarded and u.email_confirmed_at is not null;
$$;
grant execute on function public.public_page(text) to anon, authenticated, service_role;

-- ── Leaving ─────────────────────────────────────────────────────────────────────────────────
/** Deletes the caller's account and everything that belongs to it (cascades from auth.users). */
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'linkyo:notFound' using errcode = 'P0001';
  end if;
  delete from auth.users where id = me;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
