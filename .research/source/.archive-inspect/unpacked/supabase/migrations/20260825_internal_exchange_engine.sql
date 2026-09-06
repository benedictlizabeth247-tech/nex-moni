-- nexMonie/VU internal exchange engine.
-- Market data remains read-only from the existing provider architecture.
-- Orders, balances, positions and P&L are owned by nexMonie/VU.

create table if not exists public.trading_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  funding_balance numeric(24,8) not null default 0,
  spot_balance numeric(24,8) not null default 0,
  futures_balance numeric(24,8) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.trading_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('spot','futures')),
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  order_type text not null check (order_type in ('market','limit','stop')),
  quantity numeric(24,10) not null check (quantity > 0),
  price numeric(24,10) not null check (price > 0),
  leverage numeric(10,2) not null default 1,
  margin numeric(24,10) not null default 0,
  status text not null default 'filled',
  created_at timestamptz not null default now()
);

create table if not exists public.trading_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('spot','futures')),
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  quantity numeric(24,10) not null check (quantity > 0),
  entry_price numeric(24,10) not null,
  mark_price numeric(24,10) not null,
  leverage numeric(10,2) not null default 1,
  margin numeric(24,10) not null default 0,
  unrealized_pnl numeric(24,10) not null default 0,
  status text not null default 'open',
  opened_at timestamptz not null default now()
);

alter table public.trading_accounts enable row level security;
alter table public.trading_orders enable row level security;
alter table public.trading_positions enable row level security;

drop policy if exists trading_accounts_owner on public.trading_accounts;
create policy trading_accounts_owner on public.trading_accounts for select using (auth.uid() = user_id);
drop policy if exists trading_orders_owner on public.trading_orders;
create policy trading_orders_owner on public.trading_orders for select using (auth.uid() = user_id);
drop policy if exists trading_positions_owner on public.trading_positions;
create policy trading_positions_owner on public.trading_positions for select using (auth.uid() = user_id);

create or replace function public.trading_get_account()
returns setof public.trading_accounts
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  insert into public.trading_accounts(user_id) values(uid) on conflict (user_id) do nothing;
  update public.trading_accounts set funding_balance = coalesce((select available from public.wallets where user_id=uid),0), updated_at=now() where user_id=uid;
  return query select * from public.trading_accounts where user_id = uid;
end $$;

create or replace function public.trading_transfer_from_funding(p_mode text, p_amount numeric)
returns public.trading_accounts
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); a public.trading_accounts; w public.wallets;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_mode not in ('spot','futures') then raise exception 'Invalid trading account'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select * into w from public.wallets where user_id = uid for update;
  if w.available < p_amount then raise exception 'Insufficient funding balance'; end if;
  insert into public.trading_accounts(user_id) values(uid) on conflict (user_id) do nothing;
  update public.wallets set available = available - p_amount, updated_at = now() where user_id = uid;
  update public.trading_accounts set funding_balance = (select available from public.wallets where user_id=uid) where user_id=uid;
  if p_mode = 'spot' then
    update public.trading_accounts set spot_balance = spot_balance + p_amount, updated_at = now() where user_id = uid;
  else
    update public.trading_accounts set futures_balance = futures_balance + p_amount, updated_at = now() where user_id = uid;
  end if;
  select * into a from public.trading_accounts where user_id = uid;
  return a;
end $$;

create or replace function public.trading_place_order(
  p_mode text, p_symbol text, p_side text, p_order_type text,
  p_quantity numeric, p_price numeric, p_leverage numeric default 1
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); a public.trading_accounts; o public.trading_orders; pos public.trading_positions;
       notional numeric := p_quantity * p_price; margin numeric := case when p_mode='futures' then notional / greatest(p_leverage,1) else notional end;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_quantity <= 0 or p_price <= 0 then raise exception 'Invalid order size'; end if;
  if p_side not in ('buy','sell') then raise exception 'Invalid order side'; end if;
  insert into public.trading_accounts(user_id) values(uid) on conflict (user_id) do nothing;
  select * into a from public.trading_accounts where user_id = uid for update;

  if p_mode = 'spot' then
    if p_side = 'buy' then
      if a.spot_balance < notional then raise exception 'Insufficient Spot balance'; end if;
      update public.trading_accounts set spot_balance = spot_balance - notional where user_id=uid;
    else
      select * into pos from public.trading_positions where user_id=uid and mode='spot' and symbol=p_symbol and side='buy' and status='open' order by opened_at desc limit 1 for update;
      if pos.id is null or pos.quantity < p_quantity then raise exception 'Insufficient asset position'; end if;
      update public.trading_accounts set spot_balance = spot_balance + notional where user_id=uid;
      if pos.quantity = p_quantity then update public.trading_positions set status='closed', mark_price=p_price, unrealized_pnl=(p_price-entry_price)*quantity where id=pos.id;
      else update public.trading_positions set quantity=quantity-p_quantity, mark_price=p_price, unrealized_pnl=(p_price-entry_price)*(quantity-p_quantity) where id=pos.id; end if;
    end if;
  else
    if a.futures_balance < margin then raise exception 'Insufficient Futures margin'; end if;
    update public.trading_accounts set futures_balance = futures_balance - margin where user_id=uid;
  end if;

  insert into public.trading_orders(user_id,mode,symbol,side,order_type,quantity,price,leverage,margin,status)
  values(uid,p_mode,p_symbol,p_side,p_order_type,p_quantity,p_price,greatest(p_leverage,1),margin,'filled') returning * into o;

  if p_mode='spot' and p_side='buy' then
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status)
    values(uid,'spot',p_symbol,'buy',p_quantity,p_price,p_price,1,notional,0,'open');
  elsif p_mode='futures' then
    insert into public.trading_positions(user_id,mode,symbol,side,quantity,entry_price,mark_price,leverage,margin,unrealized_pnl,status)
    values(uid,'futures',p_symbol,p_side,p_quantity,p_price,p_price,greatest(p_leverage,1),margin,0,'open');
  end if;

  return jsonb_build_object('order_id',o.id,'status',o.status,'price',o.price,'quantity',o.quantity,'margin',o.margin);
end $$;

create or replace function public.trading_close_position(p_position_id uuid, p_mark_price numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); p public.trading_positions; pnl numeric; a public.trading_accounts;
begin
  select * into p from public.trading_positions where id=p_position_id and user_id=uid and status='open' for update;
  if p.id is null then raise exception 'Position not found'; end if;
  pnl := case when p.side='buy' then (p_mark_price-p.entry_price)*p.quantity else (p.entry_price-p_mark_price)*p.quantity end;
  update public.trading_positions set mark_price=p_mark_price, unrealized_pnl=pnl, status='closed' where id=p.id;
  if p.mode='futures' then update public.trading_accounts set futures_balance=futures_balance+p.margin+pnl, updated_at=now() where user_id=uid;
  else update public.trading_accounts set spot_balance=spot_balance+(p_mark_price*p.quantity), updated_at=now() where user_id=uid; end if;
  return jsonb_build_object('position_id',p.id,'realized_pnl',pnl);
end $$;
