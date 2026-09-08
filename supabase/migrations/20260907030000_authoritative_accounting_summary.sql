-- Authoritative account projection for Home, Finance, Spot and Futures.
create or replace function public.trading_account_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.trading_accounts;
  open_pnl numeric := 0;
  used_margin numeric := 0;
  settled_cash numeric := 0;
  equity numeric := 0;
  available_margin numeric := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.trading_accounts(user_id) values (uid) on conflict (user_id) do nothing;
  select * into a from public.trading_accounts where user_id = uid;
  select coalesce(sum(unrealized_pnl), 0), coalesce(sum(case when mode = 'futures' then margin else 0 end), 0)
    into open_pnl, used_margin
    from public.trading_positions
   where user_id = uid and status = 'open';
  settled_cash := coalesce(a.spot_balance, 0) + coalesce(a.futures_balance, 0);
  equity := settled_cash + used_margin + open_pnl;
  available_margin := settled_cash + open_pnl;
  return jsonb_build_object(
    'user_id', uid,
    'settled_balance', round(settled_cash, 8),
    'equity', round(equity, 8),
    'used_margin', round(used_margin, 8),
    'available_margin', round(available_margin, 8),
    'unrealized_pnl', round(open_pnl, 8),
    'spot_balance', round(coalesce(a.spot_balance, 0), 8),
    'futures_balance', round(coalesce(a.futures_balance, 0), 8),
    'funding_balance', round(coalesce(a.funding_balance, 0), 8),
    'updated_at', now()
  );
end;
$$;

create or replace function public.trading_mark_positions(p_symbol text, p_market_price numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  changed integer := 0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_market_price is null or p_market_price <= 0 then raise exception 'Invalid market price'; end if;
  update public.trading_positions
     set mark_price = p_market_price,
         unrealized_pnl = case when side = 'buy' then (p_market_price - entry_price) * quantity else (entry_price - p_market_price) * quantity end
   where user_id = uid and status = 'open' and symbol = p_symbol;
  get diagnostics changed = row_count;
  return jsonb_build_object('updated', changed, 'summary', public.trading_account_summary());
end;
$$;

revoke all on function public.trading_account_summary() from public, anon;
grant execute on function public.trading_account_summary() to authenticated;
revoke all on function public.trading_mark_positions(text,numeric) from public, anon;
grant execute on function public.trading_mark_positions(text,numeric) to authenticated;
