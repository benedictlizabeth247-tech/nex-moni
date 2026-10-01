create table if not exists public.merchant_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  payment_method text not null default 'bank_transfer',
  currency text not null default 'NGN',
  active boolean not null default true,
  rotation_order integer not null default 0,
  assignment_count integer not null default 0,
  last_assigned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bank_name, account_number)
);

alter table public.deposits add column if not exists merchant_account_id uuid references public.merchant_accounts(id);
alter table public.deposits add column if not exists payment_method text not null default 'bank_transfer';
alter table public.deposits add column if not exists updated_at timestamptz not null default now();
create index if not exists deposits_merchant_account_idx on public.deposits(merchant_account_id, created_at desc);
create index if not exists merchant_accounts_rotation_idx on public.merchant_accounts(active, payment_method, last_assigned_at, rotation_order);

insert into public.merchant_accounts (bank_name, account_number, account_name, rotation_order)
values
  ('UBA', '2295345512', 'Atuchukwu arinze benjamin', 10),
  ('Access Bank', '1841089139', 'Atuchukwu arinze benjamin', 20),
  ('Palmpay', '9024172741', 'Atuchukwu arinze benjamin', 30),
  ('Money Point', '9024172741', 'Atuchukwu arinze benjamin', 40)
on conflict (bank_name, account_number) do update set account_name = excluded.account_name, active = true, updated_at = now();

create or replace function public.allocate_merchant_account(p_payment_method text default 'bank_transfer')
returns public.merchant_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare selected public.merchant_accounts;
begin
  perform pg_advisory_xact_lock(hashtextextended('merchant-account-allocation:' || coalesce(p_payment_method, 'bank_transfer'), 0));
  select * into selected from public.merchant_accounts
  where active = true and payment_method = coalesce(nullif(trim(p_payment_method), ''), 'bank_transfer')
  order by last_assigned_at nulls first, rotation_order, created_at, id
  limit 1 for update;
  if selected.id is null then raise exception 'No active merchant account is available'; end if;
  update public.merchant_accounts set assignment_count = assignment_count + 1, last_assigned_at = now(), updated_at = now() where id = selected.id;
  selected.assignment_count := selected.assignment_count + 1;
  selected.last_assigned_at := now();
  return selected;
end;
$$;
revoke all on function public.allocate_merchant_account(text) from public, anon, authenticated;
grant execute on function public.allocate_merchant_account(text) to service_role;

alter table public.merchant_accounts enable row level security;
revoke all on public.merchant_accounts from anon, authenticated;
grant select on public.merchant_accounts to service_role;

comment on table public.merchant_accounts is 'Active merchant receiving accounts for server-side deposit allocation.';
comment on column public.deposits.merchant_account_id is 'Immutable merchant account shown for this deposit.';

