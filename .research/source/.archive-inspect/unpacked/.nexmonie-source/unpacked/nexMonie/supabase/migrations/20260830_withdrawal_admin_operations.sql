-- Withdrawal operations: controlled Admin state transitions and reservation release.
-- This migration does not send external money. Provider payout execution is a later phase.


alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_status_check
  check (status in ('pending','processing','on_hold','completed','rejected','cancelled','failed'));

alter table public.withdrawal_requests
  add column if not exists rejection_reason text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists processing_at timestamptz,
  add column if not exists processing_by uuid references auth.users(id);

create or replace function public.admin_manage_withdrawal(
  p_actor_user_id uuid,
  p_withdrawal_id uuid,
  p_action text,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wdr public.withdrawal_requests;
  wallet_row public.wallets;
  action_code text := lower(trim(coalesce(p_action,'')));
  note_value text := nullif(trim(coalesce(p_note,'')), '');
  reference text;
begin
  if not exists (select 1 from public.admin_staff where user_id=p_actor_user_id and active=true) then
    raise exception 'Administrator not authorized';
  end if;

  select * into wdr from public.withdrawal_requests where id=p_withdrawal_id for update;
  if wdr.id is null then raise exception 'Withdrawal request not found'; end if;

  if action_code not in ('approve','reject','hold','mark_processing') then
    raise exception 'Unsupported withdrawal action';
  end if;

  if action_code='approve' then
    if wdr.status <> 'pending' or wdr.reservation_status <> 'reserved' then
      raise exception 'Only pending reserved withdrawals can be approved';
    end if;
    update public.withdrawal_requests
      set status='processing', approved_at=now(), approved_by=p_actor_user_id,
          processing_at=now(), processing_by=p_actor_user_id,
          admin_note=coalesce(note_value, admin_note)
      where id=wdr.id;
    return jsonb_build_object('status','processing','withdrawal_id',wdr.id);
  end if;

  if action_code='mark_processing' then
    if wdr.status <> 'pending' or wdr.reservation_status <> 'reserved' then
      raise exception 'Only pending reserved withdrawals can enter processing';
    end if;
    update public.withdrawal_requests
      set status='processing', processing_at=now(), processing_by=p_actor_user_id,
          admin_note=coalesce(note_value, admin_note)
      where id=wdr.id;
    return jsonb_build_object('status','processing','withdrawal_id',wdr.id);
  end if;

  if action_code='hold' then
    if wdr.status not in ('pending','processing','on_hold') then
      raise exception 'Only active withdrawals can be held';
    end if;
    update public.withdrawal_requests
      set status='on_hold', admin_note=coalesce(note_value, admin_note)
      where id=wdr.id;
    return jsonb_build_object('status','on_hold','withdrawal_id',wdr.id,'held',true);
  end if;

  -- Reject: release the reservation atomically. This restores AVAILABLE and
  -- changes the original pending ledger record to a rejected reservation event.
  if action_code='reject' then
    if wdr.status not in ('pending','processing','on_hold') or wdr.reservation_status <> 'reserved' then
      raise exception 'Only reserved active withdrawals can be rejected';
    end if;

    select * into wallet_row
    from public.wallets
    where user_id=wdr.user_id and upper(currency)=upper(wdr.currency)
    for update;

    if wallet_row.id is null then raise exception 'Wallet not found for withdrawal'; end if;

    update public.wallets
      set available=coalesce(available,0)+wdr.reserved_amount, updated_at=now()
      where id=wallet_row.id;

    reference := 'WDR-' || replace(gen_random_uuid()::text,'-','');

    insert into public.wallet_transactions(
      user_id, wallet_id, amount, type, title, category, balance_field,
      status, reference_id, recipient, metadata, created_at
    ) values (
      wdr.user_id, wallet_row.id, wdr.reserved_amount, 'income',
      'Withdrawal reservation released', 'Withdrawal', 'available',
      'completed', reference, wdr.destination,
      jsonb_build_object(
        'withdrawal_id', wdr.id,
        'reservation_release', true,
        'actor_user_id', p_actor_user_id,
        'reason', coalesce(note_value,'Withdrawal rejected')
      ), now()
    );

    update public.withdrawal_requests
      set status='rejected', reservation_status='released', released_at=now(),
          processed_at=now(), processed_by=p_actor_user_id,
          rejection_reason=coalesce(note_value,'Withdrawal rejected'),
          admin_note=coalesce(note_value, admin_note)
      where id=wdr.id;

    return jsonb_build_object('status','rejected','withdrawal_id',wdr.id,'released_amount',wdr.reserved_amount);
  end if;
end;
$$;

revoke all on function public.admin_manage_withdrawal(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.admin_manage_withdrawal(uuid,uuid,text,text) to service_role;
