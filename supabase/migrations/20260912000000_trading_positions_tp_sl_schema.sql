-- nexMonie Trading: TP/SL Live P&L Preview System
-- Adds comprehensive take-profit and stop-loss support with real-time P&L projections.
-- This migration extends the existing trading_positions and trading_orders tables with:
-- - TP/SL fields that are pair-agnostic and direction-aware
-- - Projected P&L fields for instant UI feedback
-- - Status tracking for TP/SL triggers
-- - Support for all leverage levels and margin models

-- Extend trading_positions with TP/SL fields
alter table public.trading_positions
  add column if not exists take_profit_price numeric(24,10),
  add column if not exists stop_loss_price numeric(24,10),
  add column if not exists tp_status text default 'active' check (tp_status in ('active', 'triggered', 'cancelled')),
  add column if not exists sl_status text default 'active' check (sl_status in ('active', 'triggered', 'cancelled')),
  add column if not exists tp_projected_pnl numeric(24,10),
  add column if not exists tp_projected_roi numeric(10,4),
  add column if not exists sl_projected_pnl numeric(24,10),
  add column if not exists sl_projected_roi numeric(10,4),
  add column if not exists tp_triggered_at timestamptz,
  add column if not exists sl_triggered_at timestamptz,
  add column if not exists closed_at timestamptz;

-- Create indexes for efficient TP/SL queries
create index if not exists trading_positions_tp_sl_active_idx 
  on public.trading_positions(user_id, status, tp_status, sl_status) 
  where status = 'open' and (tp_status = 'active' or sl_status = 'active');

create index if not exists trading_positions_symbol_status_idx 
  on public.trading_positions(symbol, status) 
  where status = 'open';

-- Extend trading_orders with TP/SL fields for persistence
alter table public.trading_orders
  add column if not exists take_profit_price numeric(24,10),
  add column if not exists stop_loss_price numeric(24,10),
  add column if not exists position_id uuid references public.trading_positions(id) on delete set null;

-- Create helper function to validate TP/SL against entry price (direction-aware)
create or replace function public.validate_tp_sl(
  p_side text,
  p_entry_price numeric,
  p_tp_price numeric,
  p_sl_price numeric
)
returns jsonb
language plpgsql
immutable
as $$
declare
  errors text[];
begin
  -- For LONG positions: TP must be above entry, SL must be below entry
  if p_side = 'buy' then
    if p_tp_price is not null and p_tp_price <= p_entry_price then
      errors := array_append(errors, 'Take Profit must be above entry price for long positions');
    end if;
    if p_sl_price is not null and p_sl_price >= p_entry_price then
      errors := array_append(errors, 'Stop Loss must be below entry price for long positions');
    end if;
  -- For SHORT positions: TP must be below entry, SL must be above entry
  elsif p_side = 'sell' then
    if p_tp_price is not null and p_tp_price >= p_entry_price then
      errors := array_append(errors, 'Take Profit must be below entry price for short positions');
    end if;
    if p_sl_price is not null and p_sl_price <= p_entry_price then
      errors := array_append(errors, 'Stop Loss must be above entry price for short positions');
    end if;
  end if;

  -- Check that TP and SL don't cross
  if p_tp_price is not null and p_sl_price is not null then
    if p_side = 'buy' and p_sl_price >= p_tp_price then
      errors := array_append(errors, 'Stop Loss cannot be at or above Take Profit for long positions');
    elsif p_side = 'sell' and p_tp_price >= p_sl_price then
      errors := array_append(errors, 'Take Profit cannot be at or above Stop Loss for short positions');
    end if;
  end if;

  return jsonb_build_object(
    'valid', coalesce(array_length(errors, 1), 0) = 0,
    'errors', coalesce(errors, array[]::text[])
  );
end $$;

-- Create function to calculate projected P&L (direction-aware, leverage-aware)
create or replace function public.calculate_projected_pnl(
  p_side text,
  p_mode text,
  p_entry_price numeric,
  p_target_price numeric,
  p_quantity numeric,
  p_margin numeric,
  p_leverage numeric default 1
)
returns jsonb
language plpgsql
immutable
as $$
declare
  price_change numeric;
  pnl_amount numeric;
  roi_percent numeric;
begin
  if not (p_side in ('buy', 'sell')) or p_target_price <= 0 or p_quantity <= 0 then
    return jsonb_build_object('pnl_amount', null, 'roi_percent', null, 'error', 'Invalid parameters');
  end if;

  -- Calculate directional P&L
  if p_side = 'buy' then
    pnl_amount := (p_target_price - p_entry_price) * p_quantity;
  else -- sell
    pnl_amount := (p_entry_price - p_target_price) * p_quantity;
  end if;

  -- Calculate ROI based on actual margin used
  if p_margin > 0 then
    roi_percent := (pnl_amount / p_margin) * 100;
  else
    roi_percent := 0;
  end if;

  return jsonb_build_object(
    'pnl_amount', pnl_amount,
    'roi_percent', roi_percent,
    'side', p_side,
    'mode', p_mode,
    'target_price', p_target_price,
    'entry_price', p_entry_price
  );
end $$;

-- Create function to update TP/SL projected values
create or replace function public.update_position_tp_sl_projections(
  p_position_id uuid,
  p_tp_price numeric,
  p_sl_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pos public.trading_positions;
  tp_proj jsonb;
  sl_proj jsonb;
begin
  select * into pos from public.trading_positions where id = p_position_id for update;
  
  if pos.id is null then
    return jsonb_build_object('error', 'Position not found');
  end if;

  -- Calculate TP projection if provided
  if p_tp_price is not null and p_tp_price > 0 then
    tp_proj := public.calculate_projected_pnl(
      pos.side,
      pos.mode,
      pos.entry_price,
      p_tp_price,
      pos.quantity,
      pos.margin,
      pos.leverage
    );
    
    update public.trading_positions
    set
      take_profit_price = p_tp_price,
      tp_projected_pnl = (tp_proj->>'pnl_amount')::numeric,
      tp_projected_roi = (tp_proj->>'roi_percent')::numeric
    where id = pos.id;
  end if;

  -- Calculate SL projection if provided
  if p_sl_price is not null and p_sl_price > 0 then
    sl_proj := public.calculate_projected_pnl(
      pos.side,
      pos.mode,
      pos.entry_price,
      p_sl_price,
      pos.quantity,
      pos.margin,
      pos.leverage
    );
    
    update public.trading_positions
    set
      stop_loss_price = p_sl_price,
      sl_projected_pnl = (sl_proj->>'pnl_amount')::numeric,
      sl_projected_roi = (sl_proj->>'roi_percent')::numeric
    where id = pos.id;
  end if;

  return jsonb_build_object(
    'position_id', pos.id,
    'tp_price', p_tp_price,
    'tp_projected_pnl', (tp_proj->>'pnl_amount')::numeric,
    'tp_projected_roi', (tp_proj->>'roi_percent')::numeric,
    'sl_price', p_sl_price,
    'sl_projected_pnl', (sl_proj->>'pnl_amount')::numeric,
    'sl_projected_roi', (sl_proj->>'roi_percent')::numeric
  );
end $$;

-- Enhanced trading_place_order RPC to accept TP/SL
create or replace function public.trading_place_order_with_risk(
  p_mode text,
  p_symbol text,
  p_side text,
  p_order_type text,
  p_quantity numeric,
  p_price numeric,
  p_leverage numeric default 1,
  p_take_profit numeric default null,
  p_stop_loss numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.trading_accounts;
  o public.trading_orders;
  pos public.trading_positions;
  notional numeric;
  margin numeric;
  validation jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_quantity <= 0 or p_price <= 0 then raise exception 'Invalid order size'; end if;
  if p_side not in ('buy','sell') then raise exception 'Invalid order side'; end if;
  if p_mode not in ('spot','futures') then raise exception 'Invalid trading mode'; end if;

  -- Validate TP/SL if provided
  if p_take_profit is not null or p_stop_loss is not null then
    validation := public.validate_tp_sl(p_side, p_price, p_take_profit, p_stop_loss);
    if not (validation->>'valid')::boolean then
      raise exception 'Invalid TP/SL configuration: %', validation->>'errors';
    end if;
  end if;

  insert into public.trading_accounts(user_id) values(uid) on conflict (user_id) do nothing;
  select * into a from public.trading_accounts where user_id = uid for update;

  notional := p_quantity * p_price;
  margin := case when p_mode='futures' then notional / greatest(p_leverage,1) else notional end;

  if p_mode = 'spot' then
    if p_side = 'buy' then
      if a.spot_balance < notional then raise exception 'Insufficient Spot balance'; end if;
      update public.trading_accounts set spot_balance = spot_balance - notional where user_id=uid;
    else
      select * into pos from public.trading_positions where user_id=uid and mode='spot' and symbol=p_symbol and side='buy' and status='open' order by opened_at desc limit 1 for update;
      if pos.id is null or pos.quantity < p_quantity then raise exception 'Insufficient asset position'; end if;
      update public.trading_accounts set spot_balance = spot_balance + notional where user_id=uid;
      if pos.quantity = p_quantity then 
        update public.trading_positions set status='closed', mark_price=p_price, unrealized_pnl=(p_price-entry_price)*quantity, closed_at=now() where id=pos.id;
      else 
        update public.trading_positions set quantity=quantity-p_quantity, mark_price=p_price, unrealized_pnl=(p_price-entry_price)*(quantity-p_quantity) where id=pos.id; 
      end if;
    end if;
  else
    if a.futures_balance < margin then raise exception 'Insufficient Futures margin'; end if;
    update public.trading_accounts set futures_balance = futures_balance - margin where user_id=uid;
  end if;

  insert into public.trading_orders(user_id,mode,symbol,side,order_type,quantity,price,leverage,margin,take_profit_price,stop_loss_price,status)
  values(uid,p_mode,p_symbol,p_side,p_order_type,p_quantity,p_price,greatest(p_leverage,1),margin,p_take_profit,p_stop_loss,'filled') 
  returning * into o;

  if p_mode='spot' and p_side='buy' then
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status,take_profit_price,stop_loss_price)
    values(uid,'spot',p_symbol,'buy',p_quantity,p_price,p_price,1,notional,0,'open',p_take_profit,p_stop_loss)
    returning * into pos;
  elsif p_mode='futures' then
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status,take_profit_price,stop_loss_price)
    values(uid,'futures',p_symbol,p_side,p_quantity,p_price,p_price,greatest(p_leverage,1),margin,0,'open',p_take_profit,p_stop_loss)
    returning * into pos;
  end if;

  -- Update projected P&L values
  if p_take_profit is not null or p_stop_loss is not null then
    perform public.update_position_tp_sl_projections(pos.id, p_take_profit, p_stop_loss);
  end if;

  return jsonb_build_object(
    'order_id', o.id,
    'position_id', pos.id,
    'status', o.status,
    'price', o.price,
    'quantity', o.quantity,
    'margin', o.margin,
    'take_profit', p_take_profit,
    'stop_loss', p_stop_loss,
    'tp_projected_pnl', pos.tp_projected_pnl,
    'tp_projected_roi', pos.tp_projected_roi,
    'sl_projected_pnl', pos.sl_projected_pnl,
    'sl_projected_roi', pos.sl_projected_roi
  );
end $$;

grant execute on function public.validate_tp_sl(text, numeric, numeric, numeric) to authenticated, anon;
grant execute on function public.calculate_projected_pnl(text, text, numeric, numeric, numeric, numeric, numeric) to authenticated, anon;
grant execute on function public.update_position_tp_sl_projections(uuid, numeric, numeric) to authenticated;
grant execute on function public.trading_place_order_with_risk(text, text, text, text, numeric, numeric, numeric, numeric, numeric) to authenticated;
