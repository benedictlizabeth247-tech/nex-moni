create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  title text not null,
  description text,
  organization text,
  type text not null,
  category text,
  reward_amount numeric,
  reward_currency text,
  deadline timestamptz,
  location text,
  remote boolean not null default false,
  skills text[] not null default '{}',
  source_url text not null,
  application_url text,
  status text not null default 'LIVE',
  published_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_name text,
  source_id text,
  organization_logo text,
  reward_text text,
  ecosystem text,
  chain text,
  is_verified boolean not null default true,
  is_featured boolean not null default false,
  submission_url text,
  metadata jsonb not null default '{}'::jsonb,
  content_hash text,
  constraint opportunities_source_external_id_key unique (source, external_id)
);

create table if not exists public.opportunity_source_health (
  source text primary key,
  status text not null default 'UNAVAILABLE',
  last_attempted_sync timestamptz,
  last_successful_sync timestamptz,
  records_fetched integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_expired integer not null default 0,
  error_message text,
  updated_at timestamptz not null default now()
);

alter table public.opportunities enable row level security;
alter table public.opportunity_source_health enable row level security;

drop policy if exists "public can read live opportunities" on public.opportunities;
create policy "public can read live opportunities" on public.opportunities for select to anon, authenticated using (status = 'LIVE' and (deadline is null or deadline > now()));
drop policy if exists "public can read source health" on public.opportunity_source_health;
create policy "public can read source health" on public.opportunity_source_health for select to anon, authenticated using (true);
grant select on public.opportunities, public.opportunity_source_health to anon, authenticated;
