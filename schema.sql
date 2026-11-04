-- TTPD BLOCKED BILLIE community hub schema
-- Run this entire file in Supabase SQL Editor for a fresh project.

create extension if not exists pgcrypto;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default 'false'::jsonb
);
insert into public.site_settings(key,value) values ('voting_open','false'::jsonb)
on conflict (key) do nothing;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.nominees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.ballots (
  id uuid primary key default gen_random_uuid(),
  browser_id uuid not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  ballot_id uuid not null references public.ballots(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  nominee_id uuid not null references public.nominees(id) on delete cascade,
  unique(ballot_id,category_id)
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  handle text,
  bio text,
  avatar_url text,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.award_editions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  year integer not null,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  unique(year,title)
);
create table if not exists public.winner_entries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.award_editions(id) on delete cascade,
  category_name text not null,
  nominee_name text not null
);

-- Public reads are controlled directly by RLS policies on the base tables.

-- The browser submits one selection per active category. Validate the complete ballot server-side.
create or replace function public.submit_community_ballot(p_browser_id uuid, p_choices jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare
  new_ballot_id uuid;
  expected_count integer;
  supplied_count integer;
  bad_count integer;
begin
  if p_browser_id is null or jsonb_typeof(p_choices) <> 'array' then
    raise exception 'Invalid ballot.';
  end if;
  if coalesce((select (value #>> '{}')::boolean from site_settings where key='voting_open'),false) is not true then
    raise exception 'Voting is closed.';
  end if;

  select count(*) into expected_count from categories where active=true;
  select count(*) into supplied_count from jsonb_array_elements(p_choices);
  if supplied_count <> expected_count or supplied_count = 0 then
    raise exception 'Select one nominee in every active category.';
  end if;

  select count(*) into bad_count
  from (
    select (x->>'category_id')::uuid as category_id,
           (x->>'nominee_id')::uuid as nominee_id
    from jsonb_array_elements(p_choices) x
  ) c
  left join categories cat on cat.id=c.category_id and cat.active=true
  left join nominees n on n.id=c.nominee_id and n.category_id=c.category_id
  where cat.id is null or n.id is null;
  if bad_count > 0 then raise exception 'One or more selections are invalid.'; end if;

  if (select count(distinct (x->>'category_id')::uuid) from jsonb_array_elements(p_choices) x) <> supplied_count then
    raise exception 'Duplicate category selection.';
  end if;

  insert into ballots(browser_id) values(p_browser_id) returning id into new_ballot_id;
  insert into votes(ballot_id,category_id,nominee_id)
  select new_ballot_id,(x->>'category_id')::uuid,(x->>'nominee_id')::uuid
  from jsonb_array_elements(p_choices) x;
end; $$;

-- Admin check uses a role claim set in Supabase Auth app_metadata (not user-editable metadata).
create or replace function public.is_site_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(auth.jwt()->'app_metadata'->>'role'='admin',false);
$$;

alter table site_settings enable row level security;
alter table categories enable row level security;
alter table nominees enable row level security;
alter table ballots enable row level security;
alter table votes enable row level security;
alter table members enable row level security;
alter table announcements enable row level security;
alter table award_editions enable row level security;
alter table winner_entries enable row level security;

-- Public read access to voting setup and visible community content.
create policy "public read settings" on site_settings for select using (true);
create policy "public read active categories" on categories for select using (active=true);
create policy "public read nominees" on nominees for select using (exists(select 1 from categories c where c.id=category_id and c.active=true));
create policy "public read visible members" on members for select using (visible=true);
create policy "public read published announcements" on announcements for select using (published=true);
create policy "public read published editions" on award_editions for select using (published=true);
create policy "public read winners of published editions" on winner_entries for select using (exists(select 1 from award_editions e where e.id=edition_id and e.published=true));

-- Admin-only writes and private access to ballots/votes.
create policy "admin manage settings" on site_settings for all using (is_site_admin()) with check (is_site_admin());
create policy "admin manage categories" on categories for all using (is_site_admin()) with check (is_site_admin());
create policy "admin manage nominees" on nominees for all using (is_site_admin()) with check (is_site_admin());
create policy "admin manage members" on members for all using (is_site_admin()) with check (is_site_admin());
create policy "admin manage announcements" on announcements for all using (is_site_admin()) with check (is_site_admin());
create policy "admin manage editions" on award_editions for all using (is_site_admin()) with check (is_site_admin());
create policy "admin manage winners" on winner_entries for all using (is_site_admin()) with check (is_site_admin());
create policy "admin read ballots" on ballots for select using (is_site_admin());
create policy "admin read votes" on votes for select using (is_site_admin());

grant usage on schema public to anon, authenticated;
grant select on site_settings,categories,nominees,members,announcements,award_editions,winner_entries to anon,authenticated;
grant insert,update,delete on site_settings,categories,nominees,members,announcements,award_editions,winner_entries to authenticated;
grant select on ballots,votes to authenticated;
grant execute on function submit_community_ballot(uuid,jsonb) to anon,authenticated;
grant execute on function is_site_admin() to anon,authenticated;

-- NOTE: client reads published_editions and nested winner_entries. If your Supabase
-- project does not expose nested view relationships, use the direct published tables
-- with the RLS policies above, or create a joined RPC. See README troubleshooting.
