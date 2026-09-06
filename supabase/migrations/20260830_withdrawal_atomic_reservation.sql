-- nexMonie withdrawal foundation: atomic request creation + balance reservation.
-- This migration intentionally does NOT execute an external payout. It creates
-- the financial reservation that every later payout rail must consume or release.

alter table public.withdrawal_requests
  add column if not exists network text,
  add column if not exists autopilot boolean not null default false,
  add column if not exists idempotency_key text,
  add column if not exists reserved_amount numeric(24,10) not null default 0,
  add column if not exists reservation_status text not null default 'reserved',
  add column if not exists reserved_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists failure_reason text;

-- The original migration only allowed bank/nex and did not include failure.
-- The customer UI already exposes the other configured rails, so the database
-- contract must not reject those request types at insertion time.
alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_destination_type_check;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_destination_type_check
  check (destination_type in ('bank','nex','card_refund','mobile_money','crypto'));

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_status_check
  check (status in ('pending','processing','completed','rejected','cancelled','failed'));

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_reservation_status_check;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_reservation_status_check
  check (reservation_status in ('reserved','released','settled'));

create unique index if not exists withdrawal_requests_user_idempotency_idx
  on public.withdrawal_requests(user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists withdrawal_requests_reservation_idx
  on public.withdrawal_requests(reservation_status, status, created_at desc);

-- Atomically creates the withdrawal and removes the amount from spendable
-- available balance. The wallet row lock makes concurrent withdrawal attempts
-- serialize against the same wallet, preventing double-spend races.
create or replace function public.create_withdrawal_request(
  p_amount numeric,
  p_currency text,
  p_destination_type text,
  p_destination text,
  p_network text default null,
  p_autopilot boolean default false,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w public.wallets;
  existing public.withdrawal_requests;
  tx public.wallet_transactions;
  request_id uuid;
  reference text;
  currency_code text := upper(trim(coalesce(p_currency, '')));
  destination_value text := trim(coalesce(p_destination, ''));
  idempotency_value text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid withdrawal amount';
  end if;

  if currency_code = '' then
    raise exception 'Withdrawal currency is required';
  end if;

  if p_destination_type not in ('bank','nex','card_refund','mobile_money','crypto') then
    raise exception 'Unsupported withdrawal destination';
  end if;

  if destination_value = '' then
    raise exception 'Withdrawal destination is required';
  end if;

  if p_destination_type = 'crypto' and nullif(trim(coalesce(p_network,'')), '') is null then
    raise exception 'Crypto network is required';
  end if;

  -- A retry with the same idempotency key returns the original request instead
  -- of reserving the user's balance a second time.
  if idempotency_value is not null then
    select * into existing
    from public.withdrawal_requests
    where user_id = uid and idempotency_key = idempotency_value
    limit 1;

    if existing.id is not null then
      return jsonb_build_object(
        'status', 'already_created',
        'request_id', existing.id,
        'reference', 'WD-' || replace(existing.id::text, '-', ''),
        'withdrawal_status', existing.status,
        'reservation_status', existing.reservation_status,
        'amount', existing.amount,
        'currency', existing.currency
      );
    end if;
  end if;

  -- Create the wallet if the account has not received one yet, then lock it.
  insert into public.wallets(user_id, currency)
  values (uid, currency_code)
  on conflict (user_id) do nothing;

  select * into w
  from public.wallets
  where user_id = uid
  for update;

  if w.id is null then
    raise exception 'Wallet not found';
  end if;

  if lower(coalesce(w.status, 'active')) <> 'active' then
    raise exception 'Wallet is not available for withdrawal';
  end if;

  if upper(coalesce(w.currency, currency_code)) <> currency_code then
    raise exception 'Wallet currency is %, not %', w.currency, currency_code;
  end if;

  if coalesce(w.available, 0) < p_amount then
    raise exception 'Insufficient available wallet balance';
  end if;

  request_id := gen_random_uuid();
  reference := 'WD-' || replace(request_id::text, '-', '');

  -- The reservation is represented by removing the amount from AVAILABLE.
  -- It is not a final payout debit yet; the withdrawal request owns the
  -- reservation until a later settlement/release operation consumes it.
  update public.wallets
  set available = available - p_amount,
      updated_at = now()
  where id = w.id;

  insert into public.withdrawal_requests(
    id, user_id, amount, currency, destination_type, destination, network,
    status, autopilot, idempotency_key, reserved_amount, reservation_status,
    reserved_at, created_at
  ) values (
    request_id, uid, p_amount, currency_code, p_destination_type,
    destination_value, nullif(trim(coalesce(p_network,'')), ''),
    'pending', coalesce(p_autopilot, false), idempotency_value,
    p_amount, 'reserved', now(), now()
  );

  insert into public.wallet_transactions(
    user_id, wallet_id, amount, type, title, category, balance_field,
    status, reference_id, recipient, metadata, created_at
  ) values (
    uid, w.id, p_amount, 'withdrawal', 'Withdrawal reserved', 'Withdrawal',
    'available', 'pending', reference, destination_value,
    jsonb_build_object(
      'withdrawal_id', request_id,
      'reservation', true,
      'reservation_status', 'reserved',
      'destination_type', p_destination_type,
      'network', nullif(trim(coalesce(p_network,'')), ''),
      'autopilot', coalesce(p_autopilot, false),
      'currency', currency_code
    ), now()
  ) returning * into tx;

  return jsonb_build_object(
    'status', 'created',
    'request_id', request_id,
    'reference', reference,
    'withdrawal_status', 'pending',
    'reservation_status', 'reserved',
    'amount', p_amount,
    'currency', currency_code,
    'transaction_id', tx.id,
    'available_balance', w.available - p_amount
  );
end;
$$;

revoke all on function public.create_withdrawal_request(numeric,text,text,text,text,boolean,text)
  from public, anon;
grant execute on function public.create_withdrawal_request(numeric,text,text,text,text,boolean,text)
  to authenticated;

comment on function public.create_withdrawal_request(numeric,text,text,text,text,boolean,text)
is 'Creates an authenticated withdrawal request and atomically reserves spendable wallet balance. Does not execute an external payout.';
