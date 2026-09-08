-- Market-powered simulated execution layer.
-- IMPORTANT: execution is internal to nexMonie/VU. External providers remain READ-ONLY
-- market-data sources. Prices used for simulated fills/marking come from the app's
-- existing market-data service, never from hardcoded prices.

create or replace function public.trading_fill_order(
  p_order_id uuid,
  p_fill_price numeric
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o public.trading_orders;
  a public.trading_accounts;
  pos public.trading_positions;
  notional numeric;
  margin numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_fill_price <= 0 then raise exception 'Invalid fill price'; end if;

  select * into o from public.trading_orders
    where id=p_order_id and user_id=uid and status='pending' for update;
  if o.id is null then raise exception 'Pending order not found'; end if;

  select * into a from public.trading_accounts where user_id=uid for update;
  notional := o.quantity * p_fill_price;
  margin := case when o.mode='futures' then notional / greatest(o.leverage,1) else notional end;

  if o.mode='spot' then
    if o.side='buy' then
      if a.spot_balance < notional then raise exception 'Insufficient Spot balance at execution'; end if;
      update public.trading_accounts set spot_balance=spot_balance-notional, updated_at=now() where user_id=uid;
      insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status)
      values(uid,'spot',o.symbol,'buy',o.quantity,p_fill_price,p_fill_price,1,notional,0,'open');
    else
      select * into pos from public.trading_positions
        where user_id=uid and mode='spot' and symbol=o.symbol and side='buy' and status='open'
        order by opened_at desc limit 1 for update;
      if pos.id is null or pos.quantity < o.quantity then raise exception 'Insufficient asset position'; end if;
      update public.trading_accounts set spot_balance=spot_balance+notional, updated_at=now() where user_id=uid;
      if pos.quantity=o.quantity then
        update public.trading_positions set status='closed', mark_price=p_fill_price,
          unrealized_pnl=(p_fill_price-entry_price)*quantity where id=pos.id;
      else
        update public.trading_positions set quantity=quantity-o.quantity, mark_price=p_fill_price,
          unrealized_pnl=(p_fill_price-entry_price)*(quantity-o.quantity) where id=pos.id;
      end if;
    end if;
  else
    if a.futures_balance < margin then raise exception 'Insufficient Futures margin at execution'; end if;
    update public.trading_accounts set futures_balance=futures_balance-margin, updated_at=now() where user_id=uid;
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status)
    values(uid,'futures',o.symbol,o.side,o.quantity,p_fill_price,p_fill_price,greatest(o.leverage,1),margin,0,'open');
  end if;

  update public.trading_orders set status='filled', price=p_fill_price where id=o.id;
  return jsonb_build_object('order_id',o.id,'status','filled','fill_price',p_fill_price);
end $$;

create or replace function public.trading_place_order(
  p_mode text, p_symbol text, p_side text, p_order_type text,
  p_quantity numeric, p_price numeric, p_leverage numeric default 1
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); a public.trading_accounts; o public.trading_orders;
       notional numeric := p_quantity * p_price; margin numeric := case when p_mode='futures' then notional / greatest(p_leverage,1) else notional end;
       status_value text := case when p_order_type='market' then 'filled' else 'pending' end;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_mode not in ('spot','futures') then raise exception 'Invalid trading mode'; end if;
  if p_quantity <= 0 or p_price <= 0 then raise exception 'Invalid order size'; end if;
  if p_side not in ('buy','sell') then raise exception 'Invalid order side'; end if;
  if p_order_type not in ('market','limit','stop') then raise exception 'Invalid order type'; end if;

  insert into public.trading_accounts(user_id) values(uid) on conflict (user_id) do nothing;
  select * into a from public.trading_accounts where user_id=uid for update;

  -- Validate resources at order entry. Market orders consume immediately; pending
  -- orders are checked again when the market reaches their trigger price.
  if status_value='filled' then
    if p_mode='spot' and p_side='buy' and a.spot_balance < notional then raise exception 'Insufficient Spot balance'; end if;
    if p_mode='futures' and a.futures_balance < margin then raise exception 'Insufficient Futures margin'; end if;
    if p_mode='spot' and p_side='sell' then
      if not exists(select 1 from public.trading_positions where user_id=uid and mode='spot' and symbol=p_symbol and side='buy' and status='open' and quantity>=p_quantity) then raise exception 'Insufficient asset position'; end if;
    end if;
  end if;

  insert into public.trading_orders(user_id,mode,symbol,side,order_type,quantity,price,leverage,margin,status)
  values(uid,p_mode,p_symbol,p_side,p_order_type,p_quantity,p_price,greatest(p_leverage,1),margin,status_value) returning * into o;

  if status_value='filled' then
    -- Reuse the same settlement function for market fills.
    update public.trading_orders set status='pending' where id=o.id;
    perform public.trading_fill_order(o.id,p_price);
  end if;

  return jsonb_build_object('order_id',o.id,'status',case when status_value='filled' then 'filled' else 'pending' end,'price',p_price,'quantity',p_quantity,'margin',margin);
end $$;

create or replace function public.trading_process_pending_order(
  p_order_id uuid,
  p_market_price numeric
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); o public.trading_orders;
  should_fill boolean := false;
begin
  select * into o from public.trading_orders where id=p_order_id and user_id=uid and status='pending';
  if o.id is null then return jsonb_build_object('status','ignored'); end if;
  if o.order_type='limit' then
    should_fill := case when o.side='buy' then p_market_price <= o.price else p_market_price >= o.price end;
  elsif o.order_type='stop' then
    should_fill := case when o.side='buy' then p_market_price >= o.price else p_market_price <= o.price end;
  end if;
  if should_fill then return public.trading_fill_order(o.id,p_market_price); end if;
  return jsonb_build_object('status','pending');
end $$;
