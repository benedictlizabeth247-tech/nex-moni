create table if not exists public.opportunity_sources (
  source text primary key,
  name text not null,
  enabled boolean not null default true,
  api_status text not null default 'pending',
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_sync_at timestamptz,
  records_seen integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_closed integer not null default 0,
  error_message text,
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  source text not null references public.opportunity_sources(source),
  source_id text not null,
  source_url text not null,
  type text not null,
  title text not null,
  description text,
  organization_name text,
  organization_logo text,
  reward_amount numeric,
  reward_currency text,
  reward_text text,
  category text,
  skills text[] not null default '{}',
  ecosystem text,
  chain text,
  location text,
  remote boolean,
  published_at timestamptz,
  deadline timestamptz,
  status text not null default 'LIVE' check (status in ('LIVE','EXPIRED','CLOSED','CANCELLED','ARCHIVED','STALE')),
  application_url text,
  submission_url text,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  content_hash text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_id)
);

create index if not exists opportunities_live_idx on public.opportunities(status, deadline, updated_at desc);
create index if not exists opportunities_category_idx on public.opportunities(category, status);

create table if not exists public.opportunity_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null references public.opportunity_sources(source),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  records_seen integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_closed integer not null default 0,
  duplicates_removed integer not null default 0,
  error_message text
);

create table if not exists public.opportunity_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  source text not null,
  status text not null default 'VIEWED' check (status in ('VIEWED','STARTED','REDIRECTED','SUBMITTED','CONFIRMED','WITHDRAWN','UNKNOWN')),
  application_url text,
  external_reference text,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, opportunity_id)
);

insert into public.opportunity_sources(source,name) values
  ('superteam','Superteam Earn'),('web3career','Web3.career'),('gitcoin','Gitcoin'),('onlydust','OnlyDust'),('layer3','Layer3'),('dorahacks','DoraHacks'),('dework','Dework'),('github','GitHub')
on conflict (source) do nothing;

alter table public.opportunity_sources enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_sync_runs enable row level security;
alter table public.opportunity_applications enable row level security;

drop policy if exists opportunities_live_read on public.opportunities;
create policy opportunities_live_read on public.opportunities for select to authenticated using (status='LIVE' and (deadline is null or deadline > now()));
drop policy if exists opportunity_applications_own on public.opportunity_applications;
create policy opportunity_applications_own on public.opportunity_applications for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create or replace function public.close_expired_opportunities() returns integer language sql security invoker set search_path=public as $$
  update public.opportunities set status='EXPIRED', updated_at=now() where status='LIVE' and deadline is not null and deadline <= now();
  select count(*)::integer from public.opportunities where status='EXPIRED' and updated_at >= now() - interval '1 minute';
$$;
