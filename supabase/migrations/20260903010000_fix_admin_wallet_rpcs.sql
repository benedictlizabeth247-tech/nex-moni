-- Align admin wallet RPCs with the canonical wallets and wallet_transactions schema.
-- These functions are intentionally service_role-only; each still verifies the actor.

drop function if exists public.admin_fund_wallet(uuid, uuid, numeric, text, text, text);
create or replace function public.admin_fund_wallet(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_reason text,
  p_reference text default null
) returns public.wallets
language plpgsql security definer set search_path = '' as $$
declare
  v_wallet public.wallets;
  v_reference text;
begin
  if not exists (select 1 from public.admin_staff where user_id = p_actor_user_id and active) then raise exception 'Admin access required'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Amount must not be zero'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Reason is required'; end if;
  v_reference := coalesce(nullif(trim(p_reference), ''), 'admin-credit-' || gen_random_uuid()::text);
  insert into public.wallets (user_id, currency) values (p_user_id, upper(trim(p_currency)))
    on conflict (user_id) do update set currency = excluded.currency, updated_at = now();
  update public.wallets set available = available + p_amount, updated_at = now()
    where user_id = p_user_id returning * into v_wallet;
  insert into public.wallet_transactions (user_id, wallet_id, amount, type, title, category, balance_field, status, reference_id, metadata)
    values (p_user_id, v_wallet.id, p_amount, case when p_amount > 0 then 'credit' else 'debit' end, trim(p_reason), 'admin', 'available', 'completed', v_reference,
      jsonb_build_object('actor_user_id', p_actor_user_id, 'currency', upper(trim(p_currency))));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
    values (p_actor_user_id, 'admin_fund_wallet', 'wallet', v_wallet.id::text,
      jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'currency', upper(trim(p_currency)), 'reference', v_reference));
  return v_wallet;
end;
$$;

drop function if exists public.admin_set_wallet_controls(uuid, uuid, text, text, text);
drop function if exists public.admin_set_wallet_controls(text, uuid, text, text, uuid);
create or replace function public.admin_set_wallet_controls(
  p_action text, p_actor_user_id uuid, p_currency text, p_reason text, p_user_id uuid
) returns public.wallets
language plpgsql security definer set search_path = '' as $$
declare v_wallet public.wallets;
begin
  if not exists (select 1 from public.admin_staff where user_id = p_actor_user_id and active) then raise exception 'Admin access required'; end if;
  if p_action not in ('freeze','unfreeze','restrict_withdrawals','allow_withdrawals','restrict_trading','allow_trading') then raise exception 'Invalid wallet action'; end if;
  insert into public.wallets (user_id, currency) values (p_user_id, coalesce(nullif(trim(p_currency), ''), 'USD')) on conflict (user_id) do nothing;
  update public.wallets set status = case when p_action = 'freeze' then 'frozen' when p_action = 'unfreeze' then 'active' else status end,
    trading_restricted = case when p_action = 'restrict_trading' then true when p_action = 'allow_trading' then false else trading_restricted end,
    updated_at = now() where user_id = p_user_id returning * into v_wallet;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
    values (p_actor_user_id, p_action, 'wallet', v_wallet.id::text, jsonb_build_object('user_id', p_user_id, 'currency', p_currency, 'reason', p_reason));
  return v_wallet;
end;
$$;

drop function if exists public.admin_reconcile_wallet(uuid, uuid, text);
create or replace function public.admin_reconcile_wallet(
  p_actor_user_id uuid, p_user_id uuid, p_currency text default null
) returns public.wallets
language plpgsql security definer set search_path = '' as $$
declare v_wallet public.wallets;
begin
  if not exists (select 1 from public.admin_staff where user_id = p_actor_user_id and active) then raise exception 'Admin access required'; end if;
  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    insert into public.wallets (user_id, currency) values (p_user_id, coalesce(nullif(trim(p_currency), ''), 'USD')) returning * into v_wallet;
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_data)
    values (p_actor_user_id, 'admin_reconcile_wallet', 'wallet', v_wallet.id::text,
      jsonb_build_object('user_id', p_user_id, 'available', v_wallet.available, 'locked', v_wallet.locked));
  return v_wallet;
end;
$$;

revoke all on function public.admin_fund_wallet(uuid, uuid, numeric, text, text, text) from public;
grant execute on function public.admin_fund_wallet(uuid, uuid, numeric, text, text, text) to service_role;
revoke all on function public.admin_set_wallet_controls(text, uuid, text, text, uuid) from public;
grant execute on function public.admin_set_wallet_controls(text, uuid, text, text, uuid) to service_role;
revoke all on function public.admin_reconcile_wallet(uuid, uuid, text) from public;
grant execute on function public.admin_reconcile_wallet(uuid, uuid, text) to service_role;
