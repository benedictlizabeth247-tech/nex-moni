create or replace function public.trading_execute_order(
  p_user_id uuid, p_mode text, p_symbol text, p_side text, p_order_type text,
  p_quantity numeric, p_execution_price numeric, p_leverage numeric,
  p_take_profit numeric default null, p_stop_loss numeric default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  a public.trading_accounts;
  o public.trading_orders;
  p public.trading_positions;
  source_position public.trading_positions;
  remaining numeric := p_quantity;
  consumed numeric;
  proceeds numeric;
  cost numeric := 0;
  realized numeric := 0;
  margin_required numeric;
  available_balance numeric;
  ref text;
begin
  if uid is null or uid <> p_user_id then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_mode not in ('spot','futures') or p_side not in ('buy','sell') or p_order_type <> 'market' then raise exception 'INVALID_ORDER'; end if;
  if p_quantity is null or p_quantity <= 0 or p_execution_price is null or p_execution_price <= 0 or p_leverage is null or p_leverage < 1 or p_leverage > 50 then raise exception 'INVALID_ORDER_VALUES'; end if;
  if exists (select 1 from public.wallets where user_id=uid and (status <> 'active' or trading_restricted=true)) then raise exception 'TRADING_RESTRICTED'; end if;

  insert into public.trading_accounts(user_id,funding_balance,spot_balance,futures_balance)
  values(uid,0,0,0) on conflict(user_id) do nothing;
  select * into a from public.trading_accounts where user_id=uid for update;

  if p_mode='spot' and p_side='sell' then
    select coalesce(sum(quantity),0) into available_balance
    from public.trading_positions
    where user_id=uid and mode='spot' and symbol=p_symbol and side='buy' and status='open';
    if available_balance < p_quantity then raise exception 'INSUFFICIENT_ASSET_POSITION'; end if;
  else
    margin_required := p_quantity * p_execution_price / case when p_mode='futures' then p_leverage else 1 end;
    available_balance := case when p_mode='futures' then coalesce(a.futures_balance,0) else coalesce(a.spot_balance,0) end;
    if available_balance < margin_required then raise exception 'INSUFFICIENT_TRADING_BALANCE'; end if;
  end if;

  margin_required := p_quantity * p_execution_price / case when p_mode='futures' then p_leverage else 1 end;
  insert into public.trading_orders(user_id,mode,symbol,side,order_type,quantity,price,leverage,margin,status)
  values(uid,p_mode,p_symbol,p_side,p_order_type,p_quantity,p_execution_price,p_leverage,margin_required,'filled') returning * into o;

  if p_mode='spot' and p_side='sell' then
    proceeds := p_quantity * p_execution_price;
    for source_position in
      select * from public.trading_positions
      where user_id=uid and mode='spot' and symbol=p_symbol and side='buy' and status='open'
      order by opened_at asc for update
    loop
      exit when remaining <= 0;
      consumed := least(remaining, source_position.quantity);
      cost := cost + consumed * source_position.entry_price;
      update public.trading_positions
      set quantity=quantity-consumed,
          mark_price=p_execution_price,
          unrealized_pnl=0,
          realized_pnl=(p_execution_price-source_position.entry_price)*consumed,
          status=case when source_position.quantity=consumed then 'closed' else 'open' end,
          closed_at=case when source_position.quantity=consumed then now() else null end
      where id=source_position.id;
      remaining := remaining - consumed;
    end loop;
    realized := proceeds - cost;
    update public.trading_accounts set spot_balance=spot_balance+proceeds, updated_at=now() where user_id=uid;
    ref := 'SELL-' || replace(gen_random_uuid()::text,'-','');
    insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata)
    values(uid,ref,'spot_sell',p_symbol,proceeds,jsonb_build_object('order_id',o.id,'quantity',p_quantity,'execution_price',p_execution_price,'realized_pnl',realized));
  elsif p_mode='spot' then
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,status,opened_at,take_profit,stop_loss)
    values(uid,p_mode,p_symbol,p_side,p_quantity,p_execution_price,p_execution_price,1,margin_required,0,0,'open',now(),p_take_profit,p_stop_loss) returning * into p;
    update public.trading_accounts set spot_balance=spot_balance-margin_required, updated_at=now() where user_id=uid;
    ref := 'BUY-' || replace(gen_random_uuid()::text,'-','');
    insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata)
    values(uid,ref,'spot_buy',p_symbol,margin_required,jsonb_build_object('order_id',o.id,'quantity',p_quantity,'execution_price',p_execution_price));
  else
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,status,opened_at,take_profit,stop_loss)
    values(uid,p_mode,p_symbol,p_side,p_quantity,p_execution_price,p_execution_price,p_leverage,margin_required,0,0,'open',now(),p_take_profit,p_stop_loss) returning * into p;
    update public.trading_accounts set futures_balance=futures_balance-margin_required, updated_at=now() where user_id=uid;
  end if;

  return jsonb_build_object('status','filled','order',to_jsonb(o),'position',case when p_mode='spot' and p_side='sell' then null else to_jsonb(p) end,'margin',margin_required,'available_before',available_balance,'available_after',case when p_mode='spot' and p_side='sell' then a.spot_balance+proceeds else available_balance-margin_required end,'realized_pnl',realized);
end;
$$;
