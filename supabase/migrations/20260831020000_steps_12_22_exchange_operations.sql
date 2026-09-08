-- nexMonie Steps 12-22: autopilot, trading authority/accounting, copy allocation,
-- merchant governance, service fulfillment, bank withdrawals and admin controls.
-- Market providers remain READ-ONLY. No external provider is treated as an execution rail.

-- ================================================================
-- 12. Autopilot: explicit, idempotent processing transition
-- ================================================================
create or replace function public.route_autopilot_withdrawal(p_withdrawal_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); wdr public.withdrawal_requests;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null or wdr.user_id<>uid then raise exception 'Withdrawal not found'; end if;
  if not wdr.autopilot then raise exception 'Autopilot is not enabled for this withdrawal'; end if;
  if wdr.status='processing' and wdr.reservation_status='reserved' then
    return jsonb_build_object('status','already_processing','withdrawal_id',wdr.id);
  end if;
  if wdr.status<>'pending' or wdr.reservation_status<>'reserved' then raise exception 'Withdrawal is not eligible for autopilot routing'; end if;
  update public.withdrawal_requests set status='processing', admin_note=coalesce(admin_note,'Autopilot routed to operations'), updated_at=now() where id=wdr.id;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata)
  values(uid,uid,'withdrawal.autopilot_routed','withdrawal',wdr.id,wdr.amount,wdr.currency,'processing','WD-'||replace(wdr.id::text,'-',''),jsonb_build_object('autopilot',true));
  perform public.create_financial_notification(uid,'Withdrawal processing',format('%s %s is now in the nexMonie operations queue.',wdr.amount,wdr.currency),'withdrawal','withdrawal',wdr.id,jsonb_build_object('autopilot',true));
  return jsonb_build_object('status','processing','withdrawal_id',wdr.id);
end $$;
revoke all on function public.route_autopilot_withdrawal(uuid) from public,anon;
grant execute on function public.route_autopilot_withdrawal(uuid) to authenticated;

-- ================================================================
-- 13-16. Trading execution authority + accounting + lifecycle + P&L
-- ================================================================
-- Execution is authenticated-user only. p_user_id is retained for API compatibility
-- but MUST equal auth.uid(); service-role is not required for normal trading.
create or replace function public.trading_execute_order(
  p_user_id uuid, p_mode text, p_symbol text, p_side text, p_order_type text,
  p_quantity numeric, p_execution_price numeric, p_leverage numeric default 1,
  p_take_profit numeric default null, p_stop_loss numeric default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); a public.trading_accounts; o public.trading_orders; pos public.trading_positions;
  notional numeric; margin numeric; ref text; order_status text;
begin
  if uid is null or p_user_id<>uid then raise exception 'Trading user mismatch'; end if;
  if p_mode not in ('spot','futures') or p_side not in ('buy','sell') or p_order_type not in ('market','limit','stop') then raise exception 'Invalid trading order'; end if;
  if p_quantity<=0 or p_execution_price<=0 then raise exception 'Invalid order quantity or price'; end if;
  if p_leverage<1 or p_leverage>50 then raise exception 'Leverage must be between 1x and 50x'; end if;
  if p_take_profit is not null and p_take_profit<=0 then raise exception 'Invalid take-profit'; end if;
  if p_stop_loss is not null and p_stop_loss<=0 then raise exception 'Invalid stop-loss'; end if;
  insert into public.trading_accounts(user_id) values(uid) on conflict (user_id) do nothing;
  select * into a from public.trading_accounts where user_id=uid for update;
  if exists(select 1 from public.wallets where user_id=uid and upper(currency)='USD' and (lower(coalesce(status,'active'))<>'active' or coalesce(trading_restricted,false))) then raise exception 'Trading is restricted for this account'; end if;
  notional:=p_quantity*p_execution_price;
  margin:=case when p_mode='futures' then notional/greatest(p_leverage,1) else notional end;
  order_status:=case when p_order_type='market' then 'pending' else 'pending' end;

  if p_order_type='market' then
    if p_mode='spot' and p_side='buy' and a.spot_balance<notional then raise exception 'Insufficient Spot balance'; end if;
    if p_mode='futures' and a.futures_balance<margin then raise exception 'Insufficient Futures margin'; end if;
    if p_mode='spot' and p_side='sell' then
      select * into pos from public.trading_positions where user_id=uid and mode='spot' and symbol=p_symbol and side='buy' and status='open' and quantity>=p_quantity order by opened_at asc limit 1 for update;
      if pos.id is null then raise exception 'Insufficient asset position'; end if;
    end if;
  end if;

  ref:='EXE-'||replace(gen_random_uuid()::text,'-','');
  insert into public.trading_orders(user_id,mode,symbol,side,order_type,quantity,price,leverage,margin,status)
  values(uid,p_mode,p_symbol,p_side,p_order_type,p_quantity,p_execution_price,greatest(p_leverage,1),margin,order_status) returning * into o;

  if p_order_type='market' then
    if p_mode='spot' and p_side='buy' then
      update public.trading_accounts set spot_balance=spot_balance-notional, updated_at=now() where user_id=uid;
      insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,take_profit,stop_loss,status)
      values(uid,'spot',p_symbol,'buy',p_quantity,p_execution_price,p_execution_price,1,notional,0,0,p_take_profit,p_stop_loss,'open');
    elsif p_mode='spot' and p_side='sell' then
      select * into pos from public.trading_positions where user_id=uid and mode='spot' and symbol=p_symbol and side='buy' and status='open' order by opened_at asc limit 1 for update;
      update public.trading_accounts set spot_balance=spot_balance+notional, updated_at=now() where user_id=uid;
      if pos.quantity=p_quantity then
        update public.trading_positions set status='closed',mark_price=p_execution_price,unrealized_pnl=0,realized_pnl=(p_execution_price-entry_price)*quantity,closed_at=now() where id=pos.id;
      else
        update public.trading_positions set quantity=quantity-p_quantity,mark_price=p_execution_price,unrealized_pnl=(p_execution_price-entry_price)*(quantity-p_quantity) where id=pos.id;
      end if;
    elsif p_mode='futures' then
      update public.trading_accounts set futures_balance=futures_balance-margin, updated_at=now() where user_id=uid;
      insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,take_profit,stop_loss,status)
      values(uid,'futures',p_symbol,p_side,p_quantity,p_execution_price,p_execution_price,greatest(p_leverage,1),margin,0,0,p_take_profit,p_stop_loss,'open');
    end if;
    update public.trading_orders set status='filled',price=p_execution_price,filled_quantity=p_quantity where id=o.id;
    insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata)
    values(uid,ref,'exchange_execution',p_symbol,p_quantity,jsonb_build_object('order_id',o.id,'mode',p_mode,'side',p_side,'price',p_execution_price,'notional',notional,'margin',margin));
    return jsonb_build_object('order_id',o.id,'status','filled','price',p_execution_price,'quantity',p_quantity,'margin',margin,'reference',ref);
  end if;

  -- Limit/stop orders remain pending and are filled only by the state-machine RPC.
  insert into public.exchange_ledger(user_id,reference,kind,asset,amount,status,metadata)
  values(uid,ref,'order_accepted',p_symbol,p_quantity,'posted',jsonb_build_object('order_id',o.id,'order_type',p_order_type,'price',p_execution_price));
  return jsonb_build_object('order_id',o.id,'status','pending','price',p_execution_price,'quantity',p_quantity,'margin',margin,'reference',ref);
end $$;
revoke all on function public.trading_execute_order(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.trading_execute_order(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric) to authenticated;

-- One authoritative trading balance is trading_accounts. Wallet is only the funding source.
create or replace function public.trading_get_account()
returns setof public.trading_accounts language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.trading_accounts(user_id) values(uid) on conflict(user_id) do nothing;
  return query select * from public.trading_accounts where user_id=uid;
end $$;
revoke all on function public.trading_get_account() from public,anon;
grant execute on function public.trading_get_account() to authenticated;

create or replace function public.trading_transfer_to_funding(p_mode text,p_amount numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); a public.trading_accounts; w public.wallets; amount_value numeric:=round(p_amount,2); ref text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_mode not in ('spot','futures') or amount_value<=0 then raise exception 'Invalid trading transfer'; end if;
  select * into a from public.trading_accounts where user_id=uid for update;
  select * into w from public.wallets where user_id=uid for update;
  if w.id is null then raise exception 'Funding wallet not found'; end if;
  if p_mode='spot' and a.spot_balance<amount_value then raise exception 'Insufficient Spot balance'; end if;
  if p_mode='futures' and a.futures_balance<amount_value then raise exception 'Insufficient Futures balance'; end if;
  if p_mode='spot' then update public.trading_accounts set spot_balance=spot_balance-amount_value, funding_balance=funding_balance+amount_value, updated_at=now() where user_id=uid;
  else update public.trading_accounts set futures_balance=futures_balance-amount_value, funding_balance=funding_balance+amount_value, updated_at=now() where user_id=uid; end if;
  update public.wallets set available=available+amount_value,updated_at=now() where id=w.id;
  ref:='TRF-'||replace(gen_random_uuid()::text,'-','');
  insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,metadata,created_at) values(uid,w.id,amount_value,'income','Trading funds returned','Trading','available','completed',ref,jsonb_build_object('mode',p_mode),now());
  insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata) values(uid,ref,'trading_to_funding','USD',amount_value,jsonb_build_object('mode',p_mode));
  return jsonb_build_object('status','completed','amount',amount_value,'mode',p_mode,'reference',ref);
end $$;
revoke all on function public.trading_transfer_to_funding(text,numeric) from public,anon;
grant execute on function public.trading_transfer_to_funding(text,numeric) to authenticated;

-- Replace fill with TP/SL and ledger settlement; lock the order and account in one transaction.
create or replace function public.trading_fill_order(p_order_id uuid,p_fill_price numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); o public.trading_orders; a public.trading_accounts; pos public.trading_positions; notional numeric; margin numeric; ref text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_fill_price<=0 then raise exception 'Invalid fill price'; end if;
  select * into o from public.trading_orders where id=p_order_id and user_id=uid and status='pending' for update;
  if o.id is null then raise exception 'Pending order not found'; end if;
  select * into a from public.trading_accounts where user_id=uid for update;
  notional:=o.quantity*p_fill_price; margin:=case when o.mode='futures' then notional/greatest(o.leverage,1) else notional end;
  if o.mode='spot' and o.side='buy' then
    if a.spot_balance<notional then raise exception 'Insufficient Spot balance at execution'; end if;
    update public.trading_accounts set spot_balance=spot_balance-notional,updated_at=now() where user_id=uid;
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,status) values(uid,'spot',o.symbol,'buy',o.quantity,p_fill_price,p_fill_price,1,notional,0,0,'open');
  elsif o.mode='spot' and o.side='sell' then
    select * into pos from public.trading_positions where user_id=uid and mode='spot' and symbol=o.symbol and side='buy' and status='open' order by opened_at asc limit 1 for update;
    if pos.id is null or pos.quantity<o.quantity then raise exception 'Insufficient asset position at execution'; end if;
    update public.trading_accounts set spot_balance=spot_balance+notional,updated_at=now() where user_id=uid;
    if pos.quantity=o.quantity then update public.trading_positions set status='closed',mark_price=p_fill_price,unrealized_pnl=0,realized_pnl=(p_fill_price-entry_price)*quantity,closed_at=now() where id=pos.id;
    else update public.trading_positions set quantity=quantity-o.quantity,mark_price=p_fill_price,unrealized_pnl=(p_fill_price-entry_price)*(quantity-o.quantity) where id=pos.id; end if;
  else
    if a.futures_balance<margin then raise exception 'Insufficient Futures margin at execution'; end if;
    update public.trading_accounts set futures_balance=futures_balance-margin,updated_at=now() where user_id=uid;
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,status) values(uid,'futures',o.symbol,o.side,o.quantity,p_fill_price,p_fill_price,greatest(o.leverage,1),margin,0,0,'open');
  end if;
  update public.trading_orders set status='filled',price=p_fill_price,filled_quantity=o.quantity where id=o.id;
  ref:='FILL-'||replace(gen_random_uuid()::text,'-','');
  insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata) values(uid,ref,'exchange_fill',o.symbol,o.quantity,jsonb_build_object('order_id',o.id,'price',p_fill_price,'mode',o.mode,'side',o.side,'notional',notional,'margin',margin));
  return jsonb_build_object('status','filled','order_id',o.id,'fill_price',p_fill_price,'reference',ref);
end $$;
revoke all on function public.trading_fill_order(uuid,numeric) from public,anon;
grant execute on function public.trading_fill_order(uuid,numeric) to authenticated;

-- Close and risk marking: all balance movements and realized P&L are atomic.
create or replace function public.trading_close_position(p_position_id uuid,p_mark_price numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p public.trading_positions; pnl numeric; a public.trading_accounts; ref text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_mark_price<=0 then raise exception 'Invalid close price'; end if;
  select * into p from public.trading_positions where id=p_position_id and user_id=uid and status='open' for update;
  if p.id is null then raise exception 'Open position not found'; end if;
  pnl:=case when p.side='buy' then (p_mark_price-p.entry_price)*p.quantity else (p.entry_price-p_mark_price)*p.quantity end;
  select * into a from public.trading_accounts where user_id=uid for update;
  if p.mode='futures' then update public.trading_accounts set futures_balance=futures_balance+p.margin+pnl,updated_at=now() where user_id=uid;
  else update public.trading_accounts set spot_balance=spot_balance+(p_mark_price*p.quantity),updated_at=now() where user_id=uid; end if;
  update public.trading_positions set mark_price=p_mark_price,unrealized_pnl=0,realized_pnl=pnl,status='closed',closed_at=now() where id=p.id;
  ref:='CLOSE-'||replace(gen_random_uuid()::text,'-','');
  insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata) values(uid,ref,'position_close',p.symbol,p.quantity,jsonb_build_object('position_id',p.id,'close_price',p_mark_price,'realized_pnl',pnl,'mode',p.mode));
  perform public.create_financial_notification(uid,'Position closed',format('%s %s position closed. Realized P&L: %s.',p.mode,p.symbol,round(pnl,8)),'trading','position',p.id,jsonb_build_object('realized_pnl',pnl));
  return jsonb_build_object('position_id',p.id,'status','closed','realized_pnl',pnl,'close_price',p_mark_price,'reference',ref);
end $$;
revoke all on function public.trading_close_position(uuid,numeric) from public,anon;
grant execute on function public.trading_close_position(uuid,numeric) to authenticated;

-- ================================================================
-- 17. NexPilot/copy trading: real wallet-funded allocation, no fake $2 credit
-- ================================================================
create table if not exists public.copy_trade_allocations (
  id uuid primary key default gen_random_uuid(),
  investor_portfolio_id uuid not null references public.investor_portfolios(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(24,8) not null check(amount>0),
  reserved_amount numeric(24,8) not null default 0,
  status text not null default 'active' check(status in ('active','paused','closed','pending')),
  idempotency_key text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(follower_id,idempotency_key)
);
alter table public.copy_trade_allocations enable row level security;
drop policy if exists copy_trade_allocations_owner on public.copy_trade_allocations;
create policy copy_trade_allocations_owner on public.copy_trade_allocations for select using(auth.uid()=follower_id);
create index if not exists copy_trade_allocations_follower_idx on public.copy_trade_allocations(follower_id,created_at desc);

create or replace function public.create_copy_trade_allocation(p_portfolio_id uuid,p_amount numeric,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p public.investor_portfolios; w public.wallets; a public.copy_trade_allocations; tx uuid; ref text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'Invalid allocation amount'; end if;
  if nullif(trim(p_idempotency_key),'') is null then raise exception 'Idempotency key is required'; end if;
  select * into a from public.copy_trade_allocations where follower_id=uid and idempotency_key=trim(p_idempotency_key) for update;
  if a.id is not null then return jsonb_build_object('status','already_created','allocation_id',a.id,'amount',a.amount); end if;
  select * into p from public.investor_portfolios where id=p_portfolio_id and is_public=true;
  if p.id is null then raise exception 'Portfolio not found'; end if;
  select * into w from public.wallets where user_id=uid and upper(currency)='USD' for update;
  if w.id is null then raise exception 'USD wallet not found'; end if;
  if lower(coalesce(w.status,'active'))<>'active' then raise exception 'Wallet is not available'; end if;
  if w.available<p_amount then raise exception 'Insufficient available USD balance'; end if;
  ref:='CP-'||replace(gen_random_uuid()::text,'-','');
  update public.wallets set available=available-p_amount,locked=coalesce(locked,0)+p_amount,updated_at=now() where id=w.id;
  insert into public.copy_trade_allocations(investor_portfolio_id,follower_id,amount,reserved_amount,status,idempotency_key) values(p.id,uid,p_amount,p_amount,'active',trim(p_idempotency_key)) returning * into a;
  insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,metadata,created_at) values(uid,w,p_amount,'transfer','Copy trading allocation','NexPilot','available','completed',ref,jsonb_build_object('allocation_id',a.id,'portfolio_id',p.id),now()) returning id into tx;
  insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata) values(uid,ref,'copy_trade_allocation','USD',p_amount,jsonb_build_object('allocation_id',a.id,'portfolio_id',p.id,'transaction_id',tx));
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata) values(uid,uid,'copy_trade.allocated','copy_trade_allocation',a.id,p_amount,'USD','active',ref,jsonb_build_object('portfolio_id',p.id));
  return jsonb_build_object('status','active','allocation_id',a.id,'amount',p_amount,'reference',ref);
end $$;
revoke all on function public.create_copy_trade_allocation(uuid,numeric,text) from public,anon;
grant execute on function public.create_copy_trade_allocation(uuid,numeric,text) to authenticated;

-- ================================================================
-- 18. Merchant/P2P governance
-- ================================================================
alter table public.merchant_applications add column if not exists reviewed_by uuid references auth.users(id);
alter table public.merchant_applications add column if not exists reviewed_at timestamptz;
alter table public.merchant_applications add column if not exists review_note text;
alter table public.merchant_applications add column if not exists kyc_status text not null default 'pending';
alter table public.merchant_applications add column if not exists created_at timestamptz not null default now();

create or replace function public.admin_review_merchant_application(p_actor_user_id uuid,p_application_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare app public.merchant_applications; admin_ok boolean; merchant_id uuid;
begin
  select exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) into admin_ok;
  if not admin_ok then raise exception 'Administrator not authorized'; end if;
  if p_action not in ('approve','reject') then raise exception 'Invalid merchant review action'; end if;
  select * into app from public.merchant_applications where id=p_application_id for update;
  if app.id is null then raise exception 'Merchant application not found'; end if;
  if app.status not in ('pending','pending_admin_approval','rejected') then raise exception 'Application is not reviewable'; end if;
  if p_action='reject' then
    update public.merchant_applications set status='rejected',reviewed_by=p_actor_user_id,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),'') where id=app.id;
  else
    update public.merchant_applications set status='approved',kyc_status=coalesce(kyc_status,'verified'),reviewed_by=p_actor_user_id,reviewed_at=now(),review_note=nullif(trim(coalesce(p_note,'')),'') where id=app.id;
    insert into public.merchants(id,"userId",nickname,tier,status,"totalTrades","completionRate",revenue,"tradingVolume","isOnline")
    values(app."createdBy",app."createdBy",app.nickname,app.tier,'approved',0,100,0,0,false)
    on conflict(id) do update set status='approved',tier=excluded.tier,nickname=excluded.nickname;
  end if;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,status,metadata) values(p_actor_user_id,app."createdBy",'merchant.'||p_action,'merchant_application',app.id,p_action,jsonb_build_object('note',p_note,'tier',app.tier));
  perform public.create_financial_notification(app."createdBy",case when p_action='approve' then 'Merchant application approved' else 'Merchant application rejected' end,case when p_action='approve' then 'Your nexMonie merchant application has been approved.' else coalesce(p_note,'Your merchant application was rejected after review.') end,'merchant','merchant_application',app.id,jsonb_build_object('status',p_action));
  return jsonb_build_object('status',p_action,'application_id',app.id);
end $$;
revoke all on function public.admin_review_merchant_application(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_merchant_application(uuid,uuid,text,text) to service_role;

-- ================================================================
-- 19. Operational service fulfillment (no fake success)
-- ================================================================
create or replace function public.admin_fulfill_service_request(p_actor_user_id uuid,p_resource text,p_request_id uuid,p_action text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid; admin_ok boolean; amount_value numeric; currency_value text:='NGN'; wallet_row public.wallets; ref text; tx uuid; current_status text;
begin
  select exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) into admin_ok;
  if not admin_ok then raise exception 'Administrator not authorized'; end if;
  if p_action not in ('process','fulfill','reject') then raise exception 'Invalid service action'; end if;
  if p_resource not in ('airtime','data','bills','scan') then raise exception 'Invalid service resource'; end if;
  if p_resource='airtime' then select user_id,amount,status into uid,amount_value,current_status from public.airtime_purchase_requests where id=p_request_id for update;
  elsif p_resource='data' then select user_id,amount,status into uid,amount_value,current_status from public.data_purchase_requests where id=p_request_id for update;
  elsif p_resource='bills' then select user_id,amount,status into uid,amount_value,current_status from public.bill_payment_requests where id=p_request_id for update;
  else select user_id,amount,status,currency into uid,amount_value,current_status,currency_value from public.scan_payment_requests where id=p_request_id for update; end if;
  if uid is null then raise exception 'Service request not found'; end if;
  if p_action='process' then
    if current_status not in ('pending') then raise exception 'Request cannot enter processing from current state'; end if;
    if p_resource='airtime' then update public.airtime_purchase_requests set status='processing',admin_note=p_note,updated_at=now() where id=p_request_id;
    elsif p_resource='data' then update public.data_purchase_requests set status='processing',admin_note=p_note,updated_at=now() where id=p_request_id;
    elsif p_resource='bills' then update public.bill_payment_requests set status='processing',admin_note=p_note,updated_at=now() where id=p_request_id;
    else update public.scan_payment_requests set status='processing',admin_note=p_note,updated_at=now() where id=p_request_id; end if;
  elsif p_action='reject' then
    if current_status not in ('pending','processing') then raise exception 'Request cannot be rejected from current state'; end if;
    if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Rejection reason is required'; end if;
    if p_resource='airtime' then update public.airtime_purchase_requests set status='rejected',admin_note=p_note,updated_at=now() where id=p_request_id;
    elsif p_resource='data' then update public.data_purchase_requests set status='rejected',admin_note=p_note,updated_at=now() where id=p_request_id;
    elsif p_resource='bills' then update public.bill_payment_requests set status='rejected',admin_note=p_note,updated_at=now() where id=p_request_id;
    else update public.scan_payment_requests set status='rejected',admin_note=p_note,updated_at=now() where id=p_request_id; end if;
  else
    if current_status<>'processing' then raise exception 'Request must be processing before fulfilment'; end if;
    select * into wallet_row from public.wallets where user_id=uid and upper(currency)=upper(currency_value) for update;
    if wallet_row.id is null then raise exception 'Customer wallet not found'; end if;
    if coalesce(wallet_row.available,0)<amount_value then raise exception 'Insufficient customer balance for fulfilment'; end if;
    update public.wallets set available=available-amount_value,updated_at=now() where id=wallet_row.id;
    ref:='SVC-'||replace(p_request_id::text,'-','');
    insert into public.wallet_transactions(user_id,wallet_id,amount,type,title,category,balance_field,status,reference_id,metadata,created_at) values(uid,wallet_row.id,amount_value,'expense','Service purchase',initcap(p_resource),'available','completed',ref,jsonb_build_object('resource',p_resource,'request_id',p_request_id),now()) returning id into tx;
    if p_resource='airtime' then update public.airtime_purchase_requests set status='fulfilled',admin_note=p_note,fulfilled_at=now(),updated_at=now() where id=p_request_id;
    elsif p_resource='data' then update public.data_purchase_requests set status='fulfilled',admin_note=p_note,fulfilled_at=now(),updated_at=now() where id=p_request_id;
    elsif p_resource='bills' then update public.bill_payment_requests set status='fulfilled',admin_note=p_note,fulfilled_at=now(),updated_at=now() where id=p_request_id;
    else update public.scan_payment_requests set status='fulfilled',admin_note=p_note,fulfilled_at=now(),updated_at=now() where id=p_request_id; end if;
    insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,currency,status,reference_id,metadata) values(p_actor_user_id,uid,'service.fulfilled',p_resource||'_request',p_request_id,amount_value,currency_value,'fulfilled',ref,jsonb_build_object('transaction_id',tx));
  end if;
  perform public.create_financial_notification(uid,'Service request update',format('Your %s request is now %s.',p_resource,p_action),'service',p_resource,p_request_id,jsonb_build_object('status',case when p_action='process' then 'processing' when p_action='reject' then 'rejected' else 'fulfilled' end));
  return jsonb_build_object('status',case when p_action='process' then 'processing' when p_action='reject' then 'rejected' else 'fulfilled' end,'request_id',p_request_id);
end $$;
revoke all on function public.admin_fulfill_service_request(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_fulfill_service_request(uuid,text,uuid,text,text) to service_role;

-- ================================================================
-- 20. Bank withdrawal: destination is user-provided and fulfillment is manual
-- ================================================================
alter table public.withdrawal_requests add column if not exists beneficiary_name text;
alter table public.withdrawal_requests add column if not exists bank_name text;
alter table public.withdrawal_requests add column if not exists bank_code text;
alter table public.withdrawal_requests add column if not exists fulfillment_reference text;

-- ================================================================
-- 21. Admin wallet controls: freeze/restrictions/reconciliation
-- ================================================================
alter table public.wallets add column if not exists withdrawal_restricted boolean not null default false;
alter table public.wallets add column if not exists trading_restricted boolean not null default false;
alter table public.wallets add column if not exists freeze_reason text;

create or replace function public.admin_set_wallet_controls(p_actor_user_id uuid,p_user_id uuid,p_currency text,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.wallets; admin_ok boolean; action_value text:=lower(trim(p_action));
begin
  select exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) into admin_ok;
  if not admin_ok then raise exception 'Administrator not authorized'; end if;
  select * into w from public.wallets where user_id=p_user_id and upper(currency)=upper(p_currency) for update;
  if w.id is null then raise exception 'Wallet not found'; end if;
  if action_value='freeze' then update public.wallets set status='frozen',freeze_reason=nullif(trim(coalesce(p_reason,'')),''),updated_at=now() where id=w.id;
  elsif action_value='unfreeze' then update public.wallets set status='active',freeze_reason=null,updated_at=now() where id=w.id;
  elsif action_value='restrict_withdrawals' then update public.wallets set withdrawal_restricted=true,freeze_reason=nullif(trim(coalesce(p_reason,'')),''),updated_at=now() where id=w.id;
  elsif action_value='allow_withdrawals' then update public.wallets set withdrawal_restricted=false,updated_at=now() where id=w.id;
  elsif action_value='restrict_trading' then update public.wallets set trading_restricted=true,freeze_reason=nullif(trim(coalesce(p_reason,'')),''),updated_at=now() where id=w.id;
  elsif action_value='allow_trading' then update public.wallets set trading_restricted=false,updated_at=now() where id=w.id;
  else raise exception 'Invalid wallet control'; end if;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,status,metadata) values(p_actor_user_id,p_user_id,'wallet.'||action_value,'wallet',w.id,action_value,jsonb_build_object('currency',p_currency,'reason',p_reason));
  return jsonb_build_object('status',action_value,'wallet_id',w.id,'user_id',p_user_id,'currency',upper(p_currency));
end $$;
revoke all on function public.admin_set_wallet_controls(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_wallet_controls(uuid,uuid,text,text,text) to service_role;

create or replace function public.admin_reconcile_wallet(p_actor_user_id uuid,p_user_id uuid,p_currency text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.wallets; ledger_sum numeric; difference numeric;
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
  select * into w from public.wallets where user_id=p_user_id and upper(currency)=upper(p_currency) for update;
  if w.id is null then raise exception 'Wallet not found'; end if;
  select coalesce(sum(case when type in ('income','credit') then amount else -amount end),0) into ledger_sum from public.wallet_transactions where wallet_id=w.id and status='completed' and lower(coalesce(balance_field,'available'))='available';
  difference:=round(coalesce(w.available,0)-ledger_sum,2);
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,status,metadata) values(p_actor_user_id,p_user_id,'wallet.reconciled','wallet',w.id,case when difference=0 then 'matched' else 'mismatch' end,jsonb_build_object('currency',upper(p_currency),'wallet_available',w.available,'ledger_sum',ledger_sum,'difference',difference));
  return jsonb_build_object('wallet_id',w.id,'available',w.available,'ledger_sum',ledger_sum,'difference',difference,'status',case when difference=0 then 'matched' else 'mismatch' end);
end $$;
revoke all on function public.admin_reconcile_wallet(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_reconcile_wallet(uuid,uuid,text) to service_role;

-- ================================================================
-- 22. Admin operational state machine endpoint support
-- ================================================================
create index if not exists orders_user_status_idx on public.orders(user_id,status,created_at desc);
create index if not exists withdrawal_ops_idx on public.withdrawal_requests(status,created_at desc);
create index if not exists merchant_application_review_idx on public.merchant_applications(status,created_at desc);
create index if not exists financial_audit_log_created_idx on public.financial_audit_log(created_at desc);

-- Admin order review for the legacy operational order queue. This deliberately
-- changes state + audit only; it never fabricates a wallet credit/debit.
create or replace function public.admin_settle_order(p_actor_user_id uuid,p_order_id uuid,p_status text,p_filled_quantity numeric default null,p_admin_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.orders; filled numeric;
begin
  if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'Administrator not authorized'; end if;
  if p_status not in ('open','partially_filled','filled','rejected','cancelled') then raise exception 'Invalid order status'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Order not found'; end if;
  filled:=coalesce(p_filled_quantity,o.filled_quantity,case when p_status='filled' then o.quantity else 0 end);
  if filled<0 or filled>o.quantity then raise exception 'Invalid filled quantity'; end if;
  if p_status='partially_filled' and (filled<=0 or filled>=o.quantity) then raise exception 'Partial fill must be greater than zero and less than order quantity'; end if;
  update public.orders set status=p_status,filled_quantity=filled,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_at=now() where id=o.id;
  insert into public.financial_audit_log(actor_user_id,user_id,action,entity_type,entity_id,amount,status,reference_id,metadata)
  values(p_actor_user_id,o.user_id,'admin.order.'||p_status,'order',o.id,filled,p_status,'ORDER-'||replace(o.id::text,'-',''),jsonb_build_object('requested_quantity',o.quantity,'filled_quantity',filled,'admin_note',p_admin_note));
  return jsonb_build_object('status',p_status,'order_id',o.id,'filled_quantity',filled);
end $$;
revoke all on function public.admin_settle_order(uuid,uuid,text,numeric,text) from public,anon,authenticated;
grant execute on function public.admin_settle_order(uuid,uuid,text,numeric,text) to service_role;

-- Re-apply the withdrawal creation contract with admin restriction enforcement.
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

  if coalesce(w.withdrawal_restricted, false) then
    raise exception 'Withdrawals are restricted for this account';
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


revoke all on function public.create_withdrawal_request(numeric,text,text,text,text,boolean,text) from public,anon;
grant execute on function public.create_withdrawal_request(numeric,text,text,text,text,boolean,text) to authenticated;
