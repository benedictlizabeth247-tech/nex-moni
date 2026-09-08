create or replace function public.ensure_internal_trading_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into public.profiles (id, full_name, status, is_verified, trading_access)
  values (auth.uid(), coalesce(auth.jwt()->>'email', 'nexMonie user'), 'active', true, true)
  on conflict (id) do update set
    status = 'active',
    is_verified = true,
    trading_access = true,
    updated_at = now();
end;
$$;

create or replace function public.trading_get_account()
returns public.trading_accounts
language plpgsql security definer set search_path = public
as $$
declare result public.trading_accounts;
begin
  perform public.ensure_internal_trading_profile();
  insert into public.trading_accounts (user_id, funding_balance, spot_balance, futures_balance)
  values (auth.uid(), 0, 0, 0) on conflict (user_id) do nothing;
  select * into result from public.trading_accounts where user_id = auth.uid();
  return result;
end;
$$;

create or replace function public.trading_transfer_from_funding(p_mode text, p_amount numeric)
returns public.trading_accounts
language plpgsql security definer set search_path = public
as $$
declare result public.trading_accounts;
begin
  perform public.ensure_internal_trading_profile();
  if p_mode not in ('spot','futures') or p_amount is null or p_amount <= 0 then raise exception 'INVALID_TRANSFER'; end if;
  if exists (select 1 from public.wallets where user_id = auth.uid() and (status <> 'active' or trading_restricted = true)) then raise exception 'TRADING_RESTRICTED'; end if;
  insert into public.trading_accounts (user_id, funding_balance, spot_balance, futures_balance)
  values (auth.uid(), 0, 0, 0) on conflict (user_id) do nothing;
  select * into result from public.trading_accounts where user_id = auth.uid() for update;
  if result.funding_balance < p_amount then raise exception 'INSUFFICIENT_FUNDING_BALANCE'; end if;
  update public.trading_accounts set
    funding_balance = funding_balance - p_amount,
    spot_balance = spot_balance + case when p_mode = 'spot' then p_amount else 0 end,
    futures_balance = futures_balance + case when p_mode = 'futures' then p_amount else 0 end,
    updated_at = now()
  where user_id = auth.uid() returning * into result;
  return result;
end;
$$;

create or replace function public.trading_execute_order(
  p_user_id uuid, p_mode text, p_symbol text, p_side text, p_order_type text,
  p_quantity numeric, p_execution_price numeric, p_leverage numeric,
  p_take_profit numeric default null, p_stop_loss numeric default null
)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare account_row public.trading_accounts; order_row public.trading_orders; position_row public.trading_positions; margin_required numeric; available_balance numeric;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'NOT_AUTHENTICATED'; end if;
  perform public.ensure_internal_trading_profile();
  if p_mode not in ('spot','futures') or p_side not in ('buy','sell') or p_order_type <> 'market' then raise exception 'INVALID_ORDER'; end if;
  if p_quantity is null or p_quantity <= 0 or p_execution_price is null or p_execution_price <= 0 or p_leverage is null or p_leverage < 1 or p_leverage > 50 then raise exception 'INVALID_ORDER_VALUES'; end if;
  if exists (select 1 from public.wallets where user_id = auth.uid() and (status <> 'active' or trading_restricted = true)) then raise exception 'TRADING_RESTRICTED'; end if;
  insert into public.trading_accounts (user_id, funding_balance, spot_balance, futures_balance) values (auth.uid(),0,0,0) on conflict (user_id) do nothing;
  select * into account_row from public.trading_accounts where user_id = auth.uid() for update;
  margin_required := p_quantity * p_execution_price / case when p_mode = 'futures' then p_leverage else 1 end;
  available_balance := case when p_mode = 'futures' then coalesce(account_row.futures_balance,0) else coalesce(account_row.spot_balance,0) end;
  if available_balance < margin_required then raise exception 'INSUFFICIENT_TRADING_BALANCE'; end if;
  insert into public.trading_orders (user_id,mode,symbol,side,order_type,quantity,price,leverage,margin,status) values (auth.uid(),p_mode,p_symbol,p_side,p_order_type,p_quantity,p_execution_price,p_leverage,margin_required,'filled') returning * into order_row;
  insert into public.trading_positions (user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,realized_pnl,status,opened_at,take_profit,stop_loss) values (auth.uid(),p_mode,p_symbol,p_side,p_quantity,p_execution_price,p_execution_price,p_leverage,margin_required,0,0,'open',now(),p_take_profit,p_stop_loss) returning * into position_row;
  if p_mode = 'futures' then update public.trading_accounts set futures_balance = futures_balance - margin_required, updated_at = now() where user_id = auth.uid(); else update public.trading_accounts set spot_balance = spot_balance - margin_required, updated_at = now() where user_id = auth.uid(); end if;
  return jsonb_build_object('status','filled','order',to_jsonb(order_row),'position',to_jsonb(position_row),'margin',margin_required,'available_before',available_balance,'available_after',available_balance-margin_required);
end;
$$;

revoke all on function public.ensure_internal_trading_profile() from public, anon;
revoke all on function public.trading_get_account() from public, anon;
revoke all on function public.trading_transfer_from_funding(text,numeric) from public, anon;
revoke all on function public.trading_execute_order(uuid,text,text,text,text,numeric,numeric,numeric,numeric,numeric) from public, anon;
grant execute on function public.ensure_internal_trading_profile() to authenticated;
grant execute on function public.trading_get_account() to authenticated;
grant execute on function public.trading_transfer_from_funding(text,numeric) to authenticated;
grant execute on function public.trading_execute_order(uuid,text,text,text,numeric,numeric,numeric,numeric,numeric) to authenticated;
