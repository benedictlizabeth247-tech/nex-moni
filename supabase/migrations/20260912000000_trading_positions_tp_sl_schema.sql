-- nexMonie TP/SL Live P&L Preview System for All Trading Pairs
-- Adds real TP/SL entry, storage, and projected P&L calculation engine

-- Extend trading_positions with TP/SL fields and projected P&L tracking
alter table public.trading_positions
  add column if not exists take_profit numeric(24,10) null,
  add column if not exists stop_loss numeric(24,10) null,
  add column if not exists tp_projected_pnl numeric(24,10) null,
  add column if not exists tp_projected_roi numeric(10,4) null,
  add column if not exists sl_projected_pnl numeric(24,10) null,
  add column if not exists sl_projected_roi numeric(10,4) null,
  add column if not exists tp_status text check (tp_status in ('active', 'triggered', 'cancelled')) default 'active',
  add column if not exists sl_status text check (sl_status in ('active', 'triggered', 'cancelled')) default 'active',
  add column if not exists tp_triggered_at timestamptz null,
  add column if not exists sl_triggered_at timestamptz null,
  add column if not exists tp_triggered_price numeric(24,10) null,
  add column if not exists sl_triggered_price numeric(24,10) null;

-- Extend trading_orders with TP/SL for order entry
alter table public.trading_orders
  add column if not exists take_profit numeric(24,10) null,
  add column if not exists stop_loss numeric(24,10) null,
  add column if not exists tp_projected_pnl numeric(24,10) null,
  add column if not exists tp_projected_roi numeric(10,4) null,
  add column if not exists sl_projected_pnl numeric(24,10) null,
  add column if not exists sl_projected_roi numeric(10,4) null;

-- Create index on TP/SL status for efficient triggering queries
create index if not exists trading_positions_tp_sl_status_idx
  on public.trading_positions(user_id, tp_status, sl_status)
  where status = 'open';

-- Function to calculate projected P&L for a TP or SL price
-- Returns {pnl: numeric, roi: numeric} based on position economics
create or replace function public.trading_calculate_projected_pnl(
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
  price_diff numeric;
  pnl numeric;
  roi numeric;
begin
  if p_side not in ('buy', 'sell') then
    raise exception 'Invalid side: %', p_side;
  end if;
  if p_mode not in ('spot', 'futures') then
    raise exception 'Invalid mode: %', p_mode;
  end if;
  if p_entry_price <= 0 or p_target_price <= 0 or p_quantity <= 0 then
    return jsonb_build_object('pnl', 0, 'roi', 0);
  end if;

  -- Calculate price difference
  price_diff := p_target_price - p_entry_price;

  -- For long positions: positive price diff = profit, negative = loss
  -- For short positions: negative price diff = profit, positive = loss
  if p_side = 'buy' then
    pnl := price_diff * p_quantity;
  else -- sell (short)
    pnl := -price_diff * p_quantity;
  end if;

  -- Calculate ROI based on initial margin (or spot notional)
  if p_margin > 0 then
    roi := (pnl / p_margin) * 100;
  else
    roi := 0;
  end if;

  return jsonb_build_object(
    'pnl', pnl,
    'roi', roi,
    'price_diff', price_diff
  );
end $$;

-- Function to validate TP/SL prices for direction and entry
create or replace function public.trading_validate_tp_sl(
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
  errors text[] := array[]::text[];
begin
  if p_side = 'buy' then
    -- Long: TP must be above entry, SL must be below entry
    if p_tp_price is not null and p_tp_price <= p_entry_price then
      errors := array_append(errors, 'TP must be above entry price for long positions');
    end if;
    if p_sl_price is not null and p_sl_price >= p_entry_price then
      errors := array_append(errors, 'SL must be below entry price for long positions');
    end if;
  elsif p_side = 'sell' then
    -- Short: TP must be below entry, SL must be above entry
    if p_tp_price is not null and p_tp_price >= p_entry_price then
      errors := array_append(errors, 'TP must be below entry price for short positions');
    end if;
    if p_sl_price is not null and p_sl_price <= p_entry_price then
      errors := array_append(errors, 'SL must be above entry price for short positions');
    end if;
  end if;

  return jsonb_build_object(
    'valid', array_length(errors, 1) is null,
    'errors', errors
  );
end $$;

-- Extended order placement RPC that accepts TP/SL and calculates projections
create or replace function public.trading_place_order_with_risk(
  p_user_id uuid,
  p_mode text,
  p_symbol text,
  p_side text,
  p_order_type text,
  p_quantity numeric,
  p_execution_price numeric,
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
  uid uuid := p_user_id;
  a public.trading_accounts;
  o public.trading_orders;
  pos public.trading_positions;
  notional numeric;
  margin numeric;
  tp_projection jsonb;
  sl_projection jsonb;
  validation jsonb;
  realized numeric := 0;
begin
  -- Validate TP/SL if provided
  if p_take_profit is not null or p_stop_loss is not null then
    validation := trading_validate_tp_sl(p_side, p_execution_price, p_take_profit, p_stop_loss);
    if not (validation -> 'valid')::boolean then
      raise exception 'Invalid TP/SL: %', array_to_string(validation -> 'errors', ', ');
    end if;
  end if;

  -- Calculate position economics
  notional := p_quantity * p_execution_price;
  margin := case when p_mode = 'futures' then notional / greatest(p_leverage, 1) else notional end;

  -- Calculate projected P&L for TP and SL
  if p_take_profit is not null then
    tp_projection := trading_calculate_projected_pnl(
      p_side, p_mode, p_execution_price, p_take_profit,
      p_quantity, margin, p_leverage
    );
  else
    tp_projection := jsonb_build_object('pnl', null, 'roi', null);
  end if;

  if p_stop_loss is not null then
    sl_projection := trading_calculate_projected_pnl(
      p_side, p_mode, p_execution_price, p_stop_loss,
      p_quantity, margin, p_leverage
    );
  else
    sl_projection := jsonb_build_object('pnl', null, 'roi', null);
  end if;

  -- Verify user has sufficient balance
  select * into a from public.trading_accounts where user_id = uid for update;
  if a.id is null then
    insert into public.trading_accounts(user_id) values(uid);
    select * into a from public.trading_accounts where user_id = uid for update;
  end if;

  if p_mode = 'spot' then
    if a.spot_balance < margin then
      raise exception 'Insufficient spot balance';
    end if;
    update public.trading_accounts set spot_balance = spot_balance - margin where user_id = uid;
  else
    if a.futures_balance < margin then
      raise exception 'Insufficient futures margin';
    end if;
    update public.trading_accounts set futures_balance = futures_balance - margin where user_id = uid;
  end if;

  -- Create the order with TP/SL and projections
  insert into public.trading_orders(
    user_id, mode, symbol, side, order_type, quantity, price, leverage, margin,
    take_profit, stop_loss,
    tp_projected_pnl, tp_projected_roi,
    sl_projected_pnl, sl_projected_roi,
    status, created_at
  ) values (
    uid, p_mode, p_symbol, p_side, p_order_type, p_quantity, p_execution_price, p_leverage, margin,
    p_take_profit, p_stop_loss,
    (tp_projection -> 'pnl')::numeric,
    (tp_projection -> 'roi')::numeric,
    (sl_projection -> 'pnl')::numeric,
    (sl_projection -> 'roi')::numeric,
    'filled', now()
  ) returning * into o;

  -- Create or open the position
  insert into public.trading_positions(
    user_id, mode, symbol, side, quantity, entry_price, mark_price, leverage, margin,
    take_profit, stop_loss,
    tp_projected_pnl, tp_projected_roi,
    sl_projected_pnl, sl_projected_roi,
    unrealized_pnl, status, opened_at
  ) values (
    uid, p_mode, p_symbol, p_side, p_quantity, p_execution_price, p_execution_price, p_leverage, margin,
    p_take_profit, p_stop_loss,
    (tp_projection -> 'pnl')::numeric,
    (tp_projection -> 'roi')::numeric,
    (sl_projection -> 'pnl')::numeric,
    (sl_projection -> 'roi')::numeric,
    0, 'open', now()
  ) returning * into pos;

  return jsonb_build_object(
    'status', 'filled',
    'order_id', o.id,
    'position_id', pos.id,
    'symbol', p_symbol,
    'side', p_side,
    'quantity', p_quantity,
    'entry_price', p_execution_price,
    'margin', margin,
    'leverage', p_leverage,
    'take_profit', p_take_profit,
    'stop_loss', p_stop_loss,
    'tp_projected_pnl', (tp_projection -> 'pnl')::numeric,
    'tp_projected_roi', (tp_projection -> 'roi')::numeric,
    'sl_projected_pnl', (sl_projection -> 'pnl')::numeric,
    'sl_projected_roi', (sl_projection -> 'roi')::numeric
  );
end $$;

revoke all on function public.trading_calculate_projected_pnl(text,text,numeric,numeric,numeric,numeric,numeric)
  from public, anon;
grant execute on function public.trading_calculate_projected_pnl(text,text,numeric,numeric,numeric,numeric,numeric)
  to authenticated;

revoke all on function public.trading_validate_tp_sl(text,numeric,numeric,numeric)
  from public, anon;
grant execute on function public.trading_validate_tp_sl(text,numeric,numeric,numeric)
  to authenticated;

revoke all on function public.trading_place_order_with_risk(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric)
  from public, anon;
grant execute on function public.trading_place_order_with_risk(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric)
  to service_role;

comment on function public.trading_calculate_projected_pnl(text,text,numeric,numeric,numeric,numeric,numeric)
is 'Calculates projected P&L and ROI for a TP or SL price based on position economics, direction, and mode.';

comment on function public.trading_validate_tp_sl(text,numeric,numeric,numeric)
is 'Validates TP/SL prices for direction-aware correctness (long/short logic).';

comment on function public.trading_place_order_with_risk(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric)
is 'Places a trading order with immediate TP/SL entry and projected P&L calculation, persisting all state for all trading pairs.';
