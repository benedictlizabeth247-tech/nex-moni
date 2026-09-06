-- Withdrawal intent ledger. This records a payout request without pretending
-- that an external bank/payment rail has executed it. Balance mutation belongs
-- to the server-side/RPC confirmation step of the configured payout rail.
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(24,10) not null check (amount > 0),
  currency text not null,
  destination_type text not null check (destination_type in ('bank','nex')),
  destination text not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','rejected','cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  admin_note text
);

alter table public.withdrawal_requests enable row level security;

drop policy if exists withdrawal_requests_owner_select on public.withdrawal_requests;
create policy withdrawal_requests_owner_select
  on public.withdrawal_requests for select
  using (auth.uid() = user_id);

drop policy if exists withdrawal_requests_owner_insert on public.withdrawal_requests;
create policy withdrawal_requests_owner_insert
  on public.withdrawal_requests for insert
  with check (auth.uid() = user_id);

create index if not exists withdrawal_requests_status_idx
  on public.withdrawal_requests(status, created_at desc);
