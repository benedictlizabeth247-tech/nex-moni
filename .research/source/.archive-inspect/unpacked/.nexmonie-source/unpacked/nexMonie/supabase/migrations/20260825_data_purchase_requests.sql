create table if not exists public.data_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null,
  network text not null,
  plan_id text not null,
  plan_title text not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','processing','fulfilled','rejected','cancelled')),
  admin_note text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.data_purchase_requests enable row level security;
drop policy if exists "users can view own data requests" on public.data_purchase_requests;
create policy "users can view own data requests" on public.data_purchase_requests for select using (auth.uid() = user_id);
drop policy if exists "users can create own data requests" on public.data_purchase_requests;
create policy "users can create own data requests" on public.data_purchase_requests for insert with check (auth.uid() = user_id);
create index if not exists data_purchase_requests_status_idx on public.data_purchase_requests(status, created_at desc);
