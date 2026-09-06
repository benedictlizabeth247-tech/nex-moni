-- nexMonie withdrawal/exchange completion: phases 7-13.
-- No UI redesign. No Paystack/Flutterwave/Monnify dependency for fiat settlement.
-- All financial mutations occur atomically in PostgreSQL and are initiated through
-- authenticated server boundaries.

-- ================================================================
-- 7 + 8: atomic successful settlement and failure/reversal/release
-- ================================================================

create table if not exists public.financial_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  amount numeric(24,10),
  currency text,
  status text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_audit_entity_idx on public.financial_audit_log(entity_type, entity_id, created_at desc);
create index if not exists financial_audit_user_idx on public.financial_audit_log(user_id, created_at desc);

alter table public.financial_audit_log enable row level security;
drop policy if exists financial_audit_owner_select on public.financial_audit_log;
create policy financial_audit_owner_select on public.financial_audit_log
  for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.financial_audit_log from anon, authenticated;

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
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'withdrawal_settlement','completed', 'settled_by',p_actor_user_id,
        'settled_at',now(), 'settlement_note',note_value
      )
  where reference_id=reference and user_id=wdr.user_id and type='withdrawal' and status='pending';
  get diagnostics tx_count = row_count;
  if tx_count <> 1 then raise exception 'Withdrawal ledger reservation is missing or already settled'; end if;

  update public.withdrawal_requests
  set status='completed', reservation_status='settled', settled_at=now(),
      processed_at=now(), processed_by=p_actor_user_id,
      admin_note=coalesce(note_value,admin_note)
  where id=wdr.id;

  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(p_actor_user_id,wdr.user_id,'withdrawal.settled','withdrawal',wdr.id,wdr.amount,wdr.currency,'completed',reference,jsonb_build_object('note',note_value));

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
set search_path = public
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
  if not exists (select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
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

  update public.wallet_transactions set status='failed', metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
    'withdrawal_settlement','failed','failed_by',p_actor_user_id,'failed_at',now(),'failure_reason',reason_value,'release_transaction_id',release_tx_id)
  where reference_id=reference and user_id=wdr.user_id and type='withdrawal' and status='pending';
  get diagnostics tx_count = row_count;
  if tx_count <> 1 then raise exception 'Withdrawal ledger reservation is missing or already released'; end if;

  update public.withdrawal_requests set status='failed',reservation_status='released',released_at=now(),processed_at=now(),processed_by=p_actor_user_id,
    failure_reason=reason_value,admin_note=reason_value where id=wdr.id;

  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(p_actor_user_id,wdr.user_id,'withdrawal.released','withdrawal',wdr.id,wdr.reserved_amount,wdr.currency,'failed',reference,
    jsonb_build_object('reason',reason_value,'release_transaction_id',release_tx_id,'balance_before',before_balance,'balance_after',after_balance));

  return jsonb_build_object('status','failed','withdrawal_id',wdr.id,'reference',reference,'released_amount',wdr.reserved_amount,'available_balance',after_balance,'release_transaction_id',release_tx_id);
end;
$$;

revoke all on function public.admin_settle_withdrawal(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.admin_fail_withdrawal(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_settle_withdrawal(uuid,uuid,text) to service_role;
grant execute on function public.admin_fail_withdrawal(uuid,uuid,text) to service_role;

-- ================================================================
-- 9: internal nexMonie transfers
-- ================================================================

alter table public.send_requests
  drop constraint if exists send_requests_status_check;
alter table public.send_requests
  add constraint send_requests_status_check
  check (status in ('pending','processing','completed','rejected','cancelled','failed'));
alter table public.send_requests add column if not exists idempotency_key text;
alter table public.send_requests add column if not exists reserved_amount numeric(24,10);
alter table public.send_requests add column if not exists reservation_status text;
alter table public.send_requests add column if not exists recipient_user_id uuid references auth.users(id);
alter table public.send_requests add column if not exists settled_at timestamptz;
alter table public.send_requests add column if not exists failure_reason text;
create unique index if not exists send_requests_user_idempotency_idx on public.send_requests(user_id,idempotency_key) where idempotency_key is not null;

create or replace function public.create_internal_transfer(
  p_recipient text,
  p_amount numeric,
  p_currency text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  sender uuid := auth.uid(); recipient_id uuid; sw public.wallets; rw public.wallets;
  request_id uuid; reference text; recipient_value text := trim(coalesce(p_recipient,'')); currency_value text := upper(trim(coalesce(p_currency,'')));
  tx_out uuid; tx_in uuid; existing public.send_requests;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if round(p_amount,2) <> p_amount then raise exception 'Amount must use valid currency precision'; end if;
  if currency_value='' then raise exception 'Currency is required'; end if;
  if recipient_value='' then raise exception 'Recipient is required'; end if;
  if p_idempotency_key is not null then
    select * into existing from public.send_requests where user_id=sender and idempotency_key=p_idempotency_key limit 1;
    if existing.id is not null then return jsonb_build_object('status','already_created','request_id',existing.id,'reference','TR-'||replace(existing.id::text,'-',''),'transfer_status',existing.status); end if;
  end if;

  select id into recipient_id from public.profiles where id::text=recipient_value or lower(coalesce(email,''))=lower(recipient_value) limit 1;
  if recipient_id is null then raise exception 'Recipient nexMonie account not found'; end if;
  if recipient_id=sender then raise exception 'You cannot transfer to your own account'; end if;
  if not exists(select 1 from public.profiles where id=recipient_id and status='active') then raise exception 'Recipient account is not active'; end if;

  perform 1 from public.wallets where user_id in(sender,recipient_id) and upper(currency)=currency_value order by id for update;
  select * into sw from public.wallets where user_id=sender and upper(currency)=currency_value;
  if sw.id is null then raise exception 'Sender wallet not found'; end if;
  if lower(coalesce(sw.status,'active')) <> 'active' then raise exception 'Sender wallet is not available'; end if;
  if coalesce(sw.available,0) < p_amount then raise exception 'Insufficient available balance'; end if;

  select * into rw from public.wallets where user_id=recipient_id and upper(currency)=currency_value;
  if rw.id is null then raise exception 'Recipient wallet not found'; end if;
  if lower(coalesce(rw.status,'active')) <> 'active' then raise exception 'Recipient wallet is not available'; end if;

  request_id:=gen_random_uuid(); reference:='TR-'||replace(request_id::text,'-','');
  update public.wallets set available=available-p_amount,updated_at=now() where id=sw.id;
  update public.wallets set available=available+p_amount,updated_at=now() where id=rw.id;

  insert into public.send_requests(id,user_id,kind,amount,currency,destination,status,idempotency_key,reserved_amount,reservation_status,recipient_user_id,processed_at,processed_by,admin_note)
  values(request_id,sender,'nex',p_amount,currency_value,recipient_value,'completed',p_idempotency_key,p_amount,'settled',recipient_id,now(),sender,'Internal nexMonie transfer')
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
end;
$$;
revoke all on function public.create_internal_transfer(text,numeric,text,text) from public,anon;
grant execute on function public.create_internal_transfer(text,numeric,text,text) to authenticated;

-- ================================================================
-- 10: crypto withdrawal settlement through the existing custody adapter
-- ================================================================

alter table public.withdrawal_requests add column if not exists provider_reference text;
alter table public.withdrawal_requests add column if not exists provider_status text;
alter table public.withdrawal_requests add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

create or replace function public.admin_record_crypto_submission(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_provider_reference text,
  p_provider_status text,
  p_provider_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare wdr public.withdrawal_requests;
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if wdr.destination_type <> 'crypto' then raise exception 'Withdrawal is not crypto'; end if;
  if wdr.status <> 'processing' or wdr.reservation_status <> 'reserved' then raise exception 'Withdrawal is not ready for crypto settlement'; end if;
  update public.withdrawal_requests set provider_reference=nullif(trim(coalesce(p_provider_reference,'')),''),provider_status=nullif(trim(coalesce(p_provider_status,'')),''),provider_metadata=coalesce(p_provider_metadata,'{}'::jsonb),admin_note=coalesce(admin_note,'Crypto custody submission recorded') where id=wdr.id;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(p_actor_user_id,wdr.user_id,'withdrawal.crypto_submitted','withdrawal',wdr.id,wdr.amount,wdr.currency,p_provider_status,p_provider_reference,coalesce(p_provider_metadata,'{}'::jsonb));
  return jsonb_build_object('status','submitted','withdrawal_id',wdr.id,'provider_reference',p_provider_reference,'provider_status',p_provider_status);
end;
$$;
revoke all on function public.admin_record_crypto_submission(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_record_crypto_submission(uuid,uuid,text,text,jsonb) to service_role;

-- ================================================================
-- 11: autopilot routing
-- ================================================================

create or replace function public.route_autopilot_withdrawal(p_withdrawal_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare wdr public.withdrawal_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null or wdr.user_id<>auth.uid() then raise exception 'Withdrawal not found'; end if;
  if not wdr.autopilot then raise exception 'Autopilot is not enabled for this withdrawal'; end if;
  if wdr.status<>'pending' or wdr.reservation_status<>'reserved' then raise exception 'Withdrawal is not eligible for autopilot routing'; end if;
  if wdr.amount <= 0 then raise exception 'Invalid withdrawal amount'; end if;
  -- Autopilot routes to processing only. It never bypasses the settlement boundary.
  update public.withdrawal_requests set status='processing',processing_at=now(),admin_note=coalesce(admin_note,'Autopilot routed for fulfillment') where id=wdr.id;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(auth.uid(),wdr.user_id,'withdrawal.autopilot_routed','withdrawal',wdr.id,wdr.amount,wdr.currency,'processing','WD-'||replace(wdr.id::text,'-',''),jsonb_build_object('autopilot',true));
  return jsonb_build_object('status','processing','withdrawal_id',wdr.id);
end;
$$;
revoke all on function public.route_autopilot_withdrawal(uuid) from public,anon;
grant execute on function public.route_autopilot_withdrawal(uuid) to authenticated;

-- ================================================================
-- 12: notifications + complete audit trail
-- ================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'account',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications for select to authenticated using(auth.uid()=user_id);
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
revoke insert,delete on public.notifications from anon,authenticated;

create or replace function public.create_financial_notification(
  p_user_id uuid,p_title text,p_body text,p_kind text default 'account',p_entity_type text default null,p_entity_id uuid default null,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=''
as $$
declare nid uuid;
begin
  insert into public.notifications(user_id,title,body,kind,entity_type,entity_id,metadata)
  values(p_user_id,left(p_title,160),left(p_body,1000),coalesce(p_kind,'account'),p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb)) returning id into nid;
  return nid;
end;
$$;
revoke all on function public.create_financial_notification(uuid,text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_financial_notification(uuid,text,text,text,text,uuid,jsonb) to service_role;

-- Extend settlement functions with user-facing notifications.
create or replace function public.admin_settle_withdrawal(
  p_actor_user_id uuid,p_withdrawal_id uuid,p_note text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare wdr public.withdrawal_requests; reference text; tx_count integer; note_value text:=nullif(trim(coalesce(p_note,'')),'');
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if wdr.status<>'processing' or wdr.reservation_status<>'reserved' then raise exception 'Only processing reserved withdrawals can be completed'; end if;
  reference:='WD-'||replace(wdr.id::text,'-','');
  update public.wallet_transactions set status='completed',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('withdrawal_settlement','completed','settled_by',p_actor_user_id,'settled_at',now(),'settlement_note',note_value)
  where reference_id=reference and user_id=wdr.user_id and type='withdrawal' and status='pending';
  get diagnostics tx_count=row_count; if tx_count<>1 then raise exception 'Withdrawal ledger reservation is missing or already settled'; end if;
  update public.withdrawal_requests set status='completed',reservation_status='settled',settled_at=now(),processed_at=now(),processed_by=p_actor_user_id,admin_note=coalesce(note_value,admin_note) where id=wdr.id;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata) values(p_actor_user_id,wdr.user_id,'withdrawal.settled','withdrawal',wdr.id,wdr.amount,wdr.currency,'completed',reference,jsonb_build_object('note',note_value));
  perform public.create_financial_notification(wdr.user_id,'Withdrawal completed',format('%s %s withdrawal %s has been fulfilled.',wdr.amount,wdr.currency,reference),'withdrawal','withdrawal',wdr.id,jsonb_build_object('reference',reference));
  return jsonb_build_object('status','completed','withdrawal_id',wdr.id,'reference',reference,'amount',wdr.amount,'currency',wdr.currency);
end; $$;

create or replace function public.admin_fail_withdrawal(
  p_actor_user_id uuid,p_withdrawal_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare wdr public.withdrawal_requests; wallet_row public.wallets; reference text; release_reference text; release_tx_id uuid; before_balance numeric; after_balance numeric; reason_value text:=trim(coalesce(p_reason,'')); tx_count integer;
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
  if length(reason_value)<3 then raise exception 'A failure reason is required'; end if;
  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if wdr.status not in('pending','processing','on_hold') or wdr.reservation_status<>'reserved' then raise exception 'Only active reserved withdrawals can be failed'; end if;
  select * into wallet_row from public.wallets where user_id=wdr.user_id and upper(currency)=upper(wdr.currency) for update;
  if wallet_row.id is null then raise exception 'Wallet not found for withdrawal'; end if;
  before_balance:=coalesce(wallet_row.available,0); after_balance:=before_balance+wdr.reserved_amount;
  update public.wallets set available=after_balance,updated_at=now() where id=wallet_row.id;
  reference:='WD-'||replace(wdr.id::text,'-',''); release_reference:='WDR-'||replace(gen_random_uuid()::text,'-','');
  insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,recipient,metadata,created_at)
  values(wdr.user_id,wallet_row.id,wdr.reserved_amount,'income','Withdrawal reservation released','Withdrawal','available','completed',release_reference,wdr.destination,jsonb_build_object('withdrawal_id',wdr.id,'reservation_release',true,'failure',true,'actor_user_id',p_actor_user_id,'reason',reason_value,'original_reference',reference),now()) returning id into release_tx_id;
  update public.wallet_transactions set status='failed',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('withdrawal_settlement','failed','failed_by',p_actor_user_id,'failed_at',now(),'failure_reason',reason_value,'release_transaction_id',release_tx_id)
  where reference_id=reference and user_id=wdr.user_id and type='withdrawal' and status='pending';
  get diagnostics tx_count=row_count; if tx_count<>1 then raise exception 'Withdrawal ledger reservation is missing or already released'; end if;
  update public.withdrawal_requests set status='failed',reservation_status='released',released_at=now(),processed_at=now(),processed_by=p_actor_user_id,failure_reason=reason_value,admin_note=reason_value where id=wdr.id;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata) values(p_actor_user_id,wdr.user_id,'withdrawal.released','withdrawal',wdr.id,wdr.reserved_amount,wdr.currency,'failed',reference,jsonb_build_object('reason',reason_value,'release_transaction_id',release_tx_id,'balance_before',before_balance,'balance_after',after_balance));
  perform public.create_financial_notification(wdr.user_id,'Withdrawal failed',format('%s %s withdrawal was not fulfilled. Your reserved funds were released back to your available balance.',wdr.amount,wdr.currency),'withdrawal','withdrawal',wdr.id,jsonb_build_object('reference',reference,'reason',reason_value));
  return jsonb_build_object('status','failed','withdrawal_id',wdr.id,'reference',reference,'released_amount',wdr.reserved_amount,'available_balance',after_balance,'release_transaction_id',release_tx_id);
end; $$;

revoke all on function public.admin_settle_withdrawal(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.admin_fail_withdrawal(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_settle_withdrawal(uuid,uuid,text) to service_role;
grant execute on function public.admin_fail_withdrawal(uuid,uuid,text) to service_role;

-- ================================================================
-- 13: database-level assertions for the financial state machine
-- ================================================================

create or replace function public.verify_withdrawal_invariants(p_withdrawal_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare wdr public.withdrawal_requests; tx_count integer; ok boolean:=true; issues jsonb:='[]'::jsonb;
begin
  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id;
  if wdr.id is null then return jsonb_build_object('ok',false,'issues',jsonb_build_array('withdrawal_not_found')); end if;
  select count(*) into tx_count from public.wallet_transactions where user_id=wdr.user_id and reference_id='WD-'||replace(wdr.id::text,'-','') and type='withdrawal';
  if tx_count<>1 then ok:=false; issues:=issues||jsonb_build_array('expected_exactly_one_withdrawal_ledger_entry'); end if;
  if wdr.status='completed' and wdr.reservation_status<>'settled' then ok:=false; issues:=issues||jsonb_build_array('completed_must_be_settled'); end if;
  if wdr.status in('failed','rejected','cancelled') and wdr.reservation_status<>'released' then ok:=false; issues:=issues||jsonb_build_array('failed_or_rejected_must_be_released'); end if;
  if wdr.status in('pending','processing','on_hold') and wdr.reservation_status<>'reserved' then ok:=false; issues:=issues||jsonb_build_array('active_withdrawal_must_be_reserved'); end if;
  return jsonb_build_object('ok',ok,'withdrawal_id',wdr.id,'status',wdr.status,'reservation_status',wdr.reservation_status,'issues',issues);
end;
$$;
revoke all on function public.verify_withdrawal_invariants(uuid) from public,anon,authenticated;
grant execute on function public.verify_withdrawal_invariants(uuid) to service_role;


-- Phase 12 completion: audit every Admin withdrawal transition and notify the customer.
create or replace function public.admin_manage_withdrawal(
  p_actor_user_id uuid,p_withdrawal_id uuid,p_action text,p_note text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare wdr public.withdrawal_requests; wallet_row public.wallets; action_code text:=lower(trim(coalesce(p_action,''))); note_value text:=nullif(trim(coalesce(p_note,'')), ''); release_reference text;
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;
  if action_code not in('approve','reject','hold','mark_processing','resume') then raise exception 'Unsupported withdrawal action'; end if;

  if action_code in('approve','mark_processing') then
    if wdr.status<>'pending' or wdr.reservation_status<>'reserved' then raise exception 'Only pending reserved withdrawals can enter processing'; end if;
    update public.withdrawal_requests set status='processing',approved_at=case when action_code='approve' then now() else approved_at end,approved_by=case when action_code='approve' then p_actor_user_id else approved_by end,processing_at=now(),processing_by=p_actor_user_id,admin_note=coalesce(note_value,admin_note) where id=wdr.id;
    insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
    values(p_actor_user_id,wdr.user_id,'withdrawal.'||action_code,'withdrawal',wdr.id,wdr.amount,wdr.currency,'processing','WD-'||replace(wdr.id::text,'-',''),jsonb_build_object('note',note_value));
    perform public.create_financial_notification(wdr.user_id,'Withdrawal processing',format('%s %s withdrawal is now being processed.',wdr.amount,wdr.currency),'withdrawal','withdrawal',wdr.id,jsonb_build_object('reference','WD-'||replace(wdr.id::text,'-','')));
    return jsonb_build_object('status','processing','withdrawal_id',wdr.id);
  end if;

  if action_code='resume' then
    if wdr.status<>'on_hold' or wdr.reservation_status<>'reserved' then raise exception 'Only held reserved withdrawals can be resumed'; end if;
    update public.withdrawal_requests set status='processing',processing_at=now(),processing_by=p_actor_user_id,admin_note=coalesce(note_value,admin_note) where id=wdr.id;
    insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
    values(p_actor_user_id,wdr.user_id,'withdrawal.resumed','withdrawal',wdr.id,wdr.amount,wdr.currency,'processing','WD-'||replace(wdr.id::text,'-',''),jsonb_build_object('note',note_value));
    perform public.create_financial_notification(wdr.user_id,'Withdrawal resumed','Your withdrawal has resumed processing.','withdrawal','withdrawal',wdr.id,jsonb_build_object('reference','WD-'||replace(wdr.id::text,'-','')));
    return jsonb_build_object('status','processing','withdrawal_id',wdr.id);
  end if;

  if action_code='hold' then
    if wdr.status not in('pending','processing') or wdr.reservation_status<>'reserved' then raise exception 'Only active reserved withdrawals can be held'; end if;
    update public.withdrawal_requests set status='on_hold',admin_note=coalesce(note_value,admin_note) where id=wdr.id;
    insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
    values(p_actor_user_id,wdr.user_id,'withdrawal.held','withdrawal',wdr.id,wdr.amount,wdr.currency,'on_hold','WD-'||replace(wdr.id::text,'-',''),jsonb_build_object('note',note_value));
    perform public.create_financial_notification(wdr.user_id,'Withdrawal on hold','Your withdrawal has been placed on hold for operational review.','withdrawal','withdrawal',wdr.id,jsonb_build_object('reason',note_value));
    return jsonb_build_object('status','on_hold','withdrawal_id',wdr.id);
  end if;

  if action_code='reject' then
    if wdr.status not in('pending','processing','on_hold') or wdr.reservation_status<>'reserved' then raise exception 'Only reserved active withdrawals can be rejected'; end if;
    select * into wallet_row from public.wallets where user_id=wdr.user_id and upper(currency)=upper(wdr.currency) for update;
    if wallet_row.id is null then raise exception 'Wallet not found for withdrawal'; end if;
    update public.wallets set available=coalesce(available,0)+wdr.reserved_amount,updated_at=now() where id=wallet_row.id;
    release_reference:='WDR-'||replace(gen_random_uuid()::text,'-','');
    insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,recipient,metadata,created_at)
    values(wdr.user_id,wallet_row.id,wdr.reserved_amount,'income','Withdrawal reservation released','Withdrawal','available','completed',release_reference,wdr.destination,jsonb_build_object('withdrawal_id',wdr.id,'reservation_release',true,'actor_user_id',p_actor_user_id,'reason',coalesce(note_value,'Withdrawal rejected')),now());
    update public.wallet_transactions set status='failed',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('withdrawal_settlement','rejected','rejected_by',p_actor_user_id,'rejected_at',now(),'rejection_reason',coalesce(note_value,'Withdrawal rejected')) where reference_id='WD-'||replace(wdr.id::text,'-','') and user_id=wdr.user_id and type='withdrawal' and status='pending';
    update public.withdrawal_requests set status='rejected',reservation_status='released',released_at=now(),processed_at=now(),processed_by=p_actor_user_id,rejection_reason=coalesce(note_value,'Withdrawal rejected'),admin_note=coalesce(note_value,admin_note) where id=wdr.id;
    insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
    values(p_actor_user_id,wdr.user_id,'withdrawal.rejected','withdrawal',wdr.id,wdr.reserved_amount,wdr.currency,'rejected','WD-'||replace(wdr.id::text,'-',''),jsonb_build_object('reason',coalesce(note_value,'Withdrawal rejected'),'release_reference',release_reference));
    perform public.create_financial_notification(wdr.user_id,'Withdrawal rejected','Your withdrawal was rejected and the reserved funds were returned to your available balance.','withdrawal','withdrawal',wdr.id,jsonb_build_object('reason',coalesce(note_value,'Withdrawal rejected')));
    return jsonb_build_object('status','rejected','withdrawal_id',wdr.id,'released_amount',wdr.reserved_amount);
  end if;
end;
$$;
revoke all on function public.admin_manage_withdrawal(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_manage_withdrawal(uuid,uuid,text,text) to service_role;
