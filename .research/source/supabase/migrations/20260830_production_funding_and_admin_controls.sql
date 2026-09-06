-- nexMonie production funding + administration hardening
-- This migration preserves the existing UI and makes the existing funding/admin
-- rails real, atomic, idempotent, and auditable. Provider secrets remain server-only.

create table if not exists public.admin_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.admin_staff enable row level security;

insert into public.admin_staff (user_id, email)
select id, lower(email)
from auth.users
where lower(email) in (
  'www.atuchukwuarinze@gmail.com',
  'stevearinze594@gmail.com',
  'fxchristopher96@gmail.com'
)
on conflict (user_id) do update set email=excluded.email, active=true;

-- Existing snapshots may have the deposits table already. Add the columns
-- required by the current deposit service without replacing existing data.
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text,
  account_number text,
  account_name text,
  amount numeric(24,8) not null check (amount > 0),
  sender_bank text,
  reference text not null unique,
  screenshot_url text,
  status text not null default 'pending',
  expiry_time timestamptz,
  asset text,
  network text,
  tx_hash text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.deposits add column if not exists bank_name text;
alter table public.deposits add column if not exists account_number text;
alter table public.deposits add column if not exists account_name text;
alter table public.deposits add column if not exists sender_bank text;
alter table public.deposits add column if not exists screenshot_url text;
alter table public.deposits add column if not exists expiry_time timestamptz;
alter table public.deposits add column if not exists asset text;
alter table public.deposits add column if not exists network text;
alter table public.deposits add column if not exists tx_hash text;
alter table public.deposits add column if not exists confirmed_at timestamptz;
create index if not exists deposits_status_created_idx on public.deposits(status, created_at desc);
create index if not exists deposits_user_created_idx on public.deposits(user_id, created_at desc);
alter table public.deposits enable row level security;
drop policy if exists deposits_owner_select on public.deposits;
create policy deposits_owner_select on public.deposits for select using (auth.uid() = user_id);
drop policy if exists deposits_owner_insert on public.deposits;
create policy deposits_owner_insert on public.deposits for insert with check (auth.uid() = user_id);

-- Real administrator wallet adjustments. This is deliberately separate from
-- demo/test credit so production balances can never be confused with sandbox value.
create table if not exists public.admin_wallet_adjustments (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(24,8) not null check (amount <> 0),
  currency text not null,
  reason text not null,
  reference text not null unique,
  balance_before numeric(24,8) not null,
  balance_after numeric(24,8) not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_wallet_adjustments_user_idx on public.admin_wallet_adjustments(user_id, created_at desc);
create index if not exists admin_wallet_adjustments_actor_idx on public.admin_wallet_adjustments(actor_user_id, created_at desc);
alter table public.admin_wallet_adjustments enable row level security;

create or replace function public.admin_fund_wallet(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_reason text,
  p_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.wallets;
  tx public.wallet_transactions;
  actor_ok boolean;
  ref text;
  before_balance numeric;
  after_balance numeric;
  currency_code text := upper(trim(coalesce(p_currency, '')));
begin
  if p_actor_user_id is null or p_user_id is null then
    raise exception 'Actor and customer are required';
  end if;
  if not exists (
    select 1 from public.admin_staff s
    where s.user_id = p_actor_user_id and s.active = true
  ) then
    raise exception 'Administrator not authorized';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'Customer account not found';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1000000000 then
    raise exception 'Invalid wallet adjustment amount';
  end if;
  if currency_code not in ('NGN','USD') then
    raise exception 'Only NGN and USD wallet funding is supported';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'A reason is required';

  insert into public.wallets(user_id, currency)
  values (p_user_id, currency_code)
  on conflict (user_id) do nothing;

  select * into w from public.wallets where user_id = p_user_id for update;

  if upper(coalesce(w.currency, currency_code)) <> currency_code then
    raise exception 'Wallet currency is %, not %', w.currency, currency_code;
  end if;

  before_balance := coalesce(w.available, 0);
  if p_amount < 0 and before_balance < abs(p_amount) then
    raise exception 'Insufficient available wallet balance';
  end if;
  after_balance := before_balance + p_amount;

  update public.wallets
  set available = after_balance, updated_at = now()
  where user_id = p_user_id;

  ref := coalesce(nullif(trim(p_reference), ''), 'ADM-' || replace(gen_random_uuid()::text, '-', ''));

  insert into public.wallet_transactions(
    user_id, wallet_id, amount, type, title, category, balance_field,
    status, reference_id, recipient, metadata, created_at
  )
  values (
    p_user_id, w.id, abs(p_amount),
    case when p_amount > 0 then 'income' else 'expense' end,
    case when p_amount > 0 then 'Admin wallet funding' else 'Admin wallet debit' end,
    'Admin adjustment', 'available', 'completed', ref, null,
    jsonb_build_object(
      'admin_adjustment', true,
      'production', true,
      'actor_user_id', p_actor_user_id,
      'reason', trim(p_reason),
      'currency', currency_code,
      'signed_amount', p_amount
    ), now()
  )
  returning * into tx;

  insert into public.admin_wallet_adjustments(
    actor_user_id, user_id, amount, currency, reason, reference,
    balance_before, balance_after
  )
  values (
    p_actor_user_id, p_user_id, p_amount, currency_code, trim(p_reason), ref,
    before_balance, after_balance
  );

  return jsonb_build_object(
    'wallet_id', w.id,
    'user_id', p_user_id,
    'currency', currency_code,
    'amount', p_amount,
    'available', after_balance,
    'reference', ref,
    'transaction_id', tx.id,
    'status', 'completed'
  );
end;
$$;

revoke all on function public.admin_fund_wallet(uuid,uuid,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.admin_fund_wallet(uuid,uuid,numeric,text,text,text) to service_role;

-- Generalize the existing fiat credit RPC so Paystack and controlled manual
-- bank-transfer approval can use the same idempotent ledger mutation.
create or replace function public.credit_fiat_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_provider text default 'paystack'
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  existing public.exchange_ledger;
  tx public.wallet_transactions;
  w public.wallets;
  result jsonb;
  provider_code text := lower(trim(coalesce(p_provider,'paystack')));
begin
  if p_amount <= 0 then raise exception 'Invalid deposit amount'; end if;
  if trim(coalesce(p_reference,'')) = '' then raise exception 'Deposit reference required'; end if;

  select * into existing
  from public.exchange_ledger
  where reference = p_reference
  for update;

  if existing.id is not null then
    return jsonb_build_object('status','already_posted','ledger_id',existing.id);
  end if;

  insert into public.wallets(user_id) values(p_user_id)
  on conflict (user_id) do nothing;

  select * into w from public.wallets where user_id=p_user_id for update;

  update public.wallets
  set available = available + p_amount, updated_at = now()
  where user_id = p_user_id;

  insert into public.wallet_transactions(
    user_id, wallet_id, amount, type, title, category, balance_field,
    status, reference_id, recipient, metadata, created_at
  )
  values(
    p_user_id, w.id, p_amount, 'income', 'Fiat deposit', 'Deposit',
    'available', 'completed', p_reference, null,
    jsonb_build_object('provider',provider_code,'production',true), now()
  )
  returning * into tx;

  insert into public.exchange_ledger(
    user_id, reference, kind, asset, amount, metadata
  )
  values(
    p_user_id, p_reference, 'fiat_deposit', 'NGN', p_amount,
    jsonb_build_object('transaction_id',tx.id,'provider',provider_code)
  );

  result := jsonb_build_object(
    'status','posted',
    'transaction_id',tx.id,
    'amount',p_amount,
    'reference',p_reference
  );
  return result;
end;
$$;

revoke execute on function public.credit_fiat_deposit(uuid,numeric,text,text) from public, anon, authenticated;
grant execute on function public.credit_fiat_deposit(uuid,numeric,text,text) to service_role;

-- Preserve the original three-argument provider call used by existing code.
create or replace function public.credit_fiat_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_reference text
) returns jsonb
language sql
security definer
set search_path=public
as $$
  select public.credit_fiat_deposit(p_user_id,p_amount,p_reference,'paystack');
$$;
revoke execute on function public.credit_fiat_deposit(uuid,numeric,text) from public, anon, authenticated;
grant execute on function public.credit_fiat_deposit(uuid,numeric,text) to service_role;


create table if not exists public.admin_deposit_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  deposit_id uuid not null references public.deposits(id) on delete cascade,
  action text not null check (action in ('approve','reject')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists admin_deposit_actions_deposit_idx on public.admin_deposit_actions(deposit_id, created_at desc);
alter table public.admin_deposit_actions enable row level security;

create or replace function public.admin_review_deposit(
  p_actor_user_id uuid,
  p_deposit_id uuid,
  p_action text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  d public.deposits;
  credit jsonb;
begin
  if not exists (select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then
    raise exception 'Administrator not authorized';
  end if;
  if p_action not in ('approve','reject') then raise exception 'Invalid deposit action'; end if;

  select * into d from public.deposits where id=p_deposit_id for update;
  if d.id is null then raise exception 'Deposit not found'; end if;
  if d.status not in ('pending','processing') then
    return jsonb_build_object('status',d.status,'reference',d.reference);
  end if;

  if p_action='approve' then
    credit := public.credit_fiat_deposit(d.user_id,d.amount,d.reference,'manual_bank_transfer');
    update public.deposits
    set status='confirmed', confirmed_at=now()
    where id=d.id;
  else
    update public.deposits
    set status='failed'
    where id=d.id;
    credit := jsonb_build_object('status','rejected');
  end if;

  insert into public.admin_deposit_actions(actor_user_id,deposit_id,action,note)
  values(p_actor_user_id,d.id,p_action,nullif(trim(coalesce(p_note,'')), ''));

  return jsonb_build_object(
    'status', case when p_action='approve' then 'confirmed' else 'failed' end,
    'deposit_id', d.id,
    'reference', d.reference,
    'credit', credit
  );
end;
$$;

revoke all on function public.admin_review_deposit(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_review_deposit(uuid,uuid,text,text) to service_role;
