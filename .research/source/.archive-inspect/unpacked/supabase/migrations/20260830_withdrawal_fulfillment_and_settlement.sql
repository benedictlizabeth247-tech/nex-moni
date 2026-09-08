-- nexMonie withdrawal phases 5 & 6
-- Internal/manual fulfillment only: no Paystack, Flutterwave, Monnify or other
-- payout API is required. Admin fulfillment is the external money-movement step.

create or replace function public.admin_settle_withdrawal(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wdr public.withdrawal_requests;
  wallet_row public.wallets;
  reference text;
begin
  if not exists (select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then
    raise exception 'Administrator not authorized';
  end if;

  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if wdr.status <> 'processing' or wdr.reservation_status <> 'reserved' then
    raise exception 'Only processing reserved withdrawals can be completed';
  end if;

  reference := 'WD-' || replace(wdr.id::text,'-','');

  -- The balance was already reserved when the request was created. Completion
  -- consumes that reservation; it does not subtract the wallet a second time.
  update public.wallet_transactions
  set status='completed',
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'withdrawal_settlement','completed',
        'settled_by',p_actor_user_id,
        'settled_at',now(),
        'settlement_note',nullif(trim(coalesce(p_note,'')),'')
      )
  where reference_id=reference and user_id=wdr.user_id and type='withdrawal';


  update public.withdrawal_requests
  set status='completed',
      reservation_status='settled',
      settled_at=now(),
      processed_at=now(),
      processed_by=p_actor_user_id,
      admin_note=coalesce(nullif(trim(coalesce(p_note,'')),''),admin_note)
  where id=wdr.id;

  return jsonb_build_object(
    'status','completed',
    'withdrawal_id',wdr.id,
    'reference',reference,
    'amount',wdr.amount,
    'currency',wdr.currency
  );
end;
$$;

create or replace function public.admin_fail_withdrawal(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wdr public.withdrawal_requests;
  wallet_row public.wallets;
  reference text;
  release_reference text;
  before_balance numeric;
  after_balance numeric;
  release_tx_id uuid;
begin
  if not exists (select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then
    raise exception 'Administrator not authorized';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'A failure reason is required';
  end if;

  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if wdr.status not in ('pending','processing','on_hold') or wdr.reservation_status <> 'reserved' then
    raise exception 'Only active reserved withdrawals can be failed';
  end if;

  select * into wallet_row
  from public.wallets
  where user_id=wdr.user_id and upper(currency)=upper(wdr.currency)
  for update;
  if wallet_row.id is null then raise exception 'Wallet not found for withdrawal'; end if;

  before_balance := coalesce(wallet_row.available,0);
  after_balance := before_balance + wdr.reserved_amount;

  update public.wallets
  set available=after_balance, updated_at=now()
  where id=wallet_row.id;

  reference := 'WD-' || replace(wdr.id::text,'-','');
  release_reference := 'WDR-' || replace(gen_random_uuid()::text,'-','');

  insert into public.wallet_transactions(
    user_id, wallet_id, amount, type, title, category, balance_field,
    status, reference_id, recipient, metadata, created_at
  ) values (
    wdr.user_id, wallet_row.id, wdr.reserved_amount, 'income',
    'Withdrawal reservation released', 'Withdrawal', 'available',
    'completed', release_reference, wdr.destination,
    jsonb_build_object(
      'withdrawal_id',wdr.id,
      'reservation_release',true,
      'failure',true,
      'actor_user_id',p_actor_user_id,
      'reason',trim(p_reason),
      'original_reference',reference
    ), now()
  ) returning id into release_tx_id;

  update public.wallet_transactions
  set status='failed',
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'withdrawal_settlement','failed',
        'failed_by',p_actor_user_id,
        'failed_at',now(),
        'failure_reason',trim(p_reason),
        'release_transaction_id',release_tx_id
      )
  where reference_id=reference and user_id=wdr.user_id and type='withdrawal';

  update public.withdrawal_requests
  set status='failed',
      reservation_status='released',
      released_at=now(),
      processed_at=now(),
      processed_by=p_actor_user_id,
      failure_reason=trim(p_reason),
      admin_note=coalesce(trim(p_reason),admin_note)
  where id=wdr.id;

  return jsonb_build_object(
    'status','failed',
    'withdrawal_id',wdr.id,
    'reference',reference,
    'released_amount',wdr.reserved_amount,
    'available_balance',after_balance,
    'release_transaction_id',release_tx_id
  );
end;
$$;

revoke all on function public.admin_settle_withdrawal(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.admin_fail_withdrawal(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_settle_withdrawal(uuid,uuid,text) to service_role;
grant execute on function public.admin_fail_withdrawal(uuid,uuid,text) to service_role;

comment on function public.admin_settle_withdrawal(uuid,uuid,text) is 'Completes a manually fulfilled withdrawal by consuming its existing reservation; no external provider API is called.';
comment on function public.admin_fail_withdrawal(uuid,uuid,text) is 'Fails a manually fulfilled withdrawal and atomically releases its existing reservation back to available balance.';
