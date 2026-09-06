-- Live hardening: privileged wallet funding/debit and instant internal transfers.
-- The authoritative wallet schema is wallets + wallet_balances + wallet_transactions.
-- Privileged funding is service-role-only and must be called through the server boundary.
-- Internal transfers are authenticated-user-only, atomic and idempotent.

create table if not exists public.admin_wallet_adjustments (
  id uuid primary key default gen_random_uuid(), actor_user_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id), amount numeric(38,18) not null check (amount <> 0),
  currency text not null, reason text not null, reference text, balance_before numeric(38,18) not null,
  balance_after numeric(38,18) not null, created_at timestamptz not null default now()
);
create index if not exists admin_wallet_adjustments_user_idx on public.admin_wallet_adjustments(user_id, created_at desc);
create index if not exists admin_wallet_adjustments_actor_idx on public.admin_wallet_adjustments(actor_user_id, created_at desc);
alter table public.admin_wallet_adjustments enable row level security;

create or replace function public.admin_fund_wallet(p_actor_user_id uuid,p_user_id uuid,p_amount numeric,p_currency text,p_reason text,p_reference text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare w public.wallets%rowtype; b public.wallet_balances%rowtype; before_amount numeric; after_amount numeric;
begin
 if p_amount=0 then raise exception 'Amount cannot be zero'; end if;
 if not exists(select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
 if p_reason is null or length(trim(p_reason))<3 then raise exception 'Reason is required'; end if;
 select * into w from public.wallets where auth_user_id=p_user_id and upper(currency_code)=upper(p_currency) and is_active=true for update;
 if not found then raise exception 'Wallet not found'; end if;
 select * into b from public.wallet_balances where wallet_id=w.id and upper(currency_code)=upper(p_currency) for update;
 if not found then raise exception 'Wallet balance not found'; end if;
 before_amount:=coalesce(b.available_amount,0); after_amount:=before_amount+p_amount;
 if after_amount<0 then raise exception 'Insufficient available balance'; end if;
 update public.wallet_balances set available_amount=after_amount, ledger_amount=coalesce(ledger_amount,0)+p_amount, updated_at=now() where wallet_id=w.id and upper(currency_code)=upper(p_currency);
 insert into public.wallet_transactions(auth_user_id,wallet_id,direction,tx_type,reference_id,amount,fee_amount,net_amount,status,memo,counterparty,created_at)
 values(p_user_id,w.id,case when p_amount>0 then 'credit'::wallet_transaction_direction else 'debit'::wallet_transaction_direction end,'admin_adjustment',coalesce(p_reference,gen_random_uuid()::text),abs(p_amount),0,p_amount,'completed'::wallet_transaction_status,trim(p_reason),jsonb_build_object('actor_user_id',p_actor_user_id),now());
 insert into public.admin_wallet_adjustments(actor_user_id,user_id,amount,currency,reason,reference,balance_before,balance_after)
 values(p_actor_user_id,p_user_id,p_amount,upper(p_currency),trim(p_reason),p_reference,before_amount,after_amount);
 return jsonb_build_object('wallet_id',w.id,'user_id',p_user_id,'currency',upper(p_currency),'available',after_amount,'adjustment',p_amount,'balance_before',before_amount,'balance_after',after_amount);
end $$;
revoke all on function public.admin_fund_wallet(uuid,uuid,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_fund_wallet(uuid,uuid,numeric,text,text,text) to service_role;

create or replace function public.create_internal_transfer(p_recipient text,p_amount numeric,p_currency text default 'NGN',p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare sender uuid:=auth.uid(); recipient_id uuid; sw public.wallets%rowtype; rw public.wallets%rowtype; sb public.wallet_balances%rowtype; rb public.wallet_balances%rowtype; reference text;
begin
 if sender is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_amount<=0 then raise exception 'Amount must be positive'; end if;
 if p_idempotency_key is not null and exists(select 1 from public.wallet_transactions where auth_user_id=sender and reference_id=p_idempotency_key and tx_type='transfer') then return jsonb_build_object('status','already_completed','idempotency_key',p_idempotency_key); end if;
 select id into recipient_id from public.profiles where lower(coalesce(email,''))=lower(trim(p_recipient)) or lower(coalesce(username,''))=lower(trim(p_recipient)) limit 1;
 if recipient_id is null then raise exception 'Recipient not found'; end if;
 if recipient_id=sender then raise exception 'Cannot transfer to yourself'; end if;
 select * into sw from public.wallets where auth_user_id=sender and upper(currency_code)=upper(p_currency) and is_active=true for update;
 select * into rw from public.wallets where auth_user_id=recipient_id and upper(currency_code)=upper(p_currency) and is_active=true for update;
 if not found then raise exception 'Recipient wallet not found'; end if;
 select * into sb from public.wallet_balances where wallet_id=sw.id and upper(currency_code)=upper(p_currency) for update;
 select * into rb from public.wallet_balances where wallet_id=rw.id and upper(currency_code)=upper(p_currency) for update;
 if sb.available_amount<p_amount then raise exception 'Insufficient available balance'; end if;
 reference:=coalesce(nullif(trim(p_idempotency_key),''),gen_random_uuid()::text);
 update public.wallet_balances set available_amount=available_amount-p_amount, ledger_amount=coalesce(ledger_amount,0)-p_amount, updated_at=now() where wallet_id=sw.id and upper(currency_code)=upper(p_currency);
 update public.wallet_balances set available_amount=available_amount+p_amount, ledger_amount=coalesce(ledger_amount,0)+p_amount, updated_at=now() where wallet_id=rw.id and upper(currency_code)=upper(p_currency);
 insert into public.wallet_transactions(auth_user_id,wallet_id,direction,tx_type,reference_id,amount,fee_amount,net_amount,status,memo,counterparty,created_at) values(sender,sw.id,'debit'::wallet_transaction_direction,'transfer',reference,p_amount,0,-p_amount,'completed'::wallet_transaction_status,'Internal nexMonie transfer',jsonb_build_object('recipient_user_id',recipient_id),now());
 insert into public.wallet_transactions(auth_user_id,wallet_id,direction,tx_type,reference_id,amount,fee_amount,net_amount,status,memo,counterparty,created_at) values(recipient_id,rw.id,'credit'::wallet_transaction_direction,'income',reference,p_amount,0,p_amount,'completed'::wallet_transaction_status,'Internal nexMonie transfer',jsonb_build_object('sender_user_id',sender),now());
 return jsonb_build_object('status','completed','reference',reference,'amount',p_amount,'currency',upper(p_currency));
end $$;
revoke all on function public.create_internal_transfer(text,numeric,text,text) from public,anon;
grant execute on function public.create_internal_transfer(text,numeric,text,text) to authenticated;
