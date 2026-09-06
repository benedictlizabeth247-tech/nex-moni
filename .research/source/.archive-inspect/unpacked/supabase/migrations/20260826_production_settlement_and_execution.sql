-- Production settlement/execution hardening.
-- External provider credentials stay server-only. No client can mint financial value.

create table if not exists public.fiat_payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('paystack','flutterwave')),
  reference text not null unique,
  provider_id text,
  amount numeric(24,8) not null check (amount > 0),
  currency text not null,
  status text not null default 'pending' check (status in ('pending','credited','failed','reversed')),
  credited_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fiat_payment_intents_user_idx on public.fiat_payment_intents(user_id, created_at desc);
alter table public.fiat_payment_intents enable row level security;
drop policy if exists fiat_payment_intents_owner on public.fiat_payment_intents;
create policy fiat_payment_intents_owner on public.fiat_payment_intents for select using (auth.uid() = user_id);

create table if not exists public.exchange_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference text not null unique,
  kind text not null,
  asset text not null,
  amount numeric(30,12) not null,
  fee numeric(30,12) not null default 0,
  status text not null default 'posted' check (status in ('posted','reversed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists exchange_ledger_user_idx on public.exchange_ledger(user_id, created_at desc);
alter table public.exchange_ledger enable row level security;
drop policy if exists exchange_ledger_owner on public.exchange_ledger;
create policy exchange_ledger_owner on public.exchange_ledger for select using (auth.uid() = user_id);

create or replace function public.credit_fiat_deposit(p_user_id uuid, p_amount numeric, p_reference text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare existing public.exchange_ledger; tx public.wallet_transactions; w public.wallets; result jsonb;
begin
  if p_amount <= 0 then raise exception 'Invalid deposit amount'; end if;
  select * into existing from public.exchange_ledger where reference = p_reference for update;
  if existing.id is not null then return jsonb_build_object('status','already_posted','ledger_id',existing.id); end if;
  insert into public.wallets(user_id) values(p_user_id) on conflict (user_id) do nothing;
  select * into w from public.wallets where user_id=p_user_id for update;
  update public.wallets set available = available + p_amount, updated_at = now() where user_id = p_user_id;
  insert into public.wallet_transactions(user_id, wallet_id, amount, type, title, category, balance_field, status, reference_id, recipient, metadata, created_at)
  values(p_user_id, w.id, p_amount, 'income', 'Fiat deposit', 'Deposit', 'available', 'completed', p_reference, null, jsonb_build_object('provider','paystack'), now()) returning * into tx;
  insert into public.exchange_ledger(user_id, reference, kind, asset, amount, metadata)
  values(p_user_id, p_reference, 'fiat_deposit', 'NGN', p_amount, jsonb_build_object('transaction_id',tx.id));
  result := jsonb_build_object('status','posted','transaction_id',tx.id,'amount',p_amount);
  return result;
end $$;

-- Orders must use a fresh server-resolved market price. The browser no longer supplies execution price.
create or replace function public.trading_execute_order(
  p_user_id uuid, p_mode text, p_symbol text, p_side text, p_order_type text,
  p_quantity numeric, p_execution_price numeric, p_leverage numeric default 1
) returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.trading_accounts; o public.trading_orders; pos public.trading_positions; notional numeric; margin numeric; ref text;
begin
  if p_user_id is null then raise exception 'User required'; end if;
  if p_mode not in ('spot','futures') then raise exception 'Invalid mode'; end if;
  if p_side not in ('buy','sell') then raise exception 'Invalid side'; end if;
  if p_quantity <= 0 or p_execution_price <= 0 then raise exception 'Invalid order'; end if;
  insert into public.trading_accounts(user_id) values(p_user_id) on conflict (user_id) do nothing;
  select * into a from public.trading_accounts where user_id=p_user_id for update;
  notional := p_quantity * p_execution_price;
  margin := case when p_mode='futures' then notional / greatest(p_leverage,1) else notional end;
  if p_mode='spot' and p_side='buy' and a.spot_balance < notional then raise exception 'Insufficient Spot balance'; end if;
  if p_mode='futures' and a.futures_balance < margin then raise exception 'Insufficient Futures margin'; end if;
  if p_mode='spot' and p_side='sell' then
    select * into pos from public.trading_positions where user_id=p_user_id and mode='spot' and symbol=p_symbol and side='buy' and status='open' order by opened_at desc limit 1 for update;
    if pos.id is null or pos.quantity < p_quantity then raise exception 'Insufficient asset position'; end if;
  end if;
  if p_mode='spot' and p_side='buy' then update public.trading_accounts set spot_balance=spot_balance-notional where user_id=p_user_id;
  elsif p_mode='futures' then update public.trading_accounts set futures_balance=futures_balance-margin where user_id=p_user_id; end if;
  ref := 'EXE-' || replace(gen_random_uuid()::text,'-','');
  insert into public.trading_orders(user_id,mode,symbol,side,order_type,quantity,price,leverage,margin,status)
  values(p_user_id,p_mode,p_symbol,p_side,p_order_type,p_quantity,p_execution_price,greatest(p_leverage,1),margin,'filled') returning * into o;
  if p_mode='spot' and p_side='buy' then
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status)
    values(p_user_id,'spot',p_symbol,'buy',p_quantity,p_execution_price,p_execution_price,1,notional,0,'open');
  elsif p_mode='spot' and p_side='sell' then
    if pos.quantity=p_quantity then update public.trading_positions set status='closed', mark_price=p_execution_price, unrealized_pnl=(p_execution_price-entry_price)*quantity where id=pos.id;
    else update public.trading_positions set quantity=quantity-p_quantity, mark_price=p_execution_price, unrealized_pnl=(p_execution_price-entry_price)*(quantity-p_quantity) where id=pos.id; end if;
    update public.trading_accounts set spot_balance=spot_balance+notional where user_id=p_user_id;
  elsif p_mode='futures' then
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status)
    values(p_user_id,'futures',p_symbol,p_side,p_quantity,p_execution_price,p_execution_price,greatest(p_leverage,1),margin,0,'open');
  end if;
  insert into public.exchange_ledger(user_id,reference,kind,asset,amount,metadata)
  values(p_user_id,ref,'exchange_execution',p_symbol,p_quantity,jsonb_build_object('order_id',o.id,'mode',p_mode,'side',p_side,'price',p_execution_price,'notional',notional));
  return jsonb_build_object('order_id',o.id,'status','filled','price',p_execution_price,'quantity',p_quantity,'margin',margin,'reference',ref);
end $$;

revoke execute on function public.trading_execute_order(uuid,text,text,text,text,numeric,numeric,numeric) from public, anon, authenticated;
grant execute on function public.trading_execute_order(uuid,text,text,text,text,numeric,numeric,numeric) to service_role;
