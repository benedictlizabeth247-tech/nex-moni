-- nexMonie Steps 6-11 financial hardening.
-- 6: deposit review/settlement evidence and idempotency.
-- 7-9: withdrawal reservation/settlement/reversal state-machine hardening.
-- 10: internal transfer replay/concurrency hardening.
-- 11: crypto custody submission idempotency and audit boundary.

-- ================================================================
-- 6. Dedicated deposit verification and settlement
-- ================================================================

alter table public.deposits
  add column if not exists currency text not null default 'NGN',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists review_note text,
  add column if not exists settlement_reference text;

alter table public.deposits
  drop constraint if exists deposits_currency_check;
alter table public.deposits
  add constraint deposits_currency_check check (upper(currency) in ('NGN','USD'));

create index if not exists deposits_review_queue_idx
  on public.deposits(status, created_at desc)
  where status in ('pending','processing');

create index if not exists admin_deposit_actions_actor_idx
  on public.admin_deposit_actions(actor_user_id, created_at desc);

create or replace function public.admin_review_deposit(
  p_actor_user_id uuid,
  p_deposit_id uuid,
  p_action text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.deposits;
  credit jsonb;
  action_code text := lower(trim(coalesce(p_action,'')));
  note_value text := nullif(trim(coalesce(p_note,'')), '');
  settlement_ref text;
begin
  if not exists (
    select 1 from public.admin_staff s
    where s.user_id = p_actor_user_id and s.active = true
  ) then
    raise exception 'Administrator not authorized';
  end if;

  if action_code not in ('approve','reject') then
    raise exception 'Invalid deposit action';
  end if;

  select * into d
  from public.deposits
  where id = p_deposit_id
  for update;

  if d.id is null then raise exception 'Deposit not found'; end if;

  -- Idempotent replay: a second review never credits or rejects again.
  if d.status in ('confirmed','failed','cancelled') then
    return jsonb_build_object(
      'status', d.status,
      'deposit_id', d.id,
      'reference', d.reference,
      'already_reviewed', true
    );
  end if;

  if d.amount <= 0 then raise exception 'Invalid deposit amount'; end if;
  if upper(coalesce(d.currency,'NGN')) not in ('NGN','USD') then
    raise exception 'Unsupported deposit currency';
  end if;

  settlement_ref := coalesce(nullif(trim(d.settlement_reference), ''), d.reference);

  if action_code = 'approve' then
    -- The ledger mutation itself is idempotent by reference.
    credit := public.credit_fiat_deposit(
      d.user_id,
      d.amount,
      settlement_ref,
      'manual_bank_transfer'
    );

    update public.deposits
    set status = 'confirmed',
        confirmed_at = now(),
        reviewed_at = now(),
        reviewed_by = p_actor_user_id,
        review_note = note_value,
        settlement_reference = settlement_ref,
        currency = upper(coalesce(currency,'NGN'))
    where id = d.id;
  else
    update public.deposits
    set status = 'failed',
        reviewed_at = now(),
        reviewed_by = p_actor_user_id,
        review_note = coalesce(note_value, 'Deposit rejected')
    where id = d.id;
    credit := jsonb_build_object('status','rejected');
  end if;

  insert into public.admin_deposit_actions(actor_user_id, deposit_id, action, note)
  values (p_actor_user_id, d.id, action_code, note_value);

  perform public.create_financial_notification(
    d.user_id,
    case when action_code='approve' then 'Deposit credited' else 'Deposit rejected' end,
    case when action_code='approve'
      then format('%s %s deposit %s was verified and credited to your wallet.', d.amount, upper(coalesce(d.currency,'NGN')), d.reference)
      else format('Your deposit %s was rejected. %s', d.reference, coalesce(note_value, 'Please contact support if you believe this is incorrect.'))
    end,
    'deposit',
    'deposit',
    d.id,
    jsonb_build_object('reference',d.reference,'reviewed_by',p_actor_user_id,'note',note_value)
  );

  insert into public.financial_audit_log(
    actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata
  ) values (
    p_actor_user_id,d.user_id,
    case when action_code='approve' then 'deposit.credited' else 'deposit.rejected' end,
    'deposit',d.id,d.amount,upper(coalesce(d.currency,'NGN')),
    case when action_code='approve' then 'confirmed' else 'failed' end,
    d.reference,
    jsonb_build_object('note',note_value,'settlement',credit)
  );

  return jsonb_build_object(
    'status', case when action_code='approve' then 'confirmed' else 'failed' end,
    'deposit_id', d.id,
    'reference', d.reference,
    'credit', credit
  );
end;
$$;

revoke all on function public.admin_review_deposit(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_review_deposit(uuid,uuid,text,text) to service_role;

-- ================================================================
-- 7-9. Withdrawal state machine: one-way atomic transitions
-- ================================================================

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_status_check
  check (status in ('pending','processing','on_hold','completed','rejected','cancelled','failed'));

create or replace function public.admin_settle_withdrawal(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wdr public.withdrawal_requests;
  reference text;
  tx_count integer;
  note_value text := nullif(trim(coalesce(p_note,'')), '');
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

  update public.wallet_transactions
  set status='completed',
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'withdrawal_settlement','completed',
        'settled_by',p_actor_user_id,
        'settled_at',now(),
        'settlement_note',note_value
      )
  where reference_id=reference
    and user_id=wdr.user_id
    and type='withdrawal'
    and status='pending';
  get diagnostics tx_count = row_count;

  if tx_count <> 1 then
    raise exception 'Withdrawal ledger reservation is missing or already settled';
  end if;

  update public.withdrawal_requests
  set status='completed', reservation_status='settled', settled_at=now(),
      processed_at=now(), processed_by=p_actor_user_id,
      admin_note=coalesce(note_value,admin_note)
  where id=wdr.id;

  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(p_actor_user_id,wdr.user_id,'withdrawal.settled','withdrawal',wdr.id,wdr.amount,wdr.currency,'completed',reference,jsonb_build_object('note',note_value));

  perform public.create_financial_notification(
    wdr.user_id,'Withdrawal completed',
    format('%s %s withdrawal has been fulfilled.',wdr.amount,wdr.currency),
    'withdrawal','withdrawal',wdr.id,jsonb_build_object('reference',reference)
  );

  return jsonb_build_object('status','completed','withdrawal_id',wdr.id,'reference',reference,'amount',wdr.amount,'currency',wdr.currency);
end;
$$;

create or replace function public.admin_fail_withdrawal(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wdr public.withdrawal_requests;
  wallet_row public.wallets;
  reference text;
  release_reference text;
  release_tx_id uuid;
  before_balance numeric;
  after_balance numeric;
  reason_value text := trim(coalesce(p_reason,''));
  tx_count integer;
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then
    raise exception 'Administrator not authorized';
  end if;
  if length(reason_value) < 3 then raise exception 'A failure reason is required'; end if;

  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if wdr.status not in ('pending','processing','on_hold') or wdr.reservation_status <> 'reserved' then
    raise exception 'Only active reserved withdrawals can be failed';
  end if;

  select * into wallet_row from public.wallets
  where user_id=wdr.user_id and upper(currency)=upper(wdr.currency) for update;
  if wallet_row.id is null then raise exception 'Wallet not found for withdrawal'; end if;

  before_balance := coalesce(wallet_row.available,0);
  after_balance := before_balance + wdr.reserved_amount;
  update public.wallets set available=after_balance,updated_at=now() where id=wallet_row.id;

  reference := 'WD-' || replace(wdr.id::text,'-','');
  release_reference := 'WDR-' || replace(gen_random_uuid()::text,'-','');

  insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,recipient,metadata,created_at)
  values(wdr.user_id,wallet_row.id,wdr.reserved_amount,'income','Withdrawal reservation released','Withdrawal','available','completed',release_reference,wdr.destination,
    jsonb_build_object('withdrawal_id',wdr.id,'reservation_release',true,'failure',true,'actor_user_id',p_actor_user_id,'reason',reason_value,'original_reference',reference),now())
  returning id into release_tx_id;

  update public.wallet_transactions
  set status='failed', metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
    'withdrawal_settlement','failed','failed_by',p_actor_user_id,'failed_at',now(),
    'failure_reason',reason_value,'release_transaction_id',release_tx_id)
  where reference_id=reference and user_id=wdr.user_id and type='withdrawal' and status='pending';
  get diagnostics tx_count = row_count;

  if tx_count <> 1 then
    raise exception 'Withdrawal ledger reservation is missing or already released';
  end if;

  update public.withdrawal_requests
  set status='failed',reservation_status='released',released_at=now(),processed_at=now(),processed_by=p_actor_user_id,
      failure_reason=reason_value,admin_note=reason_value
  where id=wdr.id;

  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(p_actor_user_id,wdr.user_id,'withdrawal.released','withdrawal',wdr.id,wdr.reserved_amount,wdr.currency,'failed',reference,
    jsonb_build_object('reason',reason_value,'release_transaction_id',release_tx_id,'balance_before',before_balance,'balance_after',after_balance));

  perform public.create_financial_notification(
    wdr.user_id,'Withdrawal failed',
    format('%s %s withdrawal was not fulfilled. Reserved funds were returned to your available balance.',wdr.amount,wdr.currency),
    'withdrawal','withdrawal',wdr.id,jsonb_build_object('reference',reference,'reason',reason_value)
  );

  return jsonb_build_object('status','failed','withdrawal_id',wdr.id,'reference',reference,'released_amount',wdr.reserved_amount,'available_balance',after_balance,'release_transaction_id',release_tx_id);
end;
$$;

revoke all on function public.admin_settle_withdrawal(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.admin_fail_withdrawal(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_settle_withdrawal(uuid,uuid,text) to service_role;
grant execute on function public.admin_fail_withdrawal(uuid,uuid,text) to service_role;

-- ================================================================
-- 10. Internal transfer replay/concurrency hardening
-- ================================================================

alter table public.send_requests add column if not exists idempotency_key text;
create unique index if not exists send_requests_user_idempotency_idx
  on public.send_requests(user_id,idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_internal_transfer(
  p_recipient text,
  p_amount numeric,
  p_currency text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := auth.uid();
  recipient_id uuid;
  sw public.wallets;
  rw public.wallets;
  request_id uuid;
  reference text;
  recipient_value text := trim(coalesce(p_recipient,''));
  currency_value text := upper(trim(coalesce(p_currency,'')));
  tx_out uuid;
  tx_in uuid;
  existing public.send_requests;
  first_wallet uuid;
  second_wallet uuid;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if round(p_amount,2) <> p_amount then raise exception 'Amount must use valid currency precision'; end if;
  if currency_value='' then raise exception 'Currency is required'; end if;
  if recipient_value='' then raise exception 'Recipient is required'; end if;
  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then raise exception 'Idempotency key is required'; end if;

  select * into existing from public.send_requests
  where user_id=sender and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if existing.id is not null then
    return jsonb_build_object('status','already_created','request_id',existing.id,'reference','TR-'||replace(existing.id::text,'-',''),'transfer_status',existing.status);
  end if;

  select id into recipient_id
  from public.profiles
  where id::text=recipient_value or lower(coalesce(email,''))=lower(recipient_value)
  limit 1;
  if recipient_id is null then raise exception 'Recipient nexMonie account not found'; end if;
  if recipient_id=sender then raise exception 'You cannot transfer to your own account'; end if;
  if not exists(select 1 from public.profiles where id=recipient_id and status='active') then raise exception 'Recipient account is not active'; end if;

  -- Deterministic lock order prevents two opposite-direction transfers from deadlocking.
  select min(id), max(id) into first_wallet, second_wallet
  from public.wallets
  where user_id in(sender,recipient_id) and upper(currency)=currency_value;
  if first_wallet is null or second_wallet is null then raise exception 'Both currency wallets are required'; end if;

  perform 1 from public.wallets where id in(first_wallet,second_wallet) order by id for update;

  select * into sw from public.wallets where user_id=sender and upper(currency)=currency_value;
  select * into rw from public.wallets where user_id=recipient_id and upper(currency)=currency_value;
  if sw.id is null or rw.id is null then raise exception 'Both currency wallets are required'; end if;
  if lower(coalesce(sw.status,'active')) <> 'active' then raise exception 'Sender wallet is not available'; end if;
  if lower(coalesce(rw.status,'active')) <> 'active' then raise exception 'Recipient wallet is not available'; end if;
  if coalesce(sw.available,0) < p_amount then raise exception 'Insufficient available balance'; end if;

  request_id:=gen_random_uuid(); reference:='TR-'||replace(request_id::text,'-','');
  update public.wallets set available=available-p_amount,updated_at=now() where id=sw.id;
  update public.wallets set available=available+p_amount,updated_at=now() where id=rw.id;

  insert into public.send_requests(id,user_id,kind,amount,currency,destination,status,idempotency_key,reserved_amount,reservation_status,recipient_user_id,processed_at,processed_by,admin_note)
  values(request_id,sender,'nex',p_amount,currency_value,recipient_value,'completed',trim(p_idempotency_key),p_amount,'settled',recipient_id,now(),sender,'Internal nexMonie transfer')
  returning id into request_id;

  insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,recipient,metadata,created_at)
  values(sender,sw.id,p_amount,'transfer','Transfer sent','Transfer','available','completed',reference,recipient_value,jsonb_build_object('transfer_id',request_id,'direction','outbound','recipient_user_id',recipient_id),now()) returning id into tx_out;
  insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,recipient,metadata,created_at)
  values(recipient_id,rw.id,p_amount,'income','Transfer received','Transfer','available','completed',reference,(select coalesce(display_name,email,recipient_id::text) from public.profiles where id=sender),jsonb_build_object('transfer_id',request_id,'direction','inbound','sender_user_id',sender),now()) returning id into tx_in;

  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(sender,sender,'transfer.completed','internal_transfer',request_id,p_amount,currency_value,'completed',reference,jsonb_build_object('recipient_user_id',recipient_id,'outbound_transaction_id',tx_out,'inbound_transaction_id',tx_in));
  perform public.create_financial_notification(recipient_id,'Money received',format('%s %s has been received in your nexMonie wallet.',p_amount,currency_value),'transfer','internal_transfer',request_id,jsonb_build_object('reference',reference,'sender_user_id',sender));
  perform public.create_financial_notification(sender,'Transfer completed',format('%s %s was sent successfully.',p_amount,currency_value),'transfer','internal_transfer',request_id,jsonb_build_object('reference',reference,'recipient_user_id',recipient_id));

  return jsonb_build_object('status','completed','request_id',request_id,'reference',reference,'recipient_user_id',recipient_id,'amount',p_amount,'currency',currency_value);
exception when unique_violation then
  select * into existing from public.send_requests where user_id=sender and idempotency_key=trim(p_idempotency_key) limit 1;
  if existing.id is not null then
    return jsonb_build_object('status','already_created','request_id',existing.id,'reference','TR-'||replace(existing.id::text,'-',''),'transfer_status',existing.status);
  end if;
  raise;
end;
$$;

revoke all on function public.create_internal_transfer(text,numeric,text,text) from public,anon;
grant execute on function public.create_internal_transfer(text,numeric,text,text) to authenticated;

-- ================================================================
-- 11. Crypto custody submission boundary
-- ================================================================

alter table public.withdrawal_requests
  add column if not exists provider_reference text,
  add column if not exists provider_status text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

create or replace function public.admin_record_crypto_submission(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_provider_reference text,
  p_provider_status text,
  p_provider_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wdr public.withdrawal_requests;
  provider_ref text := nullif(trim(coalesce(p_provider_reference,'')), '');
  provider_state text := nullif(trim(coalesce(p_provider_status,'')), '');
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
  if provider_ref is null then raise exception 'Custody provider reference is required'; end if;
  if provider_state is null then raise exception 'Custody provider status is required'; end if;

  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if wdr.destination_type <> 'crypto' then raise exception 'Withdrawal is not crypto'; end if;

  if wdr.provider_reference is not null then
    return jsonb_build_object('status','already_submitted','withdrawal_id',wdr.id,'provider_reference',wdr.provider_reference,'provider_status',wdr.provider_status);
  end if;

  if wdr.status <> 'processing' or wdr.reservation_status <> 'reserved' then
    raise exception 'Withdrawal is not ready for crypto settlement';
  end if;

  update public.withdrawal_requests
  set provider_reference=provider_ref,
      provider_status=provider_state,
      provider_metadata=coalesce(p_provider_metadata,'{}'::jsonb),
      admin_note=coalesce(admin_note,'Crypto custody submission recorded')
  where id=wdr.id;

  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(p_actor_user_id,wdr.user_id,'withdrawal.crypto_submitted','withdrawal',wdr.id,wdr.amount,wdr.currency,provider_state,provider_ref,coalesce(p_provider_metadata,'{}'::jsonb));

  return jsonb_build_object('status','submitted','withdrawal_id',wdr.id,'provider_reference',provider_ref,'provider_status',provider_state);
end;
$$;

revoke all on function public.admin_record_crypto_submission(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_record_crypto_submission(uuid,uuid,text,text,jsonb) to service_role;

