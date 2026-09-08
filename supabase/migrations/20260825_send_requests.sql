-- Operational send-request rail. This records user intent without pretending an external bank/blockchain rail executed.
create table if not exists public.send_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('nex','fiat','crypto')),
  amount numeric(24,10) not null check (amount > 0),
  currency text not null,
  destination text not null,
  network text,
  status text not null default 'pending' check (status in ('pending','processing','completed','rejected','cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  admin_note text
);
alter table public.send_requests enable row level security;
drop policy if exists send_requests_owner_select on public.send_requests;
create policy send_requests_owner_select on public.send_requests for select using (auth.uid() = user_id);
drop policy if exists send_requests_owner_insert on public.send_requests;
create policy send_requests_owner_insert on public.send_requests for insert with check (auth.uid() = user_id);
