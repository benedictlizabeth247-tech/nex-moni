-- Operational service request rails for services that do not yet have a live provider integration.
-- These tables replace simulated success with authenticated, auditable admin-fulfilment requests.
create table if not exists public.airtime_purchase_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null, network text not null, amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','processing','fulfilled','rejected','cancelled')),
  admin_note text, fulfilled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.bill_payment_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, provider text not null, account_number text not null, package_id text, package_name text,
  amount numeric(14,2) not null check (amount > 0), status text not null default 'pending' check (status in ('pending','processing','fulfilled','rejected','cancelled')),
  admin_note text, fulfilled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.scan_payment_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  merchant_id text not null, merchant_name text not null, amount numeric(14,2) not null check (amount > 0), currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','processing','fulfilled','rejected','cancelled')),
  admin_note text, fulfilled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.airtime_purchase_requests enable row level security;
alter table public.bill_payment_requests enable row level security;
alter table public.scan_payment_requests enable row level security;

create policy "users can view own airtime requests" on public.airtime_purchase_requests for select using (auth.uid() = user_id);
create policy "users can create own airtime requests" on public.airtime_purchase_requests for insert with check (auth.uid() = user_id);
create policy "users can view own bill requests" on public.bill_payment_requests for select using (auth.uid() = user_id);
create policy "users can create own bill requests" on public.bill_payment_requests for insert with check (auth.uid() = user_id);
create policy "users can view own scan requests" on public.scan_payment_requests for select using (auth.uid() = user_id);
create policy "users can create own scan requests" on public.scan_payment_requests for insert with check (auth.uid() = user_id);

create index if not exists airtime_requests_status_idx on public.airtime_purchase_requests(status, created_at desc);
create index if not exists bill_requests_status_idx on public.bill_payment_requests(status, created_at desc);
create index if not exists scan_requests_status_idx on public.scan_payment_requests(status, created_at desc);
