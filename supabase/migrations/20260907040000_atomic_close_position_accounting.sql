create or replace function public.trading_close_position(p_position_id uuid,p_mark_price numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid();
  p public.trading_positions;
  realized numeric;
  ref text;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_mark_price is null or p_mark_price<=0 then raise exception 'INVALID_MARK_PRICE'; end if;
  select * into p from public.trading_positions
  where id=p_position_id and user_id=uid and status='open' for update;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;
  realized:=case when p.side='buy'
    then (p_mark_price-p.entry_price)*p.quantity
    else (p.entry_price-p_mark_price)*p.quantity end;
  if p.mode='futures' then
    update public.trading_accounts
    set futures_balance=futures_balance+p.margin+realized,updated_at=now()
    where user_id=uid;
  elsif p.mode='spot' then
    update public.trading_accounts
    set spot_balance=spot_balance+p.margin+realized,updated_at=now()
    where user_id=uid;
  else
    raise exception 'INVALID_POSITION_MODE';
  end if;
  update public.trading_positions
  set mark_price=p_mark_price,unrealized_pnl=0,realized_pnl=realized,status='closed',closed_at=now()
  where id=p.id;
  ref:='CLOSE-'||replace(gen_random_uuid()::text,'-','');
  insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata)
  values(uid,ref,'position_close',p.symbol,realized,jsonb_build_object(
    'position_id',p.id,'mode',p.mode,'side',p.side,'quantity',p.quantity,
    'entry_price',p.entry_price,'exit_price',p_mark_price,'realized_pnl',realized,
    'released_margin',p.margin));
  return jsonb_build_object('status','closed','position_id',p.id,'realized_pnl',realized,'mark_price',p_mark_price,'reference',ref);
end;
$$;
revoke all on function public.trading_close_position(uuid,numeric) from public,anon;
grant execute on function public.trading_close_position(uuid,numeric) to authenticated;
