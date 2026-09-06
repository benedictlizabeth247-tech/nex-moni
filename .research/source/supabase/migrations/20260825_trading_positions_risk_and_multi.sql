-- Trading position lifecycle: multiple positions, per-position TP/SL,
-- live marking, individual close, realized P&L and risk-triggered close.

alter table public.trading_positions add column if not exists realized_pnl numeric not null default 0;
alter table public.trading_positions add column if not exists take_profit numeric null;
alter table public.trading_positions add column if not exists stop_loss numeric null;
alter table public.trading_positions add column if not exists closed_at timestamptz null;

create or replace function public.trading_update_position_risk(
  p_position_id uuid,
  p_take_profit numeric default null,
  p_stop_loss numeric default null
)
returns public.trading_positions
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); p public.trading_positions;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_take_profit is not null and p_take_profit <= 0 then raise exception 'Invalid take-profit price'; end if;
  if p_stop_loss is not null and p_stop_loss <= 0 then raise exception 'Invalid stop-loss price'; end if;
  update public.trading_positions
    set take_profit=p_take_profit, stop_loss=p_stop_loss
    where id=p_position_id and user_id=uid and status='open'
    returning * into p;
  if p.id is null then raise exception 'Open position not found'; end if;
  return p;
end $$;

create or replace function public.trading_close_position(
  p_position_id uuid,
  p_mark_price numeric
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); p public.trading_positions; pnl numeric; a public.trading_accounts; realized numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_mark_price <= 0 then raise exception 'Invalid close price'; end if;
  select * into p from public.trading_positions where id=p_position_id and user_id=uid and status='open' for update;
  if p.id is null then raise exception 'Open position not found'; end if;
  pnl := case when p.side='buy' then (p_mark_price-p.entry_price)*p.quantity else (p.entry_price-p_mark_price)*p.quantity end;
  realized := pnl;
  update public.trading_positions
    set mark_price=p_mark_price, unrealized_pnl=0, realized_pnl=realized, status='closed', closed_at=now()
    where id=p.id;
  select * into a from public.trading_accounts where user_id=uid for update;
  if p.mode='futures' then
    update public.trading_accounts set futures_balance=futures_balance+p.margin+pnl, updated_at=now() where user_id=uid;
  else
    -- Spot sell releases the quote value; spot buys are represented as inventory positions.
    update public.trading_accounts set spot_balance=spot_balance+(p_mark_price*p.quantity), updated_at=now() where user_id=uid;
  end if;
  return jsonb_build_object('position_id',p.id,'status','closed','realized_pnl',realized,'close_price',p_mark_price);
end $$;

create or replace function public.trading_mark_positions(
  p_symbol text,
  p_market_price numeric
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); p public.trading_positions; should_close boolean; close_result jsonb; updated integer := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_market_price <= 0 then raise exception 'Invalid market price'; end if;
  for p in select * from public.trading_positions where user_id=uid and status='open' and symbol=p_symbol for update loop
    update public.trading_positions
      set mark_price=p_market_price,
          unrealized_pnl=case when side='buy' then (p_market_price-entry_price)*quantity else (entry_price-p_market_price)*quantity end
      where id=p.id;
    updated := updated + 1;
    should_close := (p.take_profit is not null and ((p.side='buy' and p_market_price >= p.take_profit) or (p.side='sell' and p_market_price <= p.take_profit)))
                 or (p.stop_loss is not null and ((p.side='buy' and p_market_price <= p.stop_loss) or (p.side='sell' and p_market_price >= p.stop_loss)));
    if should_close then
      close_result := public.trading_close_position(p.id,p_market_price);
    end if;
  end loop;
  return jsonb_build_object('updated',updated);
end $$;

-- Replace the fill function so each fill creates its own position. This permits
-- multiple simultaneous positions/trades instead of silently merging them.
create or replace function public.trading_fill_order(p_order_id uuid, p_fill_price numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.trading_orders; a public.trading_accounts; pos public.trading_positions; notional numeric; margin numeric;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_fill_price <= 0 then raise exception 'Invalid fill price'; end if;
  select * into o from public.trading_orders where id=p_order_id and user_id=uid and status='pending' for update;
  if o.id is null then raise exception 'Pending order not found'; end if;
  select * into a from public.trading_accounts where user_id=uid for update;
  notional := o.quantity * p_fill_price;
  margin := case when o.mode='futures' then notional / greatest(o.leverage,1) else notional end;

  if o.mode='spot' then
    if o.side='buy' then
      if a.spot_balance < notional then raise exception 'Insufficient Spot balance at execution'; end if;
      update public.trading_accounts set spot_balance=spot_balance-notional, updated_at=now() where user_id=uid;
      insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,status)
      values(uid,'spot',o.symbol,'buy',o.quantity,p_fill_price,p_fill_price,1,notional,0,0,'open');
    else
      select * into pos from public.trading_positions where user_id=uid and mode='spot' and symbol=o.symbol and side='buy' and status='open' order by opened_at asc limit 1 for update;
      if pos.id is null or pos.quantity < o.quantity then raise exception 'Insufficient asset position'; end if;
      update public.trading_accounts set spot_balance=spot_balance+notional, updated_at=now() where user_id=uid;
      if pos.quantity=o.quantity then
        update public.trading_positions set status='closed', mark_price=p_fill_price, unrealized_pnl=0, realized_pnl=(p_fill_price-entry_price)*quantity, closed_at=now() where id=pos.id;
      else
        update public.trading_positions set quantity=quantity-o.quantity, mark_price=p_fill_price, unrealized_pnl=(p_fill_price-entry_price)*(quantity-o.quantity) where id=pos.id;
      end if;
    end if;
  else
    if o.side='buy' or o.side='sell' then
      if a.futures_balance < margin then raise exception 'Insufficient Futures margin at execution'; end if;
      update public.trading_accounts set futures_balance=futures_balance-margin, updated_at=now() where user_id=uid;
      insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,status)
      values(uid,'futures',o.symbol,o.side,o.quantity,p_fill_price,p_fill_price,greatest(o.leverage,1),margin,0,0,'open');
    end if;
  end if;
  update public.trading_orders set status='filled', price=p_fill_price where id=o.id;
  return jsonb_build_object('order_id',o.id,'status','filled','fill_price',p_fill_price);
end $$;

create or replace function public.trading_cancel_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o public.trading_orders;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  update public.trading_orders set status='cancelled'
    where id=p_order_id and user_id=uid and status='pending'
    returning * into o;
  if o.id is null then raise exception 'Pending order not found'; end if;
  return jsonb_build_object('order_id',o.id,'status','cancelled');
end $$;
