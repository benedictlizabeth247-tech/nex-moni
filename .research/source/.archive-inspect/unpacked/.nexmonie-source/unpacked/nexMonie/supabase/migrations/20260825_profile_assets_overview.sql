-- Profile/assets enhancement: expose a single exchange-style asset view and
-- support explicit internal transfers in both directions without changing the
-- existing market-data providers.

create or replace function public.trading_transfer_between_accounts(
  p_from text,
  p_to text,
  p_amount numeric
)
returns public.trading_accounts
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); a public.trading_accounts;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_from not in ('funding','spot','futures') or p_to not in ('funding','spot','futures') or p_from = p_to then
    raise exception 'Invalid account transfer';
  end if;
  insert into public.trading_accounts(user_id) values(uid) on conflict (user_id) do nothing;
  select * into a from public.trading_accounts where user_id=uid for update;

  if p_from='funding' and a.funding_balance < p_amount then raise exception 'Insufficient Funding balance'; end if;
  if p_from='spot' and a.spot_balance < p_amount then raise exception 'Insufficient Spot balance'; end if;
  if p_from='futures' and a.futures_balance < p_amount then raise exception 'Insufficient Futures balance'; end if;

  if p_from='funding' then update public.trading_accounts set funding_balance=funding_balance-p_amount where user_id=uid;
  elsif p_from='spot' then update public.trading_accounts set spot_balance=spot_balance-p_amount where user_id=uid;
  else update public.trading_accounts set futures_balance=futures_balance-p_amount where user_id=uid; end if;

  if p_to='funding' then
    update public.trading_accounts set funding_balance=funding_balance+p_amount where user_id=uid;
    update public.wallets set available=available+p_amount, updated_at=now() where user_id=uid;
  elsif p_to='spot' then update public.trading_accounts set spot_balance=spot_balance+p_amount where user_id=uid;
  else update public.trading_accounts set futures_balance=futures_balance+p_amount where user_id=uid; end if;

  update public.trading_accounts set funding_balance=coalesce((select available from public.wallets where user_id=uid),funding_balance), updated_at=now() where user_id=uid;
  select * into a from public.trading_accounts where user_id=uid;
  return a;
end $$;
