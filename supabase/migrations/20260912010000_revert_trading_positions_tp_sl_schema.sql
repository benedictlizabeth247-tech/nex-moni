-- Roll back the TP/SL migration added for the trading preview work.
-- This removes the extra TP/SL schema, function definitions, and projected P/L state.

-- Drop the risk/projection RPCs first so dependent objects can be cleaned up safely.
drop function if exists public.trading_place_order_with_risk(
  uuid,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric
);

drop function if exists public.trading_validate_tp_sl(text, numeric, numeric, numeric);
drop function if exists public.trading_calculate_projected_pnl(text, text, numeric, numeric, numeric, numeric, numeric);

drop index if exists public.trading_positions_tp_sl_status_idx;

alter table public.trading_positions
drop column if exists take_profit,
drop column if exists stop_loss,
drop column if exists tp_projected_pnl,
drop column if exists tp_projected_roi,
drop column if exists sl_projected_pnl,
drop column if exists sl_projected_roi,
drop column if exists tp_status,
drop column if exists sl_status,
drop column if exists tp_triggered_at,
drop column if exists sl_triggered_at,
drop column if exists tp_triggered_price,
drop column if exists sl_triggered_price;

alter table public.trading_orders
drop column if exists take_profit,
drop column if exists stop_loss,
drop column if exists tp_projected_pnl,
drop column if exists tp_projected_roi,
drop column if exists sl_projected_pnl,
drop column if exists sl_projected_roi;

-- Keep the base trading tables intact; only the TP/SL additions are removed.
