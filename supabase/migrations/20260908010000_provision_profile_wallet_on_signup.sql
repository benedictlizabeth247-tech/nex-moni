create or replace function public.handle_new_user_provisioning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, status, is_verified, trading_access)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', concat_ws(' ', new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'surname'))), ''),
    'active',
    true,
    true
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  insert into public.wallets (user_id, currency)
  values (new.id, 'USDT')
  on conflict (user_id) do nothing;

  insert into public.trading_accounts (user_id, funding_balance, spot_balance, futures_balance)
  values (new.id, 0, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_provisioning on auth.users;
create trigger on_auth_user_created_provisioning
after insert on auth.users
for each row execute function public.handle_new_user_provisioning();

revoke all on function public.handle_new_user_provisioning() from public, anon, authenticated;
grant execute on function public.handle_new_user_provisioning() to postgres, service_role;
