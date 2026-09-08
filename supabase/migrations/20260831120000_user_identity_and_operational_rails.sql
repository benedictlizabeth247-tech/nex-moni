-- nexMonie operational identity + rail configuration hardening.
-- This migration intentionally creates configuration contracts without inventing
-- bank details, crypto addresses, fees, or commissions that the founders have not supplied.

create extension if not exists pgcrypto;

-- ================================================================
-- 1. Private 10-digit nexMonie transfer ID
-- ================================================================

create or replace function public.generate_nex_user_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
  bytes bytea;
begin
  loop
    bytes := gen_random_bytes(10);
    candidate :=
      ((get_byte(bytes,0) % 9) + 1)::text ||
      (get_byte(bytes,1) % 10)::text ||
      (get_byte(bytes,2) % 10)::text ||
      (get_byte(bytes,3) % 10)::text ||
      (get_byte(bytes,4) % 10)::text ||
      (get_byte(bytes,5) % 10)::text ||
      (get_byte(bytes,6) % 10)::text ||
      (get_byte(bytes,7) % 10)::text ||
      (get_byte(bytes,8) % 10)::text ||
      (get_byte(bytes,9) % 10)::text;

    if not exists (select 1 from public.profiles where nex_user_id = candidate) then
      return candidate;
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_nex_user_id() from public, anon, authenticated;
grant execute on function public.generate_nex_user_id() to service_role;

alter table public.profiles
  add column if not exists nex_user_id text;

-- Backfill existing profiles exactly once. Values are unique and are not based
-- on phone number, email, auth UUID, or any other user-supplied identifier.
do $$
declare
  row_item record;
  candidate text;
begin
  for row_item in select id from public.profiles where nex_user_id is null loop
    loop
      candidate := public.generate_nex_user_id();
      exit when not exists (select 1 from public.profiles where nex_user_id = candidate);
    end loop;
    update public.profiles set nex_user_id = candidate where id = row_item.id;
  end loop;
end $$;

alter table public.profiles
  alter column nex_user_id set not null;

create unique index if not exists profiles_nex_user_id_unique_idx
  on public.profiles(nex_user_id);

create or replace function public.assign_nex_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nex_user_id is null or length(trim(new.nex_user_id)) = 0 then
    new.nex_user_id := public.generate_nex_user_id();
  end if;
  if new.nex_user_id !~ '^[1-9][0-9]{9}$' then
    raise exception 'nex_user_id must be exactly 10 digits and cannot begin with zero';
  end if;
  return new;
end;
$$;

revoke all on function public.assign_nex_user_id() from public, anon, authenticated;

drop trigger if exists trg_assign_nex_user_id on public.profiles;
create trigger trg_assign_nex_user_id
before insert or update of nex_user_id on public.profiles
for each row execute function public.assign_nex_user_id();

-- Users can see their own ID; they cannot enumerate other users' IDs through this column.
-- Existing profile ownership policies remain authoritative.

-- ================================================================
-- 2. Operational bank/crypto configuration contracts
-- ================================================================

create table if not exists public.operational_rail_config (
  id uuid primary key default gen_random_uuid(),
  rail_type text not null check (rail_type in ('fiat_deposit','fiat_withdrawal','crypto_deposit','crypto_withdrawal','fees')),
  asset text,
  network text,
  label text not null,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  version integer not null default 1,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (rail_type, asset, network, label)
);

alter table public.operational_rail_config enable row level security;
revoke all on public.operational_rail_config from anon, authenticated;
grant select on public.operational_rail_config to authenticated;
grant select, insert, update, delete on public.operational_rail_config to service_role;

-- No live values are inserted here. The founder must provide the designated
-- bank account(s), crypto addresses/networks, commission and fee schedule.
insert into public.operational_rail_config (rail_type,label,config,active)
values
 ('fiat_deposit','Primary NGN deposit account','{}'::jsonb,false),
 ('fiat_withdrawal','NGN payout configuration','{}'::jsonb,false),
 ('crypto_deposit','USDT/crypto deposit addresses','{}'::jsonb,false),
 ('crypto_withdrawal','Crypto payout configuration','{}'::jsonb,false),
 ('fees','Platform commission and fee schedule','{}'::jsonb,false)
on conflict (rail_type, asset, network, label) do nothing;

comment on table public.operational_rail_config is
'Founder-controlled operational configuration. Never populate with guessed bank details, wallet addresses, fees, commissions, or provider secrets.';

-- ================================================================
-- 3. Transfer lookup by nexMonie ID
-- ================================================================

create or replace function public.create_internal_transfer(p_recipient text,p_amount numeric,p_currency text default 'USDT',p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 sender uuid:=auth.uid(); recipient_id uuid;
 sw public.wallets%rowtype; rw public.wallets%rowtype;
 sb public.wallet_balances%rowtype; rb public.wallet_balances%rowtype;
 reference text;
begin
 if sender is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_amount<=0 then raise exception 'Amount must be positive'; end if;
 if length(trim(coalesce(p_recipient,'')))=0 then raise exception 'Recipient is required'; end if;
 if p_idempotency_key is not null and exists(select 1 from public.wallet_transactions where auth_user_id=sender and reference_id=p_idempotency_key and tx_type='transfer') then
   return jsonb_build_object('status','already_completed','idempotency_key',p_idempotency_key);
 end if;

 select id into recipient_id
 from public.profiles
 where nex_user_id = trim(p_recipient)
    or lower(coalesce(email,'')) = lower(trim(p_recipient))
    or lower(coalesce(username,'')) = lower(trim(p_recipient))
 limit 1;

 if recipient_id is null then raise exception 'Recipient nexMonie account not found'; end if;
 if recipient_id=sender then raise exception 'Cannot transfer to yourself'; end if;

 select * into sw from public.wallets where auth_user_id=sender and upper(currency_code)=upper(p_currency) and is_active=true for update;
 select * into rw from public.wallets where auth_user_id=recipient_id and upper(currency_code)=upper(p_currency) and is_active=true for update;
 if sw.id is null then raise exception 'Sender wallet not found'; end if;
 if rw.id is null then raise exception 'Recipient wallet not found'; end if;
 select * into sb from public.wallet_balances where wallet_id=sw.id and upper(currency_code)=upper(p_currency) for update;
 select * into rb from public.wallet_balances where wallet_id=rw.id and upper(currency_code)=upper(p_currency) for update;
 if sb.wallet_id is null or rb.wallet_id is null then raise exception 'Currency balance not configured'; end if;
 if sb.available_amount<p_amount then raise exception 'Insufficient available balance'; end if;

 reference:=coalesce(nullif(trim(p_idempotency_key),''),gen_random_uuid()::text);
 update public.wallet_balances set available_amount=available_amount-p_amount, ledger_amount=coalesce(ledger_amount,0)-p_amount, updated_at=now() where wallet_id=sw.id and upper(currency_code)=upper(p_currency);
 update public.wallet_balances set available_amount=available_amount+p_amount, ledger_amount=coalesce(ledger_amount,0)+p_amount, updated_at=now() where wallet_id=rw.id and upper(currency_code)=upper(p_currency);

 insert into public.wallet_transactions(auth_user_id,wallet_id,direction,tx_type,reference_id,amount,fee_amount,net_amount,status,memo,counterparty,created_at)
 values(sender,sw.id,'debit'::wallet_transaction_direction,'transfer',reference,p_amount,0,-p_amount,'completed'::wallet_transaction_status,'Internal nexMonie transfer',jsonb_build_object('recipient_user_id',recipient_id,'recipient_nex_user_id',(select nex_user_id from public.profiles where id=recipient_id)),now());
 insert into public.wallet_transactions(auth_user_id,wallet_id,direction,tx_type,reference_id,amount,fee_amount,net_amount,status,memo,counterparty,created_at)
 values(recipient_id,rw.id,'credit'::wallet_transaction_direction,'income',reference,p_amount,0,p_amount,'completed'::wallet_transaction_status,'Internal nexMonie transfer',jsonb_build_object('sender_user_id',sender,'sender_nex_user_id',(select nex_user_id from public.profiles where id=sender)),now());

 return jsonb_build_object('status','completed','reference',reference,'amount',p_amount,'currency',upper(p_currency),'recipient_nex_user_id',(select nex_user_id from public.profiles where id=recipient_id));
end;
$$;
revoke all on function public.create_internal_transfer(text,numeric,text,text) from public,anon;
grant execute on function public.create_internal_transfer(text,numeric,text,text) to authenticated;
